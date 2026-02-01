// scripts/riot/build-champion-tiers.ts
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

type Json = Record<string, any>;

const ROOT = process.cwd();

// ✅ dedicated cache namespace for champion tiers
const CACHE_DIR = path.join(ROOT, "scripts", "riot", "cache", "champion_tiers");
const CACHE_MATCHES_DIR = path.join(CACHE_DIR, "matches");
const CACHE_STATE_DIR = path.join(CACHE_DIR, "state");

const SEEN_MATCH_IDS_PATH = path.join(CACHE_STATE_DIR, "seen_match_ids.json");
const SEEN_PUUIDS_PATH = path.join(CACHE_STATE_DIR, "seen_puuids.json");
const PUUID_CURSORS_PATH = path.join(CACHE_STATE_DIR, "puuid_cursors.json");

// output is created by finalize script
const OUT_PATH = path.join(ROOT, "public", "data", "lol", "champion_tiers.json");

// env
const RIOT_API_KEY = process.env.RIOT_API_KEY || "";

// ✅ regional (match-v5)
const RIOT_REGION = (process.env.RIOT_REGION || "americas").trim();

// ✅ platform (league-v4 + summoner-v4)
const RIOT_PLATFORM = (process.env.RIOT_PLATFORM || "na1").trim();

// budgets
const MAX_MATCHES_PER_RUN = Number(process.env.TIERS_MAX_MATCHES_PER_RUN || 2500);
const MAX_NEW_PUUIDS_PER_RUN = Number(process.env.TIERS_MAX_NEW_PUUIDS_PER_RUN || 500);
const MATCHES_PER_PUUID = Number(process.env.TIERS_MATCHES_PER_PUUID || 20);

// which queues to request in matchlist call
const TIERS_QUEUE_IDS = String(process.env.TIERS_QUEUE_IDS || "420,440")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);

// ladder bootstrap knobs (match your meta script)
type LadderQueue = "RANKED_SOLO_5x5" | "RANKED_FLEX_SR";
const LADDER_QUEUE = (process.env.LADDER_QUEUE || "RANKED_SOLO_5x5").trim() as LadderQueue;

type LadderTier = "challenger" | "grandmaster" | "master";
const LADDER_TIER = (process.env.LADDER_TIER || "challenger").trim().toLowerCase() as LadderTier;

const LADDER_MAX_PLAYERS = Number(process.env.LADDER_MAX_PLAYERS || 300);

// behavior knobs
const REPROCESS_BOOTSTRAP = String(process.env.TIERS_REPROCESS_BOOTSTRAP || "0") === "1";
const GAP_MS = Number(process.env.TIERS_GAP_MS || 250);
const DAYS_BACK = Number(process.env.TIERS_DAYS_BACK || 14);

type SeenMatchIdsState = { ids: string[] };
type SeenPuuidsState = { puuids: string[] };
type PuuidCursors = Record<string, number>;

console.log(
  "[env] RIOT_API_KEY:",
  RIOT_API_KEY ? `present len=${RIOT_API_KEY.length}` : "MISSING"
);
console.log("[env] RIOT_REGION (match-v5):", RIOT_REGION);
console.log("[env] RIOT_PLATFORM (league/summoner):", RIOT_PLATFORM);
console.log("[env] LADDER_TIER/QUEUE/MAX:", LADDER_TIER, LADDER_QUEUE, LADDER_MAX_PLAYERS);
console.log("[env] TIERS_QUEUE_IDS:", TIERS_QUEUE_IDS.join(","));
console.log("[env] DAYS_BACK:", DAYS_BACK);

function assertEnv() {
  if (!RIOT_API_KEY || !RIOT_API_KEY.startsWith("RGAPI-")) {
    throw new Error("Missing/invalid RIOT_API_KEY. Put it in .env.local as RIOT_API_KEY=RGAPI-...");
  }
}

async function ensureDirs() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.mkdir(CACHE_MATCHES_DIR, { recursive: true });
  await fs.mkdir(CACHE_STATE_DIR, { recursive: true });

  await ensureJson(SEEN_MATCH_IDS_PATH, { ids: [] } satisfies SeenMatchIdsState);
  await ensureJson(SEEN_PUUIDS_PATH, { puuids: [] } satisfies SeenPuuidsState);
  await ensureJson(PUUID_CURSORS_PATH, {} satisfies PuuidCursors);

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
}

async function ensureJson<T extends Json>(p: string, defaultValue: T) {
  try {
    await fs.access(p);
  } catch {
    await fs.writeFile(p, JSON.stringify(defaultValue, null, 2), "utf-8");
  }
}

async function readJson<T>(p: string): Promise<T> {
  const raw = await fs.readFile(p, "utf-8");
  return JSON.parse(raw) as T;
}

async function writeJson(p: string, data: any) {
  await fs.writeFile(p, JSON.stringify(data, null, 2), "utf-8");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function riotRegionalBase() {
  return `https://${RIOT_REGION}.api.riotgames.com`;
}

function riotPlatformBase() {
  return `https://${RIOT_PLATFORM}.api.riotgames.com`;
}

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

function oldestAllowedUnix(daysBack: number) {
  return nowUnix() - Math.floor(daysBack * 24 * 60 * 60);
}

async function fetchJsonWithRetry(
  url: string,
  opts?: { retries?: number; kind?: "regional" | "platform" }
): Promise<any> {
  const retries = opts?.retries ?? 5;
  const kind = opts?.kind ?? "regional";

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: {
        "X-Riot-Token": RIOT_API_KEY,
        "User-Agent": "GamerStation (champion tiers pipeline)",
      },
    });

    if (res.status === 429) {
      const ra = res.headers.get("Retry-After");
      const waitMs = ra ? Number(ra) * 1000 : 1200 + attempt * 800;
      console.log(`429 rate limited (${kind}). Waiting ${waitMs}ms then retrying...`);
      await sleep(waitMs);
      continue;
    }

    if (res.status >= 500 && attempt < retries) {
      const waitMs = 800 + attempt * 600;
      console.log(`${res.status} server error (${kind}). Waiting ${waitMs}ms then retrying...`);
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`${kind} fetch failed: ${res.status} ${url}\n${txt}`);
    }

    return res.json();
  }

  throw new Error(`${opts?.kind || "fetch"} failed after retries: ${url}`);
}

async function fetchRegionalJson(url: string, opts?: { retries?: number }) {
  return fetchJsonWithRetry(url, { retries: opts?.retries, kind: "regional" });
}

async function fetchPlatformJson(url: string, opts?: { retries?: number }) {
  return fetchJsonWithRetry(url, { retries: opts?.retries, kind: "platform" });
}

// -------------------------
// Match-v5 ids (regional) with filters
// -------------------------
async function getMatchIdsByPuuidFiltered(puuid: string, start: number, count: number): Promise<string[]> {
  const startTime = oldestAllowedUnix(DAYS_BACK);

  // Riot supports: queue, startTime, endTime, type
  // We’ll request one queue at a time then union.
  const all: string[] = [];

  for (const q of TIERS_QUEUE_IDS) {
    const url =
      `${riotRegionalBase()}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids` +
      `?start=${start}&count=${count}` +
      `&queue=${encodeURIComponent(String(q))}` +
      `&startTime=${encodeURIComponent(String(startTime))}`;

    const ids = (await fetchRegionalJson(url)) as any;
    if (Array.isArray(ids)) all.push(...ids.map(String));

    await sleep(GAP_MS);
  }

  return Array.from(new Set(all));
}

async function getMatch(matchId: string): Promise<any> {
  const cachePath = path.join(CACHE_MATCHES_DIR, `${matchId}.json`);
  try {
    const raw = await fs.readFile(cachePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    const url = `${riotRegionalBase()}/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
    const data = await fetchRegionalJson(url);
    await fs.writeFile(cachePath, JSON.stringify(data), "utf-8");
    await sleep(GAP_MS);
    return data;
  }
}

// ===============================
// ✅ Ladder bootstrap (league-v4 + summoner-v4 -> PUUIDs)
// (copied in spirit from your meta builds approach)
// ===============================
type LeagueEntryAny = Record<string, any>;
type LeagueList = {
  entries?: LeagueEntryAny[];
};

type SummonerDTO = {
  id?: string;
  puuid?: string;
  name?: string;
};

function pickFirstString(obj: any, keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

async function fetchLadderLeague(): Promise<LeagueList> {
  const base = riotPlatformBase();
  const queuePath = LADDER_QUEUE;

  let url: string;
  if (LADDER_TIER === "grandmaster") url = `${base}/lol/league/v4/grandmasterleagues/by-queue/${queuePath}`;
  else if (LADDER_TIER === "master") url = `${base}/lol/league/v4/masterleagues/by-queue/${queuePath}`;
  else url = `${base}/lol/league/v4/challengerleagues/by-queue/${queuePath}`;

  return (await fetchPlatformJson(url)) as LeagueList;
}

async function fetchSummonerById(encSummonerId: string): Promise<SummonerDTO> {
  const url = `${riotPlatformBase()}/lol/summoner/v4/summoners/${encodeURIComponent(encSummonerId)}`;
  return (await fetchPlatformJson(url)) as SummonerDTO;
}

async function ladderBootstrapPuuids(): Promise<string[]> {
  const league = await fetchLadderLeague();
  const entries = Array.isArray(league.entries) ? league.entries : [];

  console.log("[ladder] entries:", entries.length);
  console.log("[ladder] sample entry keys:", entries[0] ? Object.keys(entries[0] as any) : "NONE");

  // stable ordering (best-first)
  entries.sort((a, b) => Number(b?.leaguePoints || 0) - Number(a?.leaguePoints || 0));
  const top = entries.slice(0, Math.max(0, LADDER_MAX_PLAYERS));

  const puuids: string[] = [];
  let direct = 0;
  let viaSummoner = 0;
  let fail = 0;

  for (const e of top) {
    // ✅ many ladder responses now include puuid directly
    const directPuuid = pickFirstString(e, ["puuid", "playerPuuid", "player_puuid"]);
    if (directPuuid) {
      puuids.push(directPuuid);
      direct++;
      continue;
    }

    // fallback resolve using summonerId -> summoner-v4 -> puuid
    const sid = pickFirstString(e, [
      "summonerId",
      "summonerID",
      "encryptedSummonerId",
      "encryptedSummonerID",
      "summoner_id",
      "playerOrTeamId",
      "playerOrTeamID",
      "player_or_team_id",
      "id",
    ]);

    if (!sid) {
      fail++;
      continue;
    }

    try {
      const dto = await fetchSummonerById(sid);
      const pu = String(dto?.puuid || "").trim();
      if (pu) {
        puuids.push(pu);
        viaSummoner++;
      } else {
        fail++;
      }
    } catch {
      fail++;
    }

    await sleep(GAP_MS);
  }

  const unique = Array.from(new Set(puuids));
  console.log(`[ladder] puuids: unique=${unique.length} direct=${direct} viaSummoner=${viaSummoner} fail=${fail}`);

  if (!unique.length) {
    throw new Error("[ladder] bootstrap produced 0 PUUIDs. Check RIOT_PLATFORM, LADDER_TIER, LADDER_QUEUE.");
  }

  return unique;
}

async function main() {
  assertEnv();
  await ensureDirs();

  let seenMatchIds = await readJson<SeenMatchIdsState>(SEEN_MATCH_IDS_PATH);
  let seenPuuidsState = await readJson<SeenPuuidsState>(SEEN_PUUIDS_PATH);
  let puuidCursors = await readJson<PuuidCursors>(PUUID_CURSORS_PATH);

  const seenMatches = new Set<string>(seenMatchIds.ids || []);
  const seenPuuids = new Set<string>(seenPuuidsState.puuids || []);

  // ✅ Bootstrap PUUID queue from ladder
  const puuidQueue: string[] = [];
  const bootstrapPuuids = new Set<string>();

  const ladderPuuids = await ladderBootstrapPuuids();
  for (const pu of ladderPuuids) {
    bootstrapPuuids.add(pu);
    puuidQueue.push(pu);
  }

  console.log(`[bootstrap] queue initialized: ${puuidQueue.length} puuids`);

  let newPuuidsAdded = 0;
  let matchesProcessed = 0;

  while (puuidQueue.length > 0) {
    if (matchesProcessed >= MAX_MATCHES_PER_RUN) break;

    const puuid = puuidQueue.shift()!;
    const isBootstrap = bootstrapPuuids.has(puuid);

    // If not bootstrap, only process once.
    if (!isBootstrap && seenPuuids.has(puuid)) continue;

    // If bootstrap, process again only when you allow it.
    if (isBootstrap && !REPROCESS_BOOTSTRAP && seenPuuids.has(puuid)) continue;

    const start = Number(puuidCursors[puuid] || 0);

    let matchIds: string[] = [];
    try {
      matchIds = await getMatchIdsByPuuidFiltered(puuid, start, MATCHES_PER_PUUID);
    } catch (e: any) {
      console.warn(`Failed match ids for PUUID ${puuid.slice(0, 8)}…: ${e?.message || e}`);
      // still mark seen so we don't spin forever
      seenPuuids.add(puuid);
      continue;
    } finally {
      seenPuuids.add(puuid);
    }

    puuidCursors[puuid] = start + MATCHES_PER_PUUID;
    if (!matchIds.length) continue;

    for (const matchId of matchIds) {
      if (matchesProcessed >= MAX_MATCHES_PER_RUN) break;
      if (seenMatches.has(matchId)) continue;

      seenMatches.add(matchId);

      let match: any;
      try {
        match = await getMatch(matchId);
      } catch (e: any) {
        console.warn(`Failed match ${matchId}: ${e?.message || e}`);
        continue;
      }

      const info = match?.info;
      if (!info) continue;

      // ✅ snowball: add participant puuids for exploration
      const parts: any[] = Array.isArray(info?.participants) ? info.participants : [];
      matchesProcessed += 1;

      if (newPuuidsAdded < MAX_NEW_PUUIDS_PER_RUN) {
        for (const pt of parts) {
          const newP = String(pt?.puuid || "").trim();
          if (!newP) continue;
          if (seenPuuids.has(newP)) continue;
          puuidQueue.push(newP);
          newPuuidsAdded++;
          if (newPuuidsAdded >= MAX_NEW_PUUIDS_PER_RUN) break;
        }
      }
    }
  }

  await writeJson(SEEN_MATCH_IDS_PATH, { ids: Array.from(seenMatches) } satisfies SeenMatchIdsState);
  await writeJson(SEEN_PUUIDS_PATH, { puuids: Array.from(seenPuuids) } satisfies SeenPuuidsState);
  await writeJson(PUUID_CURSORS_PATH, puuidCursors);

  console.log("Done.");
  console.log(`Processed matches this run: ${matchesProcessed} (budget=${MAX_MATCHES_PER_RUN})`);
  console.log(`Added new PUUIDs this run: ${newPuuidsAdded} (cap=${MAX_NEW_PUUIDS_PER_RUN})`);
  console.log(`Cache dir: ${CACHE_DIR}`);
  console.log(`Finalize will write: ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
