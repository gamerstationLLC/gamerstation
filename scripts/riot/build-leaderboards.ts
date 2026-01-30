// scripts/riot/build-leaderboards.ts
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

type RegionKey = "na1" | "euw1" | "kr";
type RegionalKey = "americas" | "europe" | "asia";
type QueueKey = "RANKED_SOLO_5x5" | "RANKED_FLEX_SR";
type TierKey = "CHALLENGER" | "GRANDMASTER" | "MASTER";

const RIOT_API_KEY = process.env.RIOT_API_KEY;
if (!RIOT_API_KEY) throw new Error("Missing RIOT_API_KEY in .env.local");

const REGIONS: RegionKey[] = ["na1", "euw1", "kr"];
const QUEUES: QueueKey[] = ["RANKED_SOLO_5x5", "RANKED_FLEX_SR"];
const TIERS: TierKey[] = ["CHALLENGER", "GRANDMASTER", "MASTER"];

// -------------------------
// Tuning (anti-429 defaults)
const RETRY_MAX = 6;
const REQUEST_TIMEOUT_MS = 12_000;

// Top N players to output per leaderboard
const TOP_N = Number(process.env.LEADERBOARD_TOP_N || "") || 100;

// How many workers to enrich players
const CONCURRENCY = Number(process.env.LEADERBOARD_CONCURRENCY || "") || 1;

// Extra gap after each enrich attempt (ms)
const GAP_MS = Number(process.env.LEADERBOARD_GAP_MS || "") || 1200;

// How many recent match IDs to try for getting riotIdGameName/tagline
const MATCH_IDS_COUNT = Number(process.env.LEADERBOARD_MATCH_IDS_COUNT || "") || 2;

// how many recent matches to compute "Most Played" champs from
const TOP_CHAMPS_MATCH_COUNT = Number(process.env.LEADERBOARD_TOP_CHAMPS_MATCH_COUNT || "") || 6;

// Global per-request minimum spacing (ms)
const REQ_MIN_GAP_MS = Number(process.env.LEADERBOARD_REQ_MIN_GAP_MS || "") || 250;

// Cache TTLs
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ANON_TTL_MS = 2 * 60 * 60 * 1000;
const SUMMONER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOPCHAMPS_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Warming pass settings (extra tries for missing cache)
const WARM_MAX_PASSES = Number(process.env.LEADERBOARD_WARM_PASSES || "") || 2;
// Warming concurrency: keep low; summoner-v4 and match-v5 rate limits are sensitive
const WARM_CONCURRENCY = Number(process.env.LEADERBOARD_WARM_CONCURRENCY || "") || 1;
// Extra delay between warm passes
const WARM_PASS_GAP_MS = Number(process.env.LEADERBOARD_WARM_PASS_GAP_MS || "") || 1500;

const DEBUG = process.env.LEADERBOARD_DEBUG === "1";
const SINGLE = process.env.LEADERBOARD_SINGLE === "1";

// -------------------------
// Routing helpers
function platformBase(platform: RegionKey) {
  return `https://${platform}.api.riotgames.com`;
}

function regionalFor(platform: RegionKey): RegionalKey {
  if (platform === "euw1") return "europe";
  if (platform === "kr") return "asia";
  return "americas";
}

function regionalBase(regional: RegionalKey) {
  return `https://${regional}.api.riotgames.com`;
}

function headers(): Record<string, string> {
  return { "X-Riot-Token": RIOT_API_KEY as string };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// -------------------------
// Simple global rate limiter
let _limiterChain: Promise<void> = Promise.resolve();
let _lastReqAt = 0;

async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  const gate = _limiterChain;
  let release!: () => void;
  _limiterChain = new Promise<void>((r) => (release = r));

  await gate;
  try {
    const now = Date.now();
    const wait = Math.max(0, REQ_MIN_GAP_MS - (now - _lastReqAt));
    if (wait > 0) await sleep(wait);
    _lastReqAt = Date.now();
    return await fn();
  } finally {
    release();
  }
}

// -------------------------
// Windows-safe fetch timeout
const IS_WIN = process.platform === "win32";

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const finalInit: RequestInit = { ...init };

  if (!IS_WIN) {
    // Node 20+: AbortSignal.timeout exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sig = (AbortSignal as any).timeout ? (AbortSignal as any).timeout(timeoutMs) : undefined;
    if (sig) finalInit.signal = sig;
  }

  return await withRateLimit(() => fetch(url, finalInit));
}

async function riotGetJson<T>(url: string): Promise<T> {
  for (let attempt = 0; attempt <= RETRY_MAX; attempt++) {
    let res: Response;

    try {
      res = await fetchWithTimeout(url, { headers: headers() }, REQUEST_TIMEOUT_MS);
    } catch (err: any) {
      if (attempt < RETRY_MAX) {
        await sleep(350 * (attempt + 1));
        continue;
      }
      throw new Error(`Riot GET network/timeout failed: ${url} :: ${String(err)}`);
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") || "2");
      const waitMs = retryAfter * 1000 + Math.floor(Math.random() * 300) + attempt * 250;
      if (DEBUG) console.log(`[debug] 429 ${url} waitMs=${waitMs} attempt=${attempt}`);
      await sleep(waitMs);
      continue;
    }

    if (res.status >= 500 && res.status <= 599) {
      await sleep(600 * (attempt + 1));
      continue;
    }

    if (res.status === 401 || res.status === 403) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Riot auth/permission error ${res.status} ${url} :: ${txt.slice(0, 400)}`);
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Riot GET failed ${res.status} ${url} :: ${txt.slice(0, 400)}`);
    }

    if (DEBUG) {
      const txt = await res.text().catch(() => "");
      const preview = txt.slice(0, 240).replace(/\s+/g, " ");
      console.log(`[debug] 200 ${url} preview="${preview}"`);
      return JSON.parse(txt) as T;
    }

    return (await res.json()) as T;
  }

  throw new Error(`Riot GET failed after retries: ${url}`);
}

async function platformGet<T>(platform: RegionKey, urlPath: string): Promise<T> {
  const url = `${platformBase(platform)}${urlPath}`;
  return riotGetJson<T>(url);
}

async function regionalGet<T>(regional: RegionalKey, urlPath: string): Promise<T> {
  const url = `${regionalBase(regional)}${urlPath}`;
  return riotGetJson<T>(url);
}

// -------------------------
// DTOs
type LeagueEntryDTO = {
  puuid?: string;
  summonerId?: string;
  summonerName?: string;

  leaguePoints: number;
  rank: string;
  wins: number;
  losses: number;
  veteran: boolean;
  inactive: boolean;
  freshBlood: boolean;
  hotStreak: boolean;
};

type LeagueListDTO = {
  tier: string;
  leagueId: string;
  queue: string;
  name: string;
  entries: LeagueEntryDTO[];
};

type MatchV5DTO = {
  info?: {
    participants?: Array<{
      puuid: string;
      riotIdGameName?: string;
      riotIdTagline?: string;
      championName?: string;
    }>;
  };
};

type SummonerV4DTO = {
  id: string; // summonerId
  puuid: string;
  name: string;
  profileIconId: number;
  summonerLevel: number;
};

// -------------------------
// DDragon mapping for champion icons
type DDragonChampionIndex = {
  data: Record<
    string,
    {
      id: string;
      name: string;
      key: string;
    }
  >;
};

function normChamp(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/['’.\s-]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function loadLatestDDragonVersion(): Promise<string> {
  const versions = await riotGetJson<string[]>("https://ddragon.leagueoflegends.com/api/versions.json");
  return versions?.[0] || "15.1.1";
}

async function loadChampionIdMap(ddVersion: string): Promise<Map<string, string>> {
  const idx = await riotGetJson<DDragonChampionIndex>(
    `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/data/en_US/champion.json`
  );

  const map = new Map<string, string>();
  for (const key of Object.keys(idx.data || {})) {
    const c = idx.data[key];
    map.set(normChamp(c.id), c.id);
    map.set(normChamp(c.name), c.id);
  }
  return map;
}

function toDDragonChampId(championName: string | null, idMap: Map<string, string>): string | null {
  const raw = (championName || "").trim();
  if (!raw) return null;
  const hit = idMap.get(normChamp(raw));
  return hit || null;
}

// -------------------------
// Output JSON
type OutputPlayer = {
  puuid: string;

  summonerId: string | null;
  summonerName: string;
  profileIconId: number | null;
  summonerLevel: number | null;

  topChamps: Array<{ name: string; count: number }> | null;
  sampleGames: number | null;

  gameName: string | null;
  tagLine: string | null;

  leaguePoints: number;
  wins: number;
  losses: number;

  hotStreak: boolean;
  inactive: boolean;
  veteran: boolean;
  freshBlood: boolean;
};

type LeaderboardOut = {
  generatedAt: string;
  region: RegionKey;
  queue: QueueKey;
  tier: TierKey;
  count: number;
  players: OutputPlayer[];
};

// -------------------------
// Endpoints
function leagueEndpoint(queue: QueueKey, tier: TierKey) {
  if (tier === "CHALLENGER") return `/lol/league/v4/challengerleagues/by-queue/${queue}`;
  if (tier === "GRANDMASTER") return `/lol/league/v4/grandmasterleagues/by-queue/${queue}`;
  return `/lol/league/v4/masterleagues/by-queue/${queue}`;
}

function sortByLp(a: LeagueEntryDTO, b: LeagueEntryDTO) {
  if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
  return b.wins - a.wins;
}

// -------------------------
// Cache dirs
const CACHE_ROOT = path.join(process.cwd(), "scripts", "riot", "cache", "leaderboards");
const CACHE_BY_PUUID_NAME = path.join(CACHE_ROOT, "by-puuid-name");
const CACHE_BY_PUUID_SUMMONER = path.join(CACHE_ROOT, "by-puuid-summoner");
const CACHE_BY_PUUID_TOPCHAMPS = path.join(CACHE_ROOT, "by-puuid-topchamps");

type PuuidNameCacheRow = {
  fetchedAt: number;
  puuid: string;
  gameName: string | null;
  tagLine: string | null;
  display: string;
};

// IMPORTANT: allow summonerId to be null (your cache already has rows like that)
type PuuidSummonerCacheRow = {
  fetchedAt: number;
  puuid: string;
  summonerId: string | null;
  profileIconId: number | null;
  summonerLevel: number | null;
};

type PuuidTopChampsCacheRow = {
  fetchedAt: number;
  puuid: string;
  sampleGames: number;
  topChamps: Array<{ name: string; count: number }>;
};

function normalizePuuid(raw: any): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return null;
  return s.replace(/^_+/, "") || null;
}

function safeKey(s: string) {
  // Keep same behavior across scripts (your finalize uses this same regex)
  return s.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function cachePathByPuuid(platform: RegionKey, puuid: string) {
  const n = normalizePuuid(puuid);
  return path.join(CACHE_BY_PUUID_NAME, platform, `${safeKey(n || puuid)}.json`);
}

function summonerCachePathByPuuid(platform: RegionKey, puuid: string) {
  const n = normalizePuuid(puuid);
  return path.join(CACHE_BY_PUUID_SUMMONER, platform, `${safeKey(n || puuid)}.json`);
}

function topChampsCachePathByPuuid(platform: RegionKey, puuid: string) {
  const n = normalizePuuid(puuid);
  return path.join(CACHE_BY_PUUID_TOPCHAMPS, platform, `${safeKey(n || puuid)}.json`);
}

async function ensureCacheDirs() {
  for (const r of REGIONS) {
    await fs.mkdir(path.join(CACHE_BY_PUUID_NAME, r), { recursive: true });
    await fs.mkdir(path.join(CACHE_BY_PUUID_SUMMONER, r), { recursive: true });
    await fs.mkdir(path.join(CACHE_BY_PUUID_TOPCHAMPS, r), { recursive: true });
  }
}

async function readPuuidNameCache(platform: RegionKey, puuid: string): Promise<PuuidNameCacheRow | null> {
  try {
    const raw = await fs.readFile(cachePathByPuuid(platform, puuid), "utf8");
    const row = JSON.parse(raw) as PuuidNameCacheRow;
    if (!row?.fetchedAt) return null;
    if (Date.now() - row.fetchedAt > CACHE_TTL_MS) return null;
    return row;
  } catch {
    return null;
  }
}

async function writePuuidNameCache(platform: RegionKey, row: PuuidNameCacheRow) {
  const file = cachePathByPuuid(platform, row.puuid);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(row), "utf8");
}

async function readPuuidSummonerCache(platform: RegionKey, puuid: string): Promise<PuuidSummonerCacheRow | null> {
  try {
    const raw = await fs.readFile(summonerCachePathByPuuid(platform, puuid), "utf8");
    const row = JSON.parse(raw) as PuuidSummonerCacheRow;
    if (!row?.fetchedAt) return null;
    if (Date.now() - row.fetchedAt > SUMMONER_TTL_MS) return null;

    // Accept rows even if summonerId is null (as long as icon/level exist)
    const iconOk = Number.isFinite(row.profileIconId as any) && (row.profileIconId as number) > 0;
    const lvlOk = Number.isFinite(row.summonerLevel as any) && (row.summonerLevel as number) > 0;
    if (!iconOk && !lvlOk && !row.summonerId) return null;

    return row;
  } catch {
    return null;
  }
}

async function writePuuidSummonerCache(platform: RegionKey, row: PuuidSummonerCacheRow) {
  const file = summonerCachePathByPuuid(platform, row.puuid);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(row), "utf8");
}

async function readPuuidTopChampsCache(platform: RegionKey, puuid: string): Promise<PuuidTopChampsCacheRow | null> {
  try {
    const raw = await fs.readFile(topChampsCachePathByPuuid(platform, puuid), "utf8");
    const row = JSON.parse(raw) as PuuidTopChampsCacheRow;
    if (!row?.fetchedAt) return null;
    if (Date.now() - row.fetchedAt > TOPCHAMPS_TTL_MS) return null;
    return row;
  } catch {
    return null;
  }
}

async function writePuuidTopChampsCache(platform: RegionKey, row: PuuidTopChampsCacheRow) {
  const file = topChampsCachePathByPuuid(platform, row.puuid);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(row), "utf8");
}

// -------------------------
// Match-v5 helpers
async function matchIdsByPuuid(regional: RegionalKey, puuid: string, count: number): Promise<string[]> {
  return regionalGet<string[]>(
    regional,
    `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=${count}`
  );
}

async function matchById(regional: RegionalKey, matchId: string): Promise<MatchV5DTO> {
  return regionalGet<MatchV5DTO>(regional, `/lol/match/v5/matches/${encodeURIComponent(matchId)}`);
}

function formatRiotId(gameName: string | null, tagLine: string | null) {
  if (gameName && tagLine) return `${gameName}#${tagLine}`;
  if (gameName) return gameName;
  return "Anonymous";
}

function anonRow(puuid: string): PuuidNameCacheRow {
  const shiftedFetchedAt = Date.now() - (CACHE_TTL_MS - ANON_TTL_MS);
  return {
    fetchedAt: shiftedFetchedAt,
    puuid,
    gameName: null,
    tagLine: null,
    display: "Anonymous",
  };
}

// ✅ Single-pass enrichment from ONE set of match IDs + match fetches
async function resolveNameAndTopChampsFromMatches(
  platform: RegionKey,
  puuidRaw: string,
  champIdMap: Map<string, string>
): Promise<{
  nameRow: PuuidNameCacheRow;
  topChamps: Array<{ name: string; count: number }> | null;
  sampleGames: number | null;
}> {
  const puuid = normalizePuuid(puuidRaw) || puuidRaw;

  const cachedName = await readPuuidNameCache(platform, puuid);
  const cachedTop = await readPuuidTopChampsCache(platform, puuid);

  const haveName = !!cachedName;
  const haveTop = !!cachedTop;

  if (haveName && haveTop) {
    return {
      nameRow: cachedName!,
      topChamps: cachedTop!.topChamps,
      sampleGames: cachedTop!.sampleGames,
    };
  }

  const regional = regionalFor(platform);

  const wantIds = Math.max(MATCH_IDS_COUNT, TOP_CHAMPS_MATCH_COUNT);
  let ids: string[] = [];
  try {
    ids = await matchIdsByPuuid(regional, puuid, wantIds);
  } catch {
    const nameRow = cachedName ?? anonRow(puuid);
    if (!cachedName) writePuuidNameCache(platform, nameRow).catch(() => {});
    return {
      nameRow,
      topChamps: cachedTop?.topChamps ?? null,
      sampleGames: cachedTop?.sampleGames ?? null,
    };
  }

  let nameRow: PuuidNameCacheRow | null = cachedName ?? null;

  const counts = new Map<string, number>();
  let sample = 0;

  const needName = !haveName;
  const needTop = !haveTop;

  for (let i = 0; i < ids.length; i++) {
    const matchId = ids[i];
    if (!matchId) continue;

    const topDone = !needTop || i >= TOP_CHAMPS_MATCH_COUNT;
    if ((!needName || !!nameRow) && topDone) break;

    let match: MatchV5DTO | null = null;
    try {
      match = await matchById(regional, matchId);
    } catch {
      continue;
    }

    const me = (match?.info?.participants ?? []).find((x) => x?.puuid === puuid);
    if (!me) continue;

    if (!nameRow && needName && i < MATCH_IDS_COUNT) {
      const gameName = (me.riotIdGameName ?? "").trim() || null;
      const tagLine = (me.riotIdTagline ?? "").trim() || null;

      if (gameName && tagLine) {
        nameRow = {
          fetchedAt: Date.now(),
          puuid,
          gameName,
          tagLine,
          display: formatRiotId(gameName, tagLine),
        };
        writePuuidNameCache(platform, nameRow).catch(() => {});
      }
    }

    if (needTop && i < TOP_CHAMPS_MATCH_COUNT) {
      const rawChamp = (me.championName ?? "").trim();
      const ddId = toDDragonChampId(rawChamp, champIdMap);
      if (ddId) {
        counts.set(ddId, (counts.get(ddId) || 0) + 1);
        sample++;
      }
    }
  }

  if (!nameRow) {
    nameRow = anonRow(puuid);
    writePuuidNameCache(platform, nameRow).catch(() => {});
  }

  let topChamps: Array<{ name: string; count: number }> | null = cachedTop?.topChamps ?? null;
  let sampleGames: number | null = cachedTop?.sampleGames ?? null;

  if (needTop) {
    if (sample > 0 && counts.size > 0) {
      const top = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));

      const row: PuuidTopChampsCacheRow = {
        fetchedAt: Date.now(),
        puuid,
        sampleGames: sample,
        topChamps: top,
      };
      writePuuidTopChampsCache(platform, row).catch(() => {});

      topChamps = top;
      sampleGames = sample;
    } else {
      // still write a row to avoid hammering match-v5 for PUUIDs with no usable champ mapping
      const row: PuuidTopChampsCacheRow = {
        fetchedAt: Date.now(),
        puuid,
        sampleGames: sample || 0,
        topChamps: [],
      };
      writePuuidTopChampsCache(platform, row).catch(() => {});
      topChamps = null;
      sampleGames = sample > 0 ? sample : null;
    }
  }

  if (GAP_MS > 0) await sleep(GAP_MS);

  return { nameRow, topChamps, sampleGames };
}

// -------------------------
// Summoner-v4 helpers
async function summonerByPuuid(platform: RegionKey, puuid: string): Promise<SummonerV4DTO> {
  return platformGet<SummonerV4DTO>(platform, `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`);
}

async function resolveSummoner(platform: RegionKey, puuidRaw: string): Promise<PuuidSummonerCacheRow | null> {
  const puuid = normalizePuuid(puuidRaw) || puuidRaw;

  const cached = await readPuuidSummonerCache(platform, puuid);
  if (cached) return cached;

  try {
    const dto = await summonerByPuuid(platform, puuid);

    const row: PuuidSummonerCacheRow = {
      fetchedAt: Date.now(),
      puuid,
      summonerId: (dto.id ?? "").trim() || null,
      profileIconId: Number.isFinite(dto.profileIconId) && dto.profileIconId > 0 ? dto.profileIconId : null,
      summonerLevel: Number.isFinite(dto.summonerLevel) && dto.summonerLevel > 0 ? dto.summonerLevel : null,
    };

    // Always write the row if it has *anything* useful (icon/level/id)
    if (row.summonerId || row.profileIconId || row.summonerLevel) {
      writePuuidSummonerCache(platform, row).catch(() => {});
      if (GAP_MS > 0) await sleep(GAP_MS);
      return row;
    }

    return null;
  } catch (e: any) {
    if (DEBUG) {
      console.log(
        `[warn] summoner-v4 failed platform=${platform} puuid=${puuid.slice(0, 10)}... err=${String(e?.message || e)}`
      );
    }
    return null;
  }
}

// -------------------------
// Concurrency helper
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length) as any;
  let i = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      out[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return out;
}

// -------------------------
// Warming: ensure cache coverage for any missing fields
function needsIconOrLevel(p: OutputPlayer) {
  return !p.profileIconId || !p.summonerLevel;
}
function needsTop(p: OutputPlayer) {
  return !p.topChamps || p.topChamps.length === 0;
}
function needsNameBits(p: OutputPlayer) {
  return !p.gameName || !p.tagLine;
}

async function warmCachesForPlayers(
  platform: RegionKey,
  players: OutputPlayer[],
  champIdMap: Map<string, string>
): Promise<void> {
  // Unique PUUIDs that are missing something
  const missing = new Map<string, { needSummoner: boolean; needMatches: boolean }>();

  for (const p of players) {
    const puuid = normalizePuuid(p.puuid) || p.puuid;
    const needSummoner = needsIconOrLevel(p);
    const needMatches = needsTop(p) || needsNameBits(p);
    if (!needSummoner && !needMatches) continue;

    const cur = missing.get(puuid) ?? { needSummoner: false, needMatches: false };
    cur.needSummoner = cur.needSummoner || needSummoner;
    cur.needMatches = cur.needMatches || needMatches;
    missing.set(puuid, cur);
  }

  if (missing.size === 0) return;

  const tasks = [...missing.entries()]; // [puuid, flags]

  if (DEBUG) {
    const s = tasks.filter(([, f]) => f.needSummoner).length;
    const m = tasks.filter(([, f]) => f.needMatches).length;
    console.log(`[warm] ${platform} missing: summoner=${s} matches=${m} total=${tasks.length}`);
  }

  for (let pass = 1; pass <= WARM_MAX_PASSES; pass++) {
    let progressSumm = 0;
    let progressMatch = 0;

    await mapLimit(tasks, WARM_CONCURRENCY, async ([puuid, flags], idx) => {
      // If already cached by previous attempts, skip
      if (flags.needSummoner) {
        const cached = await readPuuidSummonerCache(platform, puuid);
        if (!cached) {
          await resolveSummoner(platform, puuid);
        }
        const cached2 = await readPuuidSummonerCache(platform, puuid);
        if (cached2) flags.needSummoner = false;
      }

      if (flags.needMatches) {
        const cachedName = await readPuuidNameCache(platform, puuid);
        const cachedTop = await readPuuidTopChampsCache(platform, puuid);
        if (!cachedName || !cachedTop) {
          await resolveNameAndTopChampsFromMatches(platform, puuid, champIdMap);
        }
        const cachedName2 = await readPuuidNameCache(platform, puuid);
        const cachedTop2 = await readPuuidTopChampsCache(platform, puuid);
        if (cachedName2 && cachedTop2) flags.needMatches = false;
      }

      if (!DEBUG && idx > 0 && idx % 25 === 0) {
        // light progress
        progressSumm = tasks.filter(([, f]) => f.needSummoner).length;
        progressMatch = tasks.filter(([, f]) => f.needMatches).length;
        console.log(`[warm] ${platform} pass=${pass}/${WARM_MAX_PASSES} remaining summ=${progressSumm} matches=${progressMatch}`);
      }

      return null;
    });

    const remainingSumm = tasks.filter(([, f]) => f.needSummoner).length;
    const remainingMatch = tasks.filter(([, f]) => f.needMatches).length;

    if (DEBUG) {
      console.log(`[warm] ${platform} pass=${pass} remaining summ=${remainingSumm} matches=${remainingMatch}`);
    }

    if (remainingSumm === 0 && remainingMatch === 0) break;
    if (WARM_PASS_GAP_MS > 0) await sleep(WARM_PASS_GAP_MS);
  }
}

async function patchPlayersFromCache(
  platform: RegionKey,
  players: OutputPlayer[]
): Promise<{ missingIconOrLevelAfter: number; missingTopAfter: number }> {
  let missIconOrLevel = 0;
  let missTop = 0;

  for (const p of players) {
    const puuid = normalizePuuid(p.puuid) || p.puuid;

    const summ = await readPuuidSummonerCache(platform, puuid);
    if (summ) {
      if (!p.profileIconId && summ.profileIconId) p.profileIconId = summ.profileIconId;
      if (!p.summonerLevel && summ.summonerLevel) p.summonerLevel = summ.summonerLevel;
      if (!p.summonerId && summ.summonerId) p.summonerId = summ.summonerId;
    }

    const nm = await readPuuidNameCache(platform, puuid);
    if (nm) {
      // prefer cached display always
      if (nm.display) p.summonerName = nm.display;
      if (!p.gameName && nm.gameName) p.gameName = nm.gameName;
      if (!p.tagLine && nm.tagLine) p.tagLine = nm.tagLine;
    }

    const top = await readPuuidTopChampsCache(platform, puuid);
    if (top && top.topChamps && top.topChamps.length) {
      if (!p.topChamps || p.topChamps.length === 0) p.topChamps = top.topChamps;
      if (!p.sampleGames && top.sampleGames > 0) p.sampleGames = top.sampleGames;
    }

    if (needsIconOrLevel(p)) missIconOrLevel++;
    if (needsTop(p)) missTop++;
  }

  return { missingIconOrLevelAfter: missIconOrLevel, missingTopAfter: missTop };
}

// -------------------------
async function buildOne(platform: RegionKey, queue: QueueKey, tier: TierKey, champIdMap: Map<string, string>) {
  const list = await platformGet<LeagueListDTO>(platform, leagueEndpoint(queue, tier));
  const entries = Array.isArray(list.entries) ? list.entries : [];

  console.log(`[leaderboards] ${platform} ${queue} ${tier} entries=${entries.length} (topN=${TOP_N})`);

  const sorted = [...entries].sort(sortByLp).slice(0, TOP_N);

  const enriched = await mapLimit(sorted, CONCURRENCY, async (p, idx) => {
    const puuid = normalizePuuid(p.puuid) || "";
    if (!puuid) {
      if (DEBUG) console.log(`[debug] dropped idx=${idx} (missing puuid)`);
      return null;
    }

    if (!DEBUG && idx > 0 && idx % 10 === 0) {
      console.log(`[leaderboards] ${platform} ${queue} ${tier} progress ${idx}/${sorted.length}`);
    }

    // Summoner-v4 FIRST (cheap + critical for icons/level)
    const summRow = await resolveSummoner(platform, puuid);

    const summonerIdFallback = (p.summonerId ?? "").trim() || null;

    const profileIconId =
      summRow && Number.isFinite(summRow.profileIconId as any) && (summRow.profileIconId as number) > 0
        ? (summRow.profileIconId as number)
        : null;

    const summonerLevel =
      summRow && Number.isFinite(summRow.summonerLevel as any) && (summRow.summonerLevel as number) > 0
        ? (summRow.summonerLevel as number)
        : null;

    // match-v5 sampling (expensive)
    const { nameRow, topChamps, sampleGames } = await resolveNameAndTopChampsFromMatches(platform, puuid, champIdMap);

    const out: OutputPlayer = {
      puuid,

      summonerId: summRow?.summonerId || summonerIdFallback,
      summonerName: nameRow.display,

      profileIconId,
      summonerLevel,

      topChamps: topChamps && topChamps.length ? topChamps : null,
      sampleGames: sampleGames && sampleGames > 0 ? sampleGames : null,

      gameName: nameRow.gameName,
      tagLine: nameRow.tagLine,

      leaguePoints: p.leaguePoints,
      wins: p.wins,
      losses: p.losses,

      hotStreak: !!p.hotStreak,
      inactive: !!p.inactive,
      veteran: !!p.veteran,
      freshBlood: !!p.freshBlood,
    };

    return out;
  });

  const players: OutputPlayer[] = enriched.filter((x): x is OutputPlayer => x !== null);

  // ✅ WARM CACHES for missing data, then patch from cache before writing output
  const missingBeforeIcons = players.filter(needsIconOrLevel).length;
  const missingBeforeTop = players.filter(needsTop).length;

  if (missingBeforeIcons > 0 || missingBeforeTop > 0) {
    console.log(
      `[leaderboards] ${platform} ${queue} ${tier} warming cache missingIconsOrLevel=${missingBeforeIcons} missingTop=${missingBeforeTop}`
    );
    await warmCachesForPlayers(platform, players, champIdMap);
    const after = await patchPlayersFromCache(platform, players);

    console.log(
      `[leaderboards] ${platform} ${queue} ${tier} after warm missingIconsOrLevel=${after.missingIconOrLevelAfter} missingTop=${after.missingTopAfter}`
    );
  }

  const out: LeaderboardOut = {
    generatedAt: new Date().toISOString(),
    region: platform,
    queue,
    tier,
    count: players.length,
    players,
  };

  const dir = path.join(process.cwd(), "public", "data", "lol", "leaderboards", platform);
  await fs.mkdir(dir, { recursive: true });

  const file = path.join(dir, `${queue}.${tier.toLowerCase()}.json`);
  await fs.writeFile(file, JSON.stringify(out, null, 2), "utf8");

  return { file, count: out.count };
}

async function main() {
  console.log("[leaderboards] build start", new Date().toISOString());
  console.log(
    `[leaderboards] debug=${DEBUG ? "on" : "off"} single=${SINGLE ? "on" : "off"} topN=${TOP_N} conc=${CONCURRENCY} warmConc=${WARM_CONCURRENCY} warmPasses=${WARM_MAX_PASSES} gapMs=${GAP_MS} matchIds=${MATCH_IDS_COUNT} topChampsMatchCount=${TOP_CHAMPS_MATCH_COUNT} reqMinGapMs=${REQ_MIN_GAP_MS} win=${IS_WIN ? "1" : "0"}`
  );

  await ensureCacheDirs();

  const ddVersion = await loadLatestDDragonVersion();
  if (DEBUG) console.log(`[debug] ddragon version=${ddVersion}`);
  const champIdMap = await loadChampionIdMap(ddVersion);

  const regions = SINGLE ? [REGIONS[0]] : REGIONS;
  const queues = SINGLE ? [QUEUES[0]] : QUEUES;
  const tiers = SINGLE ? [TIERS[0]] : TIERS;

  for (const platform of regions) {
    for (const queue of queues) {
      for (const tier of tiers) {
        const r = await buildOne(platform, queue, tier, champIdMap);
        console.log(`[ok] ${platform} ${queue} ${tier} => ${r.count} (${r.file})`);
      }
    }
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
