// scripts/riot/finalize-meta-builds-from-cache.ts
// Offline finalize: reads cached Match-V5 JSONs and writes meta_builds_{ranked,casual}.json
// ✅ combine all patches >=16 into single "16+" bucket + suppress low-sample (prevents 1-game 100% previews)

import fs from "node:fs/promises";
import path from "node:path";

type RiotMatch = {
  info?: {
    gameVersion?: string;
    queueId?: number;
    participants?: Array<{
      championId?: number;
      teamPosition?: string;
      item0?: number; item1?: number; item2?: number; item3?: number; item4?: number; item5?: number; item6?: number;
      summoner1Id?: number;
      summoner2Id?: number;
      win?: boolean;
    }>;
  };
};

type Role = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";

type BuildParts = {
  boots: number | null;
  core: number[];      // up to 3
  items: number[];     // boots + core (display)
  summoners: number[]; // display only
};

type Leaf = { games: number; wins: number; build: BuildParts };

type Agg = Record<
  string, // patchKey ("16+")
  Record<
    string, // champId
    Partial<Record<Role, Record<string, Leaf>>> // role -> sig -> leaf
  >
>;

/**
 * NOTE: patchMajorMinor is unused in this file; safe to delete.
 * (Leaving it out avoids lint/ts warnings.)
 */

function patchMajor(gameVersion: string | undefined): number | null {
  if (!gameVersion) return null;
  const m = String(gameVersion).match(/^(\d+)\./);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function normPos(pos: string | undefined): Role | null {
  const p = (pos || "").toUpperCase();
  if (p === "TOP") return "TOP";
  if (p === "JUNGLE") return "JUNGLE";
  if (p === "MIDDLE" || p === "MID") return "MIDDLE";
  if (p === "BOTTOM" || p === "BOT") return "BOTTOM";
  if (p === "UTILITY" || p === "SUPPORT") return "UTILITY";
  return null;
}

async function listJsonFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listJsonFiles(p)));
    else if (e.isFile() && e.name.toLowerCase().endsWith(".json")) out.push(p);
  }
  return out;
}

function bayesScore(wins: number, games: number, k: number, prior: number) {
  const a = prior * k + wins;
  const b = (1 - prior) * k + (games - wins);
  return a / (a + b);
}

function inc(
  agg: Agg,
  patchKey: string,
  champId: number,
  role: Role,
  sig: string,
  win: boolean,
  build: BuildParts
) {
  const p = (agg[patchKey] ||= {});
  const c = (p[String(champId)] ||= {});
  const r = (c[role] ||= {});
  const leaf = (r[sig] ||= { games: 0, wins: 0, build });
  leaf.games += 1;
  if (win) leaf.wins += 1;
}

function toNum(x: any): number {
  const n = Number(x || 0);
  return Number.isFinite(n) ? n : 0;
}

function uniqKeepOrder(nums: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const n of nums) {
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

type ItemsDdragon = { data?: Record<string, { tags?: string[] }> };

async function loadBootSet(repoRoot: string): Promise<Set<number>> {
  const p = path.join(repoRoot, "public", "data", "lol", "items.json");
  const raw = await fs.readFile(p, "utf-8");
  const json = JSON.parse(raw) as ItemsDdragon;

  const boots = new Set<number>();
  for (const [idStr, it] of Object.entries(json.data || {})) {
    const id = Number(idStr);
    if (!Number.isFinite(id) || id <= 0) continue;
    const tags = Array.isArray(it.tags) ? it.tags : [];
    if (tags.includes("Boots")) boots.add(id);
  }
  return boots;
}

function extractBootsAndCore(p: any, bootSet: Set<number>): BuildParts {
  const raw = [
    toNum(p?.item0),
    toNum(p?.item1),
    toNum(p?.item2),
    toNum(p?.item3),
    toNum(p?.item4),
    toNum(p?.item5),
  ].filter((x) => x > 0);

  const items = uniqKeepOrder(raw);

  let boots: number | null = null;
  for (const id of items) {
    if (bootSet.has(id)) { boots = id; break; }
  }

  const core: number[] = [];
  for (const id of items) {
    if (boots && id === boots) continue;
    core.push(id);
    if (core.length >= 3) break;
  }

  const summoners = [toNum(p?.summoner1Id), toNum(p?.summoner2Id)]
    .filter((x) => x > 0)
    .sort((a, b) => a - b);

  const displayItems = [
    ...(boots ? [boots] : []),
    ...core,
  ].filter((x) => x > 0);

  return { boots, core, items: displayItems, summoners };
}

function buildSig(b: BuildParts): string {
  const bPart = b.boots ? String(b.boots) : "0";
  const cPart = b.core.join(",");
  return `b=${bPart}|c=${cPart}`;
}

function topBuildsForRole(
  roleMap: Record<string, Leaf>,
  minDisplaySample: number,
  bayesK: number,
  priorWinrate: number
) {
  const entries = Object.entries(roleMap)
    .map(([sig, leaf]) => {
      const games = leaf.games;
      const wins = leaf.wins;
      const winrate = games > 0 ? wins / games : 0;
      const score = bayesScore(wins, games, bayesK, priorWinrate);
      return {
        buildSig: sig,
        ...leaf.build,
        games,
        wins,
        winrate,
        score,
      };
    })
    // ✅ suppress low sample entirely so 1-game 100% never appears anywhere
    .filter((x) => x.games >= minDisplaySample)
    .sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;
      return b.score - a.score;
    });

  return entries.slice(0, 10);
}

async function writeOut(outPath: string, queues: number[], agg: Agg) {
  const obj = {
    generatedAt: new Date().toISOString(),
    queues,
    useTimeline: false,
    patchMajorMinorOnly: false,
    minSample: 200,
    minDisplaySample: 10,
    bayesK: 100,
    priorWinrate: 0.5,
    minPatchMajor: 16,
    patches: {} as any,
  };

  for (const [patchKey, champs] of Object.entries(agg)) {
    obj.patches[patchKey] = {};
    for (const [champId, roles] of Object.entries(champs)) {
      obj.patches[patchKey][champId] = {};
      for (const [role, sigMap] of Object.entries(roles as any)) {
        const top = topBuildsForRole(
          sigMap as Record<string, Leaf>,
          obj.minDisplaySample,
          obj.bayesK,
          obj.priorWinrate
        );
        if (top.length) obj.patches[patchKey][champId][role] = top;
      }
    }
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(obj, null, 2), "utf-8");
}

async function main() {
  const repoRoot = process.cwd();
  const cacheMatchesDir = path.join(repoRoot, "scripts", "riot", "cache", "matches");
  const outDir = path.join(repoRoot, "public", "data", "lol");

  const rankedQueues = [420];
  const casualQueues = [400, 430];

  const bootSet = await loadBootSet(repoRoot);

  const files = await listJsonFiles(cacheMatchesDir);
  if (!files.length) {
    console.error("No cached matches found at:", cacheMatchesDir);
    process.exit(1);
  }

  const rankedAgg: Agg = {};
  const casualAgg: Agg = {};

  const patchKey = "16+";

  const debug = {
    filesRead: 0,
    jsonParseFail: 0,
    noInfo: 0,
    queueNotTracked: 0,
    patchTooOld: 0,
    noParticipants: 0,
    badChamp: 0,
    badRole: 0,
    keptParticipants: 0,
  };

  for (const fp of files) {
    let match: RiotMatch | null = null;
    try {
      const raw = await fs.readFile(fp, "utf-8");
      match = JSON.parse(raw) as RiotMatch;
    } catch {
      debug.jsonParseFail += 1;
      continue;
    }

    debug.filesRead += 1;

    const info = match?.info;
    if (!info) {
      debug.noInfo += 1;
      continue;
    }

    const q = Number(info.queueId || 0);
    const tracked = rankedQueues.includes(q) || casualQueues.includes(q);
    if (!tracked) {
      debug.queueNotTracked += 1;
      continue;
    }

    const major = patchMajor(info.gameVersion);
    if (!major || major < 16) {
      debug.patchTooOld += 1;
      continue;
    }

    const participants = Array.isArray(info.participants) ? info.participants : [];
    if (!participants.length) {
      debug.noParticipants += 1;
      continue;
    }

    for (const p of participants) {
      const champId = Number(p?.championId || 0);
      if (!champId) { debug.badChamp += 1; continue; }

      const role = normPos(p?.teamPosition);
      if (!role) { debug.badRole += 1; continue; }

      const build = extractBootsAndCore(p, bootSet);
      if (!build.core.length && !build.boots) continue;

      const sig = buildSig(build);
      const win = Boolean(p?.win);

      debug.keptParticipants += 1;

      if (rankedQueues.includes(q)) inc(rankedAgg, patchKey, champId, role, sig, win, build);
      if (casualQueues.includes(q)) inc(casualAgg, patchKey, champId, role, sig, win, build);
    }
  }

  console.log("DEBUG:", debug);

  await writeOut(path.join(outDir, "meta_builds_ranked.json"), rankedQueues, rankedAgg);
  await writeOut(path.join(outDir, "meta_builds_casual.json"), casualQueues, casualAgg);

  console.log('Wrote meta_builds_ranked.json and meta_builds_casual.json (patch key "16+")');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
