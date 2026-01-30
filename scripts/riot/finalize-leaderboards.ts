// scripts/riot/finalize-leaderboards.ts
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type RegionKey = "na1" | "euw1" | "kr";

type OutputPlayer = {
  puuid: string;

  summonerId: string | null;
  summonerName: string;
  profileIconId: number | null;
  summonerLevel: number | null;

  topChamps?: Array<{ name: string; count: number }> | null;
  sampleGames?: number | null;

  gameName?: string | null;
  tagLine?: string | null;

  leaguePoints: number;
  wins: number;
  losses: number;

  hotStreak: boolean;
  inactive: boolean;
  veteran: boolean;
  freshBlood: boolean;
};

type LeaderboardFile = {
  generatedAt: string;
  region: RegionKey;
  queue: string;
  tier: string;
  count: number;
  players: OutputPlayer[];
};

// -------------------------
// Config
const ROOT = process.cwd();
const DEBUG = process.env.LEADERBOARD_DEBUG === "1";

// Leaderboards output directory (auto-detected)
const CACHE_ROOT = path.join(ROOT, "scripts", "riot", "cache", "leaderboards");

// Cache roots (all are optional; we scan what exists)
const DIR_LEGACY_BY_PUUID = path.join(CACHE_ROOT, "by-puuid");
const DIR_BY_PUUID_NAME = path.join(CACHE_ROOT, "by-puuid-name");
const DIR_BY_PUUID_SUMMONER = path.join(CACHE_ROOT, "by-puuid-summoner");
const DIR_BY_PUUID_TOPCHAMPS = path.join(CACHE_ROOT, "by-puuid-topchamps");

// -------------------------
// Utils
function isRegionKey(x: any): x is RegionKey {
  return x === "na1" || x === "euw1" || x === "kr";
}

function toPosIntOrNull(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const t = Math.trunc(n);
  return t > 0 ? t : null;
}

function toStringOrNull(v: any): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

/**
 * IMPORTANT:
 * Some cache rows can have leading "_" on puuid (old safeKey/prefix behavior).
 * We normalize consistently so cache hits work.
 */
function normalizePuuid(raw: any): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return null;
  const cleaned = s.replace(/^_+/, "");
  return cleaned || null;
}

function stableDisplayName(preferred: string | null | undefined, fallback: string | null | undefined) {
  const a = (preferred ?? "").trim();
  if (a) return a;
  const b = (fallback ?? "").trim();
  if (b) return b;
  return "Anonymous";
}

async function existsDir(p: string): Promise<boolean> {
  try {
    const st = await fs.stat(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function listJsonFilesRecursive(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: any[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await listJsonFilesRecursive(full)));
    else if (ent.isFile() && ent.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function deepEqualJsonish(a: any, b: any): boolean {
  // good enough for our small payloads; avoids rewriting identical files
  return JSON.stringify(a) === JSON.stringify(b);
}

// -------------------------
// Cache row shapes (loose on purpose)
type AnyCacheRow = Record<string, any>;

// What we want to derive (merged across caches)
type CacheIndexRow = {
  puuid: string;
  region?: RegionKey;

  // name cache
  gameName?: string | null;
  tagLine?: string | null;
  display?: string | null;

  // summoner cache
  summonerId?: string | null;
  profileIconId?: number | null;
  summonerLevel?: number | null;

  // topchamps cache
  topChamps?: Array<{ name: string; count: number }> | null;
  sampleGames?: number | null;
};

// Merge helper: “only set if present”
function mergeRow(dst: CacheIndexRow, src: Partial<CacheIndexRow>) {
  if (src.gameName !== undefined) dst.gameName = src.gameName;
  if (src.tagLine !== undefined) dst.tagLine = src.tagLine;
  if (src.display !== undefined) dst.display = src.display;

  if (src.summonerId !== undefined) dst.summonerId = src.summonerId;
  if (src.profileIconId !== undefined) dst.profileIconId = src.profileIconId;
  if (src.summonerLevel !== undefined) dst.summonerLevel = src.summonerLevel;

  if (src.topChamps !== undefined) dst.topChamps = src.topChamps;
  if (src.sampleGames !== undefined) dst.sampleGames = src.sampleGames;
}

// Normalize champs array
function normTopChamps(v: any): Array<{ name: string; count: number }> | null {
  if (!Array.isArray(v)) return null;
  const out: Array<{ name: string; count: number }> = [];
  for (const it of v) {
    const name = typeof it?.name === "string" ? it.name.trim() : "";
    const count = Number(it?.count);
    if (!name) continue;
    if (!Number.isFinite(count) || count <= 0) continue;
    out.push({ name, count: Math.trunc(count) });
  }
  return out.length ? out : null;
}

// Parse a cache file (any schema) into a normalized partial
function parseCacheRow(json: AnyCacheRow): Partial<CacheIndexRow> | null {
  const puuid = normalizePuuid(json?.puuid);
  if (!puuid) return null;

  const out: Partial<CacheIndexRow> = { puuid };

  // name cache schema
  if ("display" in json || "gameName" in json || "tagLine" in json) {
    out.gameName = toStringOrNull(json.gameName);
    out.tagLine = toStringOrNull(json.tagLine);
    out.display = toStringOrNull(json.display);
  }

  // summoner schema(s)
  if ("summonerId" in json || "profileIconId" in json || "summonerLevel" in json) {
    out.summonerId = toStringOrNull(json.summonerId); // can legitimately be null
    out.profileIconId = toPosIntOrNull(json.profileIconId);
    out.summonerLevel = toPosIntOrNull(json.summonerLevel);
  }

  // topchamps schema(s)
  if ("topChamps" in json || "sampleGames" in json) {
    out.topChamps = normTopChamps(json.topChamps);
    out.sampleGames = toPosIntOrNull(json.sampleGames);
  }

  return out;
}

// -------------------------
// Build the cache index by scanning all cache dirs
async function buildCacheIndex(): Promise<{
  index: Map<string, CacheIndexRow>;
  scanFiles: number;
  parsedRows: number;
}> {
  const index = new Map<string, CacheIndexRow>();

  const sources: Array<{ base: string; label: string }> = [
    { base: DIR_LEGACY_BY_PUUID, label: "legacy-by-puuid" },
    { base: DIR_BY_PUUID_NAME, label: "by-puuid-name" },
    { base: DIR_BY_PUUID_SUMMONER, label: "by-puuid-summoner" },
    { base: DIR_BY_PUUID_TOPCHAMPS, label: "by-puuid-topchamps" },
  ];

  let scanFiles = 0;
  let parsedRows = 0;

  for (const src of sources) {
    if (!(await existsDir(src.base))) {
      if (DEBUG) console.log(`[debug] cache dir missing (ok): ${src.label} => ${src.base}`);
      continue;
    }

    const files = await listJsonFilesRecursive(src.base);
    for (const f of files) {
      scanFiles++;

      let raw = "";
      try {
        raw = await fs.readFile(f, "utf8");
      } catch {
        continue;
      }

      let json: AnyCacheRow;
      try {
        json = JSON.parse(raw) as AnyCacheRow;
      } catch {
        continue;
      }

      const parsed = parseCacheRow(json);
      if (!parsed?.puuid) continue;
      parsedRows++;

      const puuid = parsed.puuid;
      const cur = index.get(puuid) ?? { puuid };
      mergeRow(cur, parsed);

      // region can be derived from the file path (…/<region>/…)
      const rel = path.relative(CACHE_ROOT, f).replace(/\\/g, "/");
      const parts = rel.split("/");
      const maybeRegion = parts.length >= 2 ? parts[1] : null;
      if (maybeRegion && isRegionKey(maybeRegion)) cur.region = maybeRegion;

      index.set(puuid, cur);
    }
  }

  return { index, scanFiles, parsedRows };
}

// -------------------------
// IMPORTANT: Target only what your UI actually needs.
// DO NOT target gameName/tagLine here, because many caches won't have them and it causes “touched but no fill”.
function needsAnyEnrich(p: OutputPlayer) {
  const needIconOrLevel = p.profileIconId == null || p.summonerLevel == null;
  const needTop = !p.topChamps || p.topChamps.length === 0;
  return needIconOrLevel || needTop;
}

type FileRunStats = {
  file: string;
  region: RegionKey | "unknown";
  touched: number;
  filled: number;
  misses: number;

  missingIconOrLevel_after: number;
  missingTop_after: number;
};

async function finalizeLeaderboardFileFromCache(
  filePath: string,
  cacheIndex: Map<string, CacheIndexRow>
): Promise<{ updated: boolean; stats: FileRunStats }> {
  const raw = await fs.readFile(filePath, "utf8");
  const before = JSON.parse(raw) as LeaderboardFile;

  const platform = before.region;
  const region: FileRunStats["region"] = isRegionKey(platform) ? platform : "unknown";

  const players = Array.isArray(before.players) ? before.players : [];
  const targets = players.filter((p) => p?.puuid && needsAnyEnrich(p));

  let filled = 0;
  let misses = 0;
  let debugMissesShown = 0;

  // We'll mutate a copy (so we can decide whether to write)
  const after = structuredClone(before) as LeaderboardFile;

  for (const p of after.players) {
    if (!p?.puuid) continue;
    if (!needsAnyEnrich(p)) continue;

    const puuid = normalizePuuid(p.puuid);
    if (!puuid) continue;

    const hit = cacheIndex.get(puuid);
    if (!hit) {
      misses++;
      if (DEBUG && debugMissesShown < 8) {
        console.log(`[debug] MISS puuid=${puuid.slice(0, 12)}... file=${path.basename(filePath)}`);
        debugMissesShown++;
      }
      continue;
    }

    let did = false;

    // Icon/level (avoid truthy checks; treat 0/null correctly)
    if (p.profileIconId == null && hit.profileIconId != null) {
      p.profileIconId = hit.profileIconId;
      did = true;
    }
    if (p.summonerLevel == null && hit.summonerLevel != null) {
      p.summonerLevel = hit.summonerLevel;
      did = true;
    }

    // summonerId: only fill if cache has it (optional for UI)
    if ((p.summonerId == null || p.summonerId === "") && hit.summonerId) {
      p.summonerId = hit.summonerId;
      did = true;
    }

    // Top champs
    if ((!p.topChamps || p.topChamps.length === 0) && hit.topChamps && hit.topChamps.length) {
      p.topChamps = hit.topChamps;
      p.sampleGames = hit.sampleGames ?? p.sampleGames ?? null;
      did = true;
    } else if (p.sampleGames == null && hit.sampleGames != null) {
      p.sampleGames = hit.sampleGames;
      did = true;
    }

    // Display name (nice-to-have; doesn't affect targeting)
    if (hit.display) {
      const beforeName = (p.summonerName ?? "").trim();
      const afterName = stableDisplayName(hit.display, beforeName);
      if (afterName !== beforeName) {
        p.summonerName = afterName;
        did = true;
      }
    }

    // Optional name bits (nice-to-have)
    if (p.gameName == null && hit.gameName != null) {
      p.gameName = hit.gameName;
      did = true;
    }
    if (p.tagLine == null && hit.tagLine != null) {
      p.tagLine = hit.tagLine;
      did = true;
    }

    if (did) filled++;
  }

  after.count = Array.isArray(after.players) ? after.players.length : 0;

  // Post-checks (help you verify quickly per file)
  const missingIconOrLevel_after = after.players.filter((p) => p.profileIconId == null || p.summonerLevel == null).length;
  const missingTop_after = after.players.filter((p) => !p.topChamps || p.topChamps.length === 0).length;

  const stats: FileRunStats = {
    file: path.relative(process.cwd(), filePath),
    region,
    touched: targets.length,
    filled,
    misses,
    missingIconOrLevel_after,
    missingTop_after,
  };

  // Only write if file actually changed
  if (filled > 0 && !deepEqualJsonish(before, after)) {
    await fs.writeFile(filePath, JSON.stringify(after, null, 2), "utf8");
    return { updated: true, stats };
  }

  return { updated: false, stats };
}

// -------------------------
async function findLeaderboardsDir(): Promise<string> {
  const candidates = [path.resolve(__dirname, "..", "..", ".."), process.cwd()];
  for (const root of candidates) {
    const cand = path.join(root, "public", "data", "lol", "leaderboards");
    if (await existsDir(cand)) return cand;
  }
  const tried = candidates.map((r) => path.join(r, "public", "data", "lol", "leaderboards")).join(" | ");
  throw new Error(`[finalize-leaderboards] Could not find leaderboards dir. Tried: ${tried}`);
}

function groupKey(stats: FileRunStats) {
  const base = path.basename(stats.file);
  return `${stats.region}:${base}`;
}

// -------------------------
async function main() {
  const baseDir = await findLeaderboardsDir();

  console.log("[finalize-leaderboards] CACHE-ONLY start", new Date().toISOString());
  console.log(`[finalize-leaderboards] baseDir=${baseDir}`);
  console.log(`[finalize-leaderboards] cacheRoot=${CACHE_ROOT}`);
  console.log(`[finalize-leaderboards] debug=${DEBUG ? "on" : "off"}`);

  console.log("[finalize-leaderboards] building cache index…");
  const { index: cacheIndex, scanFiles, parsedRows } = await buildCacheIndex();
  console.log(`[finalize-leaderboards] cache scan files=${scanFiles} parsedRows=${parsedRows}`);
  console.log(`[finalize-leaderboards] cache index size=${cacheIndex.size}`);

  let files = await listJsonFilesRecursive(baseDir);
  files = files.filter((f) => f.endsWith(".json"));

  if (!files.length) {
    console.log("[finalize-leaderboards] no json files found");
    return;
  }

  let updatedFiles = 0;
  let totalFilled = 0;
  let totalTouched = 0;
  let totalMisses = 0;

  // Useful global verification:
  let totalMissingIconOrLevel_after = 0;
  let totalMissingTop_after = 0;

  // Optional: show “worst offenders” at the end
  const perFileStats: FileRunStats[] = [];

  for (const f of files) {
    try {
      const { updated, stats } = await finalizeLeaderboardFileFromCache(f, cacheIndex);
      perFileStats.push(stats);

      totalTouched += stats.touched;
      totalFilled += stats.filled;
      totalMisses += stats.misses;
      totalMissingIconOrLevel_after += stats.missingIconOrLevel_after;
      totalMissingTop_after += stats.missingTop_after;

      if (updated) {
        updatedFiles++;
        console.log(
          `[ok] ${stats.file} filled=${stats.filled} touched=${stats.touched} misses=${stats.misses} ` +
            `missingIconOrLevelAfter=${stats.missingIconOrLevel_after} missingTopAfter=${stats.missingTop_after}`
        );
      } else if (DEBUG) {
        console.log(
          `[debug] no-op ${stats.file} touched=${stats.touched} misses=${stats.misses} ` +
            `missingIconOrLevelAfter=${stats.missingIconOrLevel_after} missingTopAfter=${stats.missingTop_after}`
        );
      }
    } catch (e: any) {
      console.log(`[warn] failed ${path.relative(process.cwd(), f)} err=${String(e?.message || e)}`);
    }
  }

  // Summarize worst files so you can immediately see which region/tiers still lack cache coverage
  perFileStats.sort((a, b) => {
    const aBad = a.missingIconOrLevel_after + a.missingTop_after;
    const bBad = b.missingIconOrLevel_after + b.missingTop_after;
    return bBad - aBad;
  });

  console.log(
    `[finalize-leaderboards] done updatedFiles=${updatedFiles} totalFilled=${totalFilled} totalTouched=${totalTouched} totalMisses=${totalMisses}`
  );

  // Show top 8 “still missing” files
  const worst = perFileStats
    .map((s) => ({ s, bad: s.missingIconOrLevel_after + s.missingTop_after }))
    .filter((x) => x.bad > 0)
    .slice(0, 8);

  if (worst.length) {
    console.log("[finalize-leaderboards] worst remaining (needs more cache coverage):");
    for (const w of worst) {
      console.log(
        `  - ${groupKey(w.s)} missingIconOrLevel=${w.s.missingIconOrLevel_after} missingTop=${w.s.missingTop_after} touched=${w.s.touched} misses=${w.s.misses}`
      );
    }
    console.log(
      "[finalize-leaderboards] NOTE: If icons/topChamps are still missing here, it means those PUUIDs do not exist in your cache yet. " +
        "A cache-only finalize cannot invent them — the build step must populate the cache for those players."
    );
  } else {
    console.log("[finalize-leaderboards] ✅ all files have icons/levels + topChamps filled (per current cache).");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
