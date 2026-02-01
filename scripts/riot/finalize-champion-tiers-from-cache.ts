// scripts/riot/finalize-champion-tiers-from-cache.ts
import fs from "node:fs/promises";
import path from "node:path";

type Tier = "S" | "A" | "B" | "C" | "D" | "—";

const ROOT = process.cwd();
const MATCH_DIR = path.join(ROOT, "scripts", "riot", "cache", "champion_tiers", "matches");
const OUT_PATH = path.join(ROOT, "public", "data", "lol", "champion_tiers.json");

function mean(xs: number[]) {
  if (!xs.length) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function std(xs: number[], mu: number) {
  if (xs.length < 2) return 1;
  let v = 0;
  for (const x of xs) {
    const d = x - mu;
    v += d * d;
  }
  v /= xs.length;
  const out = Math.sqrt(v);
  return out > 1e-9 ? out : 1;
}

function tierFromPercentile(p: number): Tier {
  if (p >= 0.9) return "S";
  if (p >= 0.7) return "A";
  if (p >= 0.4) return "B";
  if (p >= 0.15) return "C";
  return "D";
}

function slugifyLoL(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchLatestDdragonVersion(): Promise<string> {
  const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed Data Dragon versions: HTTP ${res.status}`);
  const json = (await res.json()) as string[];
  const v = Array.isArray(json) && json.length ? String(json[0]) : "";
  if (!v) throw new Error("Could not determine Data Dragon version");
  return v;
}

async function fetchChampionIdToName(ddVersion: string): Promise<Map<number, string>> {
  const url = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/data/en_US/championFull.json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed championFull.json: HTTP ${res.status}`);
  const json = await res.json();

  const data = json?.data ?? {};
  const map = new Map<number, string>();

  for (const k of Object.keys(data)) {
    const champ = data[k];
    const keyStr = (champ?.key ?? "").toString().trim(); // numeric championId as string
    const name = (champ?.id ?? champ?.name ?? k ?? "").toString().trim(); // canonical id for images
    const idNum = Number(keyStr);
    if (Number.isFinite(idNum) && name) map.set(idNum, name);
  }

  return map;
}

type Agg = {
  games: number;
  wins: number;
  bans: number;
};

type OutRow = {
  championId: number;
  name: string; // DDragon canonical id (Ahri, KhaZix, AurelionSol...)
  slug: string;

  picks: number;
  wins: number;
  bans: number;

  winrate: number; // 0..1
  banrate: number; // 0..1 (bans / matchesSeen)

  score: number;
  tier: Tier;

  // metadata
  matchesSeen: number;
  ddragonVersion: string;
  generatedAt: string;
};

export async function main() {
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });

  const ddVersion = await fetchLatestDdragonVersion();
  const idToName = await fetchChampionIdToName(ddVersion);

  let files: string[] = [];
  try {
    files = (await fs.readdir(MATCH_DIR)).filter((f) => f.endsWith(".json"));
  } catch {
    files = [];
  }

  const generatedAt = new Date().toISOString();

  if (!files.length) {
    await fs.writeFile(OUT_PATH, "[]", "utf-8");
    console.log("[champion-tiers/finalize] No cached matches found. Wrote empty json.");
    return;
  }

  const agg = new Map<number, Agg>();
  const bans = new Map<number, number>();
  let matchesSeen = 0;

  for (const file of files) {
    const abs = path.join(MATCH_DIR, file);
    let match: any;

    try {
      match = JSON.parse(await fs.readFile(abs, "utf-8"));
    } catch {
      continue;
    }

    const info = match?.info;
    if (!info) continue;
    matchesSeen++;

    // bans live on teams[].bans[]
    const teams = info?.teams;
    if (Array.isArray(teams)) {
      for (const t of teams) {
        const b = t?.bans;
        if (!Array.isArray(b)) continue;
        for (const ban of b) {
          const cid = Number(ban?.championId);
          if (!Number.isFinite(cid) || cid <= 0) continue;
          bans.set(cid, (bans.get(cid) ?? 0) + 1);
        }
      }
    }

    const parts: any[] = Array.isArray(info?.participants) ? info.participants : [];
    for (const p of parts) {
      const cid = Number(p?.championId);
      if (!Number.isFinite(cid) || cid <= 0) continue;

      const win = Boolean(p?.win);

      const a = agg.get(cid) ?? { games: 0, wins: 0, bans: 0 };
      a.games += 1;
      if (win) a.wins += 1;
      agg.set(cid, a);
    }
  }

  // apply bans
  for (const [cid, bcount] of bans.entries()) {
    const a = agg.get(cid) ?? { games: 0, wins: 0, bans: 0 };
    a.bans = bcount;
    agg.set(cid, a);
  }

  // build rows
  const rows = Array.from(agg.entries())
    .map(([cid, a]) => {
      const name = idToName.get(cid) || `Champion${cid}`;
      const slug = slugifyLoL(name);

      const picks = a.games;
      const wins = a.wins;
      const banCount = a.bans ?? 0;

      const winrate = picks ? wins / picks : 0;
      const banrate = matchesSeen ? banCount / matchesSeen : 0;

      return {
        championId: cid,
        name,
        slug,
        picks,
        wins,
        bans: banCount,
        winrate,
        banrate,
      };
    })
    .filter((r) => r.picks > 0);

  if (!rows.length) {
    await fs.writeFile(OUT_PATH, "[]", "utf-8");
    console.log("[champion-tiers/finalize] No usable rows (0 picks). Wrote empty json.");
    return;
  }

  // scoring inputs
  const pickVals = rows.map((r) => Math.log1p(r.picks));
  const winVals = rows.map((r) => r.winrate);
  const banVals = rows.map((r) => r.banrate);

  const muPick = mean(pickVals);
  const sdPick = std(pickVals, muPick);

  const muWin = mean(winVals);
  const sdWin = std(winVals, muWin);

  const muBan = mean(banVals);
  const sdBan = std(banVals, muBan);

  // weights (tweak whenever)
  const W_PICK = 0.40;
  const W_WIN = 0.50;
  const W_BAN = 0.10;

  const scored = rows.map((r) => {
    const zPick = (Math.log1p(r.picks) - muPick) / sdPick;
    const zWin = (r.winrate - muWin) / sdWin;

    // bans may be sparse; if sdBan ~ 0 we still get a safe divisor from std()
    const zBan = (r.banrate - muBan) / sdBan;

    const score = W_PICK * zPick + W_WIN * zWin + W_BAN * zBan;
    return { ...r, score };
  });

  // tier by percentile of score
  const byScore = [...scored].sort((a, b) => b.score - a.score);
  const n = byScore.length;

  const tierById = new Map<number, Tier>();
  for (let i = 0; i < n; i++) {
    const p = n <= 1 ? 1 : 1 - i / (n - 1);
    tierById.set(byScore[i].championId, tierFromPercentile(p));
  }

  const out: OutRow[] = scored
    .map((r) => ({
      championId: r.championId,
      name: r.name,
      slug: r.slug,

      picks: r.picks,
      wins: r.wins,
      bans: r.bans,

      winrate: Number(r.winrate.toFixed(4)),
      banrate: Number(r.banrate.toFixed(4)),

      score: Number(r.score.toFixed(6)),
      tier: tierById.get(r.championId) ?? "—",

      matchesSeen,
      ddragonVersion: ddVersion,
      generatedAt,
    }))
    .sort((a, b) => {
      // default: tier then score
      const order: Record<Tier, number> = { S: 0, A: 1, B: 2, C: 3, D: 4, "—": 9 };
      const dt = (order[a.tier] ?? 9) - (order[b.tier] ?? 9);
      if (dt !== 0) return dt;
      return b.score - a.score;
    });

  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2), "utf-8");
  console.log(
    `[champion-tiers/finalize] wrote ${out.length} champs -> public/data/lol/champion_tiers.json (matches=${matchesSeen}, ddragon=${ddVersion})`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
