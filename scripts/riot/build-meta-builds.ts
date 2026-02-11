// scripts/riot/build-meta-builds.ts
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

type Json = Record<string, any>;

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, "scripts", "riot", "cache");
const CACHE_MATCHES_DIR = path.join(CACHE_DIR, "matches");
const CACHE_TIMELINES_DIR = path.join(CACHE_DIR, "timelines");
const CACHE_STATE_DIR = path.join(CACHE_DIR, "state");

const SEEN_MATCH_IDS_PATH = path.join(CACHE_STATE_DIR, "seen_match_ids.json");
const SEEN_PUUIDS_PATH = path.join(CACHE_STATE_DIR, "seen_puuids.json");
const AGG_STATE_PATH = path.join(CACHE_STATE_DIR, "agg_state.json");
const PUUID_CURSORS_PATH = path.join(CACHE_STATE_DIR, "puuid_cursors.json");

const OUT_RANKED_PATH = path.join(ROOT, "public", "data", "lol", "meta_builds_ranked.json");
const OUT_CASUAL_PATH = path.join(ROOT, "public", "data", "lol", "meta_builds_casual.json");

// env
const RIOT_API_KEY = process.env.RIOT_API_KEY || "";

// ✅ regional (match-v5 + account-v1)
const RIOT_REGION = (process.env.RIOT_REGION || "americas").trim();

// ✅ platform (league-v4 + summoner-v4)
const RIOT_PLATFORM = (process.env.RIOT_PLATFORM || "na1").trim();

const MAX_MATCHES_PER_RUN = Number(process.env.MAX_MATCHES_PER_RUN || 2500);
const MAX_NEW_PUUIDS_PER_RUN = Number(process.env.MAX_NEW_PUUIDS_PER_RUN || 250);
const MATCHES_PER_PUUID = Number(process.env.MATCHES_PER_PUUID || 20);

const USE_TIMELINE = String(process.env.USE_TIMELINE || "0") === "1";
const MIN_SAMPLE = Number(process.env.MIN_SAMPLE || 200);
const MIN_DISPLAY_SAMPLE = Number(process.env.MIN_DISPLAY_SAMPLE || 25);

const BAYES_K = Number(process.env.BAYES_K || 100);
const PRIOR_WINRATE = Number(process.env.PRIOR_WINRATE || 0.5);

const PATCH_MAJOR_MINOR_ONLY = String(process.env.PATCH_MAJOR_MINOR_ONLY || "1") !== "0";

// cache scan / fallback knobs
const CACHE_SCAN_LIMIT = Number(process.env.CACHE_SCAN_LIMIT || 0);
const ALLOW_LOW_SAMPLE_FALLBACK = String(process.env.ALLOW_LOW_SAMPLE_FALLBACK || "0") === "1";

// ✅ CHECKPOINTS (new)
const CHECKPOINT_EVERY = Number(process.env.CHECKPOINT_EVERY || 100);

// ✅ Ladder bootstrap knobs
type LadderQueue = "RANKED_SOLO_5x5" | "RANKED_FLEX_SR";
const LADDER_QUEUE = (process.env.LADDER_QUEUE || "RANKED_SOLO_5x5").trim() as LadderQueue;

type LadderTier = "challenger" | "grandmaster" | "master";
const LADDER_TIER = (process.env.LADDER_TIER || "challenger").trim().toLowerCase() as LadderTier;

const LADDER_MAX_PLAYERS = Number(process.env.LADDER_MAX_PLAYERS || 250);
const REPROCESS_BOOTSTRAP = String(process.env.REPROCESS_BOOTSTRAP || "0") === "1";

// ✅ STRICT RECENCY WINDOW (days)
const CACHE_MAX_AGE_DAYS = Number(process.env.CACHE_MAX_AGE_DAYS || 90);
const NOW_SEC = Math.floor(Date.now() / 1000);
const START_TIME_SEC = NOW_SEC - CACHE_MAX_AGE_DAYS * 24 * 60 * 60;

// ✅ ms cutoff for strict gameCreation check
const CUTOFF_MS = Date.now() - CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

// ✅ optional: seed via match ids/urls (regional-only)
const SEED_MATCH_IDS = String(process.env.SEED_MATCH_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SEED_MATCH_URLS = String(process.env.SEED_MATCH_URLS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// reset knobs
const RESET_SEEN_MATCHES = String(process.env.RESET_SEEN_MATCHES || "0") === "1";
const RESET_SEEN_PUUIDS = String(process.env.RESET_SEEN_PUUIDS || "0") === "1";
const RESET_CURSORS = String(process.env.RESET_CURSORS || "0") === "1";

console.log(
  "[env] RIOT_API_KEY:",
  process.env.RIOT_API_KEY ? `present len=${process.env.RIOT_API_KEY.length}` : "MISSING"
);
console.log("[env] RIOT_REGION (match-v5):", RIOT_REGION);
console.log("[env] RIOT_PLATFORM (league/summoner):", RIOT_PLATFORM);
console.log("[env] LADDER_TIER/QUEUE/MAX:", LADDER_TIER, LADDER_QUEUE, LADDER_MAX_PLAYERS);
console.log("[env] Seed extras: SEED_MATCH_IDS:", SEED_MATCH_IDS.length, "SEED_MATCH_URLS:", SEED_MATCH_URLS.length);
console.log(`[env] STRICT WINDOW: CACHE_MAX_AGE_DAYS=${CACHE_MAX_AGE_DAYS} startTime=${START_TIME_SEC} cutoff=${new Date(CUTOFF_MS).toISOString()}`);

const QUEUE_RANKED = 420;
const QUEUES_CASUAL = new Set<number>([400, 430]);

type SeenMatchIdsState = { ids: string[] };
type SeenPuuidsState = { puuids: string[] };
type PuuidCursors = Record<string, number>;

type AggBucket = {
  games: number;
  wins: number;
  boots: number | null;
  core: number[];
  lastSeenAt: number;
};

type AggState = {
  [patch: string]: {
    [queue: string]: {
      [champId: string]: {
        [role: string]: {
          [buildSig: string]: AggBucket;
        };
      };
    };
  };
};

type Role = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";

// ✅ CHECKPOINTS: globals + helpers (new)
let shutdownRequested = false;
let gSeenMatches: Set<string> | null = null;
let gSeenPuuids: Set<string> | null = null;
let gPuuidCursors: PuuidCursors | null = null;
let gAgg: AggState | null = null;
let gLastCheckpointMatches = 0;

async function persistState(reason: string) {
  if (!gSeenMatches || !gSeenPuuids || !gPuuidCursors || !gAgg) return;

  try {
    await writeJson(SEEN_MATCH_IDS_PATH, { ids: Array.from(gSeenMatches) } satisfies SeenMatchIdsState);
    await writeJson(SEEN_PUUIDS_PATH, { puuids: Array.from(gSeenPuuids) } satisfies SeenPuuidsState);
    await writeJson(PUUID_CURSORS_PATH, gPuuidCursors);
    await writeJson(AGG_STATE_PATH, gAgg);
    console.log(`[checkpoint] persisted (${reason}) matches=${gSeenMatches.size} puuids=${gSeenPuuids.size}`);
  } catch (e: any) {
    console.warn(`[checkpoint] persist failed (${reason}): ${e?.message || e}`);
  }
}

async function handleSignal(sig: string) {
  if (shutdownRequested) return;
  shutdownRequested = true;
  console.log(`[signal] ${sig} received. Flushing checkpoint...`);
  await persistState(`signal:${sig}`);
  process.exit(0);
}

// Register signal handlers once
process.on("SIGTERM", () => void handleSignal("SIGTERM"));
process.on("SIGINT", () => void handleSignal("SIGINT"));

function assertEnv() {
  if (!RIOT_API_KEY || !RIOT_API_KEY.startsWith("RGAPI-")) {
    throw new Error("Missing/invalid RIOT_API_KEY. Put it in .env.local as RIOT_API_KEY=RGAPI-...");
  }
}

async function ensureDirs() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.mkdir(CACHE_MATCHES_DIR, { recursive: true });
  await fs.mkdir(CACHE_TIMELINES_DIR, { recursive: true });
  await fs.mkdir(CACHE_STATE_DIR, { recursive: true });

  await ensureJson(SEEN_MATCH_IDS_PATH, { ids: [] } satisfies SeenMatchIdsState);
  await ensureJson(SEEN_PUUIDS_PATH, { puuids: [] } satisfies SeenPuuidsState);
  await ensureJson(AGG_STATE_PATH, {} satisfies AggState);
  await ensureJson(PUUID_CURSORS_PATH, {} satisfies PuuidCursors);

  await fs.mkdir(path.dirname(OUT_RANKED_PATH), { recursive: true });
  await fs.mkdir(path.dirname(OUT_CASUAL_PATH), { recursive: true });
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

async function pruneCacheByMtime(dir: string, maxAgeDays: number) {
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - maxAgeMs;

  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return;
  }

  let removed = 0;
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    const fp = path.join(dir, name);
    try {
      const st = await fs.stat(fp);
      if (st.mtimeMs < cutoff) {
        await fs.unlink(fp);
        removed++;
      }
    } catch {
      // ignore
    }
  }

  console.log(`[cache] Pruned ${removed} files from ${dir} older than ${maxAgeDays} days`);
}

function riotRegionalBase() {
  return `https://${RIOT_REGION}.api.riotgames.com`;
}

function riotPlatformBase() {
  return `https://${RIOT_PLATFORM}.api.riotgames.com`;
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
        "User-Agent": "GamerStation (meta build pipeline)",
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

// Match-v5 ids (regional, paged)
async function getMatchIdsByPuuidPaged(puuid: string, start: number, count: number): Promise<string[]> {
  const base =
    `${riotRegionalBase()}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids` +
    `?start=${start}&count=${count}` +
    `&startTime=${START_TIME_SEC}`;

  const url = base;

  const ids = (await fetchRegionalJson(url)) as any;
  return Array.isArray(ids) ? ids.map(String) : [];
}

// ✅ read cache if present; if fetching, only write cache if opts.cacheWrite === true
async function getMatch(matchId: string, opts?: { cacheWrite?: boolean }): Promise<any> {
  const cachePath = path.join(CACHE_MATCHES_DIR, `${matchId}.json`);
  try {
    const raw = await fs.readFile(cachePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    const url = `${riotRegionalBase()}/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
    const data = await fetchRegionalJson(url);
    if (opts?.cacheWrite) {
      await fs.writeFile(cachePath, JSON.stringify(data), "utf-8");
    }
    return data;
  }
}

async function getTimeline(matchId: string): Promise<any> {
  const cachePath = path.join(CACHE_TIMELINES_DIR, `${matchId}.json`);
  try {
    const raw = await fs.readFile(cachePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    const url = `${riotRegionalBase()}/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`;
    const data = await fetchRegionalJson(url);
    await fs.writeFile(cachePath, JSON.stringify(data), "utf-8");
    return data;
  }
}

function patchFromGameVersion(gameVersion: string): string {
  const s = String(gameVersion || "").trim();
  if (!s) return "unknown";
  if (!PATCH_MAJOR_MINOR_ONLY) return s;
  const parts = s.split(".");
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`;
  return s;
}

function normalizeRole(teamPosition: any): Role | null {
  const r = String(teamPosition || "").toUpperCase();
  if (r === "TOP") return "TOP";
  if (r === "JUNGLE") return "JUNGLE";
  if (r === "MIDDLE" || r === "MID") return "MIDDLE";
  if (r === "BOTTOM" || r === "BOT") return "BOTTOM";
  if (r === "UTILITY" || r === "SUPPORT") return "UTILITY";
  return null;
}

function extractFinalItems(participant: any): number[] {
  const items: number[] = [];
  for (let i = 0; i <= 6; i++) {
    const v = Number(participant?.[`item${i}`] || 0);
    if (v && Number.isFinite(v) && v > 0) items.push(v);
  }
  return items;
}

const BOOT_IDS = new Set<number>([1001, 3006, 3009, 3020, 3047, 3111, 3158, 2422, 3117]);

function bootsFromFinal(items: number[]): number | null {
  for (const it of items) if (BOOT_IDS.has(it)) return it;
  return null;
}

function coreFromFinal(items: number[], boots: number | null): number[] {
  const filtered = items.filter((x) => x !== boots);
  const blacklist = new Set<number>([2003, 2031, 2055, 2140, 3364, 3363, 3340, 2138, 2139]);
  const clean = filtered.filter((x) => !blacklist.has(x));
  const uniq = Array.from(new Set(clean));
  uniq.sort((a, b) => a - b);
  return uniq.slice(0, 3);
}

type OrderedBuild = { boots: number | null; core: number[] };

function buildFromTimeline(match: any, timeline: any, participant: any): OrderedBuild {
  const consumableBlacklist = new Set<number>([2003, 2031, 2055, 2140, 3364, 3363, 3340, 2138, 2139]);

  const puuid = String(participant?.puuid || "");
  const meta = timeline?.metadata;
  const frames = timeline?.info?.frames;
  if (!puuid || !meta || !Array.isArray(frames)) {
    const finalItems = extractFinalItems(participant);
    const boots = bootsFromFinal(finalItems);
    const core = coreFromFinal(finalItems, boots);
    return { boots, core };
  }

  const participantsPuuid: string[] = Array.isArray(meta?.participants) ? meta.participants : [];
  const participantIdx = participantsPuuid.indexOf(puuid);
  const participantId = participantIdx >= 0 ? participantIdx + 1 : null;
  if (!participantId) {
    const finalItems = extractFinalItems(participant);
    const boots = bootsFromFinal(finalItems);
    const core = coreFromFinal(finalItems, boots);
    return { boots, core };
  }

  let boots: number | null = null;
  const core: number[] = [];
  const seenCore = new Set<number>();

  for (const frame of frames) {
    const events = frame?.events;
    if (!Array.isArray(events)) continue;

    for (const ev of events) {
      if (ev?.type !== "ITEM_PURCHASED") continue;
      if (Number(ev?.participantId) !== participantId) continue;

      const itemId = Number(ev?.itemId || 0);
      if (!itemId || consumableBlacklist.has(itemId)) continue;

      if (!boots && BOOT_IDS.has(itemId)) {
        boots = itemId;
        continue;
      }

      if (!BOOT_IDS.has(itemId) && itemId !== boots && !seenCore.has(itemId)) {
        seenCore.add(itemId);
        core.push(itemId);
        if (core.length >= 3) return { boots, core };
      }
    }
  }

  const finalItems = extractFinalItems(participant);
  if (!boots) boots = bootsFromFinal(finalItems);

  if (core.length < 3) {
    const fill = coreFromFinal(finalItems, boots);
    for (const it of fill) {
      if (core.length >= 3) break;
      if (!seenCore.has(it)) core.push(it);
    }
  }

  return { boots, core: core.slice(0, 3) };
}

function buildSig(boots: number | null, core: number[]): string {
  const b = boots ? String(boots) : "0";
  const c = core.map(String).join("-");
  return `b${b}|c${c}`;
}

function incAgg(
  agg: AggState,
  patch: string,
  queueId: number,
  champId: string,
  role: Role,
  sig: string,
  boots: number | null,
  core: number[],
  win: boolean
) {
  agg[patch] ||= {};
  agg[patch]![String(queueId)] ||= {};
  agg[patch]![String(queueId)]![champId] ||= {};
  agg[patch]![String(queueId)]![champId]![role] ||= {};
  const bucket = agg[patch]![String(queueId)]![champId]![role]!;
  bucket[sig] ||= { games: 0, wins: 0, boots, core, lastSeenAt: Date.now() };
  bucket[sig]!.games += 1;
  bucket[sig]!.wins += win ? 1 : 0;
  bucket[sig]!.boots = boots;
  bucket[sig]!.core = core;
  bucket[sig]!.lastSeenAt = Date.now();
}

function bayesWr(wins: number, games: number) {
  if (games <= 0) return 0;
  return (wins + BAYES_K * PRIOR_WINRATE) / (games + BAYES_K);
}

async function scanCacheAndIngest(agg: AggState) {
  let files = await fs.readdir(CACHE_MATCHES_DIR).catch(() => []);
  files = files.filter((f) => f.endsWith(".json"));
  files.sort((a, b) => b.localeCompare(a));

  const limit = CACHE_SCAN_LIMIT > 0 ? Math.min(CACHE_SCAN_LIMIT, files.length) : files.length;
  console.log(`Cache rebuild: scanned ${limit} matches...`);

  let ingested = 0;
  let skippedOldOrNoCreation = 0;

  for (let i = 0; i < limit; i++) {
    const f = files[i]!;
    const p = path.join(CACHE_MATCHES_DIR, f);

    let match: any;
    try {
      match = JSON.parse(await fs.readFile(p, "utf-8"));
    } catch {
      continue;
    }

    const info = match?.info;
    if (!info) continue;

    // ✅ STRICT window on cache ingest too
    const created = Number(info?.gameCreation || 0);
    if (!created || created < CUTOFF_MS) {
      skippedOldOrNoCreation += 1;
      continue;
    }

    const queueId = Number(info?.queueId || 0);
    if (!shouldIngestQueue(queueId)) continue;

    const patch = patchFromGameVersion(info?.gameVersion || "");
    const participants: any[] = Array.isArray(info?.participants) ? info.participants : [];
    if (!participants.length) continue;

    let timeline: any = null;
    if (USE_TIMELINE) {
      const matchId = String(match?.metadata?.matchId || f.replace(".json", ""));
      try {
        timeline = await getTimeline(matchId);
      } catch {
        timeline = null;
      }
    }

    for (const pt of participants) {
      const champId = String(pt?.championId ?? "");
      if (!champId || champId === "0") continue;

      const role = normalizeRole(pt?.teamPosition);
      if (!role) continue;

      const win = Boolean(pt?.win);

      let boots: number | null = null;
      let core: number[] = [];

      if (USE_TIMELINE && timeline) {
        const b = buildFromTimeline(match, timeline, pt);
        boots = b.boots;
        core = b.core;
      } else {
        const finalItems = extractFinalItems(pt);
        boots = bootsFromFinal(finalItems);
        core = coreFromFinal(finalItems, boots);
      }

      if (!Array.isArray(core) || core.length === 0) continue;

      const sig = buildSig(boots, core);
      incAgg(agg, patch, queueId, champId, role, sig, boots, core, win);
    }

    ingested++;
  }

  if (skippedOldOrNoCreation) {
    console.log(`[cache] Skipped ${skippedOldOrNoCreation} cached matches due to strict age/no gameCreation.`);
  }

  return ingested;
}

function shouldIngestQueue(queueId: number) {
  return queueId === QUEUE_RANKED || QUEUES_CASUAL.has(queueId);
}

function parseMatchIdsFromUrls(urls: string[]): string[] {
  const ids: string[] = [];
  for (const u of urls) {
    const m = u.match(/([A-Z]{2,4}1?_\d{6,})/);
    if (m?.[1]) ids.push(m[1]);
  }
  return ids;
}

async function seedPuuidsFromMatchIds(matchIds: string[]): Promise<string[]> {
  const puuids: string[] = [];

  for (const mid of matchIds) {
    try {
      // ✅ do not cache these unless they pass strict filter (handled below in main loop)
      const match = await getMatch(mid, { cacheWrite: false });
      const parts: any[] = Array.isArray(match?.info?.participants) ? match.info.participants : [];
      for (const p of parts) {
        const pu = String(p?.puuid || "").trim();
        if (pu) puuids.push(pu);
      }
    } catch (e: any) {
      console.warn(`Seed match fetch failed ${mid}: ${e?.message || e}`);
    }
  }

  return Array.from(new Set(puuids));
}

// ===============================
// ✅ Ladder bootstrap (league-v4 + summoner-v4 -> PUUIDs)
// ===============================
type LeagueEntryAny = Record<string, any>;

type LeagueList = {
  tier?: string;
  name?: string;
  queue?: string;
  entries?: LeagueEntryAny[];
};

type SummonerDTO = {
  id?: string;
  puuid?: string;
  name?: string;
};

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

async function fetchSummonerByName(summonerName: string): Promise<SummonerDTO> {
  const url = `${riotPlatformBase()}/lol/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}`;
  return (await fetchPlatformJson(url)) as SummonerDTO;
}

function pickFirstString(obj: any, keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

async function ladderBootstrapPuuids(): Promise<string[]> {
  const league = await fetchLadderLeague();
  const entries = Array.isArray(league.entries) ? league.entries : [];

  console.log("[ladder] league keys:", league ? Object.keys(league as any) : "NONE");
  console.log("[ladder] entries length:", entries.length);
  console.log("[ladder] sample entry keys:", entries[0] ? Object.keys(entries[0] as any) : "NONE");
  console.log("[ladder] sample entry:", entries[0] ?? null);

  entries.sort((a, b) => Number(b?.leaguePoints || 0) - Number(a?.leaguePoints || 0));
  const top = entries.slice(0, Math.max(0, LADDER_MAX_PLAYERS));

  console.log(
    `[ladder] ${LADDER_TIER} ${LADDER_QUEUE}: entries=${entries.length}, using=${top.length} (top LP)`
  );

  const puuids: string[] = [];
  let ok = 0;
  let fail = 0;
  let missingId = 0;
  let missingName = 0;
  let usedByName = 0;

  let loggedSample = false;

  for (const anyE of top) {
    const directPuuid = pickFirstString(anyE, ["puuid", "playerPuuid", "player_puuid"]);
    if (directPuuid) {
      puuids.push(directPuuid);
      ok++;
      continue;
    }

    const sid = pickFirstString(anyE, [
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

    const sname = pickFirstString(anyE, [
      "summonerName",
      "summonername",
      "summoner_name",
      "playerOrTeamName",
      "player_or_team_name",
      "name",
    ]);

    if (!sid && !sname) {
      missingId++;
      missingName++;
      if (!loggedSample) {
        loggedSample = true;
        console.warn("[ladder] entry missing BOTH puuid + (id/name). Full sample:", anyE);
        console.warn("[ladder] entry keys:", Object.keys(anyE || {}));
      }
      continue;
    }

    try {
      let dto: SummonerDTO | null = null;

      if (sid) dto = await fetchSummonerById(sid);
      else {
        usedByName++;
        dto = await fetchSummonerByName(sname);
      }

      const pu = String(dto?.puuid || "").trim();
      if (pu) {
        puuids.push(pu);
        ok++;
      } else {
        fail++;
      }
    } catch (err: any) {
      fail++;
      console.warn(`[ladder] summoner resolve failed: ${sname || sid}: ${err?.message || err}`);
    }
  }

  const unique = Array.from(new Set(puuids));

  console.log(
    `[ladder] puuids resolved: ok=${ok} fail=${fail} missingId=${missingId} missingName=${missingName} byName=${usedByName} unique=${unique.length}`
  );

  if (unique.length === 0) {
    throw new Error(
      `[ladder] bootstrap produced 0 PUUIDs. Your ladder entries contain neither "puuid" nor any resolvable summoner id/name.`
    );
  }

  return unique;
}

// ===============================
// Main
// ===============================

async function main() {
  assertEnv();
  await ensureDirs();

  await pruneCacheByMtime(CACHE_MATCHES_DIR, CACHE_MAX_AGE_DAYS);
  if (USE_TIMELINE) {
    await pruneCacheByMtime(CACHE_TIMELINES_DIR, CACHE_MAX_AGE_DAYS);
  }

  let seenMatchIds = await readJson<SeenMatchIdsState>(SEEN_MATCH_IDS_PATH);
  let seenPuuidsState = await readJson<SeenPuuidsState>(SEEN_PUUIDS_PATH);
  const agg = await readJson<AggState>(AGG_STATE_PATH);
  let puuidCursors = await readJson<PuuidCursors>(PUUID_CURSORS_PATH);

  if (RESET_SEEN_MATCHES) seenMatchIds = { ids: [] };
  if (RESET_SEEN_PUUIDS) seenPuuidsState = { puuids: [] };
  if (RESET_CURSORS) puuidCursors = {};

  const seenMatches = new Set<string>(seenMatchIds.ids || []);
  const seenPuuids = new Set<string>(seenPuuidsState.puuids || []);

  // ✅ CHECKPOINTS: wire globals (new)
  gSeenMatches = seenMatches;
  gSeenPuuids = seenPuuids;
  gPuuidCursors = puuidCursors;
  gAgg = agg;

  const cacheIngested = await scanCacheAndIngest(agg);
  console.log(`Ingested cached matches this run: ${cacheIngested}`);

  // ✅ Bootstrap PUUID queue from ladder instead of seeds.json
  const puuidQueue: string[] = [];
  const bootstrapPuuids = new Set<string>();

  try {
    const ladderPuuids = await ladderBootstrapPuuids();
    for (const pu of ladderPuuids) {
      bootstrapPuuids.add(pu);
      puuidQueue.push(pu);
    }
  } catch (e: any) {
    console.warn(
      `[ladder] bootstrap failed: ${e?.message || e}\n` +
        "You can still seed via SEED_MATCH_IDS / SEED_MATCH_URLS if ladder endpoints are blocked."
    );
  }

  // Optional backup seeding from match ids/urls
  const fromUrls = parseMatchIdsFromUrls(SEED_MATCH_URLS);
  const matchSeedIds = Array.from(new Set([...SEED_MATCH_IDS, ...fromUrls]));
  if (matchSeedIds.length) {
    console.log(`Seeding from ${matchSeedIds.length} match ids (regional match-v5)...`);
    const puuids = await seedPuuidsFromMatchIds(matchSeedIds);
    console.log(`Seeded ${puuids.length} unique puuids from match ids.`);
    for (const pu of puuids) {
      bootstrapPuuids.add(pu);
      puuidQueue.push(pu);
    }
  }

  // dedupe queue
  const uniqueQueue = Array.from(new Set(puuidQueue));
  puuidQueue.length = 0;
  puuidQueue.push(...uniqueQueue);

  console.log(`Bootstrap queue initialized with ${puuidQueue.length} puuids.`);
  if (!puuidQueue.length) {
    console.log(
      "No bootstrap seeds available. Set RIOT_PLATFORM + LADDER_TIER/LADDER_QUEUE, or provide SEED_MATCH_IDS/SEED_MATCH_URLS."
    );
  }

  let newPuuidsAdded = 0;
  let matchesProcessed = 0;

  const strictDebug = {
    skippedNoGameCreation: 0,
    skippedOldByGameCreation: 0,
    skippedNotTrackedQueue: 0,
    skippedNoInfoOrMeta: 0,
    skippedNoParticipants: 0,
    skippedSeen: 0,
    cachedWritten: 0,
  };

  while (puuidQueue.length > 0) {
    if (shutdownRequested) break; // ✅ CHECKPOINTS (new)
    if (matchesProcessed >= MAX_MATCHES_PER_RUN) break;

    const puuid = puuidQueue.shift()!;
    const isBootstrap = bootstrapPuuids.has(puuid);

    if (!isBootstrap && seenPuuids.has(puuid)) continue;
    if (isBootstrap && !REPROCESS_BOOTSTRAP && seenPuuids.has(puuid)) continue;

    const start = Number(puuidCursors[puuid] || 0);

    let matchIds: string[] = [];
    try {
      matchIds = await getMatchIdsByPuuidPaged(puuid, start, MATCHES_PER_PUUID);
    } catch (e: any) {
      console.warn(`Failed match ids for PUUID ${puuid.slice(0, 8)}…: ${e?.message || e}`);
      continue;
    } finally {
      seenPuuids.add(puuid);
    }

    puuidCursors[puuid] = start + MATCHES_PER_PUUID;
    if (!matchIds.length) continue;

    for (const matchId of matchIds) {
      if (shutdownRequested) break; // ✅ CHECKPOINTS (new)
      if (matchesProcessed >= MAX_MATCHES_PER_RUN) break;

      if (seenMatches.has(matchId)) {
        strictDebug.skippedSeen += 1;
        continue;
      }

      // ✅ IMPORTANT: do NOT mark seen yet — fetch + validate first
      let match: any;
      try {
        match = await getMatch(matchId, { cacheWrite: false }); // write only after strict filter passes
      } catch (e: any) {
        console.warn(`Failed match ${matchId}: ${e?.message || e}`);
        continue;
      }

      const info = match?.info;
      const metadata = match?.metadata;
      if (!info || !metadata) {
        strictDebug.skippedNoInfoOrMeta += 1;
        continue;
      }

      // ✅ STRICT RECENCY FILTER (the one you asked for):
      // Drop if missing gameCreation OR older than cutoff.
      const created = Number(info?.gameCreation || 0);
      if (!created) {
        strictDebug.skippedNoGameCreation += 1;
        continue;
      }
      if (created < CUTOFF_MS) {
        strictDebug.skippedOldByGameCreation += 1;
        continue;
      }

      const queueId = Number(info?.queueId || 0);
      if (!shouldIngestQueue(queueId)) {
        strictDebug.skippedNotTrackedQueue += 1;
        continue;
      }

      const participants: any[] = Array.isArray(info?.participants) ? info.participants : [];
      if (!participants.length) {
        strictDebug.skippedNoParticipants += 1;
        continue;
      }

      // ✅ NOW that it’s valid, cache it + mark seen
      try {
        const cachePath = path.join(CACHE_MATCHES_DIR, `${matchId}.json`);
        await fs.writeFile(cachePath, JSON.stringify(match), "utf-8");
        strictDebug.cachedWritten += 1;
      } catch {
        // ignore cache write failures
      }

      seenMatches.add(matchId);

      const patch = patchFromGameVersion(info?.gameVersion || "");

      let timeline: any = null;
      if (USE_TIMELINE) {
        try {
          timeline = await getTimeline(matchId);
        } catch {
          timeline = null;
        }
      }

      for (const pt of participants) {
        const champId = String(pt?.championId ?? "");
        if (!champId || champId === "0") continue;

        const role = normalizeRole(pt?.teamPosition);
        if (!role) continue;

        const win = Boolean(pt?.win);

        let boots: number | null = null;
        let core: number[] = [];

        if (USE_TIMELINE && timeline) {
          const b = buildFromTimeline(match, timeline, pt);
          boots = b.boots;
          core = b.core;
        } else {
          const finalItems = extractFinalItems(pt);
          boots = bootsFromFinal(finalItems);
          core = coreFromFinal(finalItems, boots);
        }

        if (!Array.isArray(core) || core.length === 0) continue;

        const sig = buildSig(boots, core);
        incAgg(agg, patch, queueId, champId, role, sig, boots, core, win);
      }

      matchesProcessed += 1;

      // ✅ CHECKPOINTS: flush every N matches (new)
      if (CHECKPOINT_EVERY > 0 && matchesProcessed - gLastCheckpointMatches >= CHECKPOINT_EVERY) {
        gLastCheckpointMatches = matchesProcessed;
        await persistState(`every:${CHECKPOINT_EVERY}`);
      }

      if (newPuuidsAdded < MAX_NEW_PUUIDS_PER_RUN) {
        for (const pt of participants) {
          const newP = String(pt?.puuid || "").trim();
          if (!newP) continue;
          if (seenPuuids.has(newP)) continue;
          puuidQueue.push(newP);
          newPuuidsAdded += 1;
          if (newPuuidsAdded >= MAX_NEW_PUUIDS_PER_RUN) break;
        }
      }
    }
  }

  console.log("[strict] DEBUG:", strictDebug);

  // ✅ CHECKPOINTS: final flush (new)
  await persistState("end");

  await writeJson(SEEN_MATCH_IDS_PATH, { ids: Array.from(seenMatches) } satisfies SeenMatchIdsState);
  await writeJson(SEEN_PUUIDS_PATH, { puuids: Array.from(seenPuuids) } satisfies SeenPuuidsState);
  await writeJson(PUUID_CURSORS_PATH, puuidCursors);
  await writeJson(AGG_STATE_PATH, agg);

  console.log("Done.");
  console.log(`Processed matches this run: ${matchesProcessed} (budget=${MAX_MATCHES_PER_RUN})`);
  console.log(`Added new PUUIDs this run: ${newPuuidsAdded} (cap=${MAX_NEW_PUUIDS_PER_RUN})`);
  console.log(`Wrote: ${OUT_RANKED_PATH}`);
  console.log(`Wrote: ${OUT_CASUAL_PATH}`);
  console.log(`Cache dir: ${CACHE_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
