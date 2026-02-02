#!/usr/bin/env node
// scripts/dota/build-immortal-from-publicmatches.ts
//
// Path B: Crawl OpenDota raw endpoints to build a true Immortal cache.
// - Fetch recent match IDs from /publicMatches (paged with less_than_match_id)
// - Cache full match JSON from /matches/{id}
// - Maintain checkpoints + seen IDs so each run is incremental
//
// This script is SAFE for CI:
// - It does not fail the job on API errors (exits 0).
// - It writes checkpoints/state so work isn't "lost".
// - Final output JSON is produced by a separate finalize script.

import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

type PublicMatchRow = {
  match_id: number;
  start_time?: number; // epoch seconds
};

const ROOT = process.cwd();

const CACHE_ROOT = path.join(ROOT, "scripts", "dota", "cache", "immortal_v2");
const MATCHES_DIR = path.join(CACHE_ROOT, "matches");
const STATE_DIR = path.join(CACHE_ROOT, "state");

const SEEN_PATH = path.join(STATE_DIR, "seen_match_ids.json");
const CHECKPOINT_PATH = path.join(STATE_DIR, "build_checkpoint.json");
const LAST_ATTEMPT_PATH = path.join(STATE_DIR, "last_attempt.json");
const LAST_SUCCESS_PATH = path.join(STATE_DIR, "last_success.json");

function nowIso() {
  return new Date().toISOString();
}

function clampInt(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.trunc(x);
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function readJson(p: string): Promise<any | null> {
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJson(p: string, obj: any) {
  await ensureDir(path.dirname(p));
  await fs.writeFile(p, JSON.stringify(obj, null, 2) + "\n", "utf-8");
}

function withApiKey(url: string) {
  const key = (process.env.OPENDOTA_API_KEY || "").trim();
  if (!key) return url; // no key = still works (might 429 more)
  const u = new URL(url);
  u.searchParams.set("api_key", key);
  return u.toString();
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function safeFetchJson(url: string): Promise<{ ok: boolean; status: number; json: any }> {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    const status = res.status;
    const json = await res.json().catch(() => null);

    if (res.ok) return { ok: true, status, json };

    return { ok: false, status, json };
  } catch (e: any) {
    return { ok: false, status: 0, json: { error: String(e?.message || e) } };
  }
}

async function fetchPublicMatchesPage(lessThanMatchId?: number): Promise<PublicMatchRow[]> {
  const u = new URL("https://api.opendota.com/api/publicMatches");
  if (lessThanMatchId) u.searchParams.set("less_than_match_id", String(lessThanMatchId));
  const url = withApiKey(u.toString());

  const r = await safeFetchJson(url);
  if (!r.ok || !Array.isArray(r.json)) return [];

  return r.json
    .map((x: any) => ({
      match_id: clampInt(x?.match_id),
      start_time: clampInt(x?.start_time),
    }))
    .filter((x: PublicMatchRow) => x.match_id > 0);
}

async function fetchAndCacheMatch(matchId: number): Promise<"ok" | "skip" | "rate_limited" | "fail"> {
  const outPath = path.join(MATCHES_DIR, `${matchId}.json`);

  // already cached?
  try {
    await fs.access(outPath);
    return "skip";
  } catch {
    // continue
  }

  const url = withApiKey(`https://api.opendota.com/api/matches/${matchId}`);
  const r = await safeFetchJson(url);

  // 429 backoff signal
  if (!r.ok && r.status === 429) return "rate_limited";
  if (!r.ok) return "fail";

  // Only cache if looks like a match payload
  if (!r.json || typeof r.json !== "object" || !r.json.match_id) return "fail";

  await writeJson(outPath, r.json);
  return "ok";
}

async function main() {
  await ensureDir(MATCHES_DIR);
  await ensureDir(STATE_DIR);

  // ---- knobs (env configurable) ----
  const WINDOW_DAYS = clampInt(process.env.DOTA_IMMORTAL_WINDOW_DAYS ?? 7) || 7; // keep it smaller; cache grows fast
  const MAX_PAGES = clampInt(process.env.DOTA_PUBLICMATCHES_PAGES ?? 6) || 6; // how deep to page publicMatches each run
  const MAX_NEW_MATCHES = clampInt(process.env.DOTA_MAX_NEW_MATCHES ?? 120) || 120; // cap per run
  const REQ_DELAY_MS = clampInt(process.env.DOTA_REQ_DELAY_MS ?? 250) || 250; // keep it polite; lower = faster, more 429 risk

  const startedAt = nowIso();

  await writeJson(LAST_ATTEMPT_PATH, {
    started_at: startedAt,
    status: "running",
    window_days: WINDOW_DAYS,
    max_pages: MAX_PAGES,
    max_new_matches: MAX_NEW_MATCHES,
    req_delay_ms: REQ_DELAY_MS,
    has_api_key: Boolean((process.env.OPENDOTA_API_KEY || "").trim()),
  });

  const seenObj = (await readJson(SEEN_PATH)) || { seen: [] as number[] };
  const seenSet = new Set<number>(Array.isArray(seenObj?.seen) ? seenObj.seen.map((x: any) => clampInt(x)) : []);

  const minStart = Math.floor(Date.now() / 1000) - WINDOW_DAYS * 86400;

  // 1) Collect candidate match IDs from publicMatches pages
  let lessThan: number | undefined = undefined;
  const candidates: Array<{ match_id: number; start_time: number }> = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = await fetchPublicMatchesPage(lessThan);
    if (!rows.length) break;

    // publicMatches returns descending match_id; set lessThan to the smallest we saw to page older
    const ids = rows.map((r) => r.match_id).filter((x) => x > 0);
    const minId = Math.min(...ids);
    lessThan = Number.isFinite(minId) && minId > 0 ? minId : lessThan;

    for (const r of rows) {
      const st = clampInt(r.start_time ?? 0);
      if (st && st < minStart) continue; // older than window
      const id = clampInt(r.match_id);
      if (id <= 0) continue;
      candidates.push({ match_id: id, start_time: st });
    }

    // small pause between pages
    await sleep(REQ_DELAY_MS);
  }

  // Sort newest first, dedupe
  const uniq = new Map<number, number>();
  for (const c of candidates) {
    if (!uniq.has(c.match_id)) uniq.set(c.match_id, c.start_time);
  }
  const candidateIds = [...uniq.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([id]) => id);

  // 2) Determine which ones are new vs seen
  const newIds: number[] = [];
  for (const id of candidateIds) {
    if (!seenSet.has(id)) newIds.push(id);
    if (newIds.length >= MAX_NEW_MATCHES) break;
  }

  await writeJson(CHECKPOINT_PATH, {
    updated_at: nowIso(),
    phase: "collect",
    window_days: WINDOW_DAYS,
    pages_used: Math.min(MAX_PAGES, Math.max(1, Math.ceil(candidates.length / 100))), // rough
    candidates_in_window: candidateIds.length,
    new_match_ids_found: newIds.length,
    note: "Collected match IDs from /publicMatches and filtered by time window.",
  });

  // 3) Fetch & cache full match JSONs for new IDs
  let cachedOk = 0;
  let cachedSkip = 0;
  let cachedFail = 0;
  let rateLimited = 0;

  for (const id of newIds) {
    const r = await fetchAndCacheMatch(id);

    if (r === "ok") cachedOk++;
    else if (r === "skip") cachedSkip++;
    else if (r === "fail") cachedFail++;
    else if (r === "rate_limited") {
      rateLimited++;
      // backoff a bit
      await sleep(Math.max(REQ_DELAY_MS * 8, 1500));
    }

    // Mark as seen regardless so we don't hammer the same IDs forever.
    seenSet.add(id);

    await sleep(REQ_DELAY_MS);
  }

  // Persist seen set (bounded to avoid infinite growth)
  // Keep a rolling list of last N seen IDs.
  const MAX_SEEN = clampInt(process.env.DOTA_MAX_SEEN_IDS ?? 200000) || 200000;
  const seenArr = Array.from(seenSet);
  // Keep newest by numeric value
  seenArr.sort((a, b) => b - a);
  const trimmed = seenArr.slice(0, MAX_SEEN);

  await writeJson(SEEN_PATH, { updated_at: nowIso(), seen: trimmed });

  await writeJson(LAST_SUCCESS_PATH, {
    finished_at: nowIso(),
    status: "ok",
    window_days: WINDOW_DAYS,
    candidates_in_window: candidateIds.length,
    attempted_new: newIds.length,
    cached_ok: cachedOk,
    cached_fail: cachedFail,
    rate_limited: rateLimited,
    matches_dir: path.relative(ROOT, MATCHES_DIR),
    note: "Build step caches match JSON only. Run finalize to produce output JSON.",
  });

  await writeJson(LAST_ATTEMPT_PATH, {
    started_at: startedAt,
    finished_at: nowIso(),
    status: "ok",
    window_days: WINDOW_DAYS,
    candidates_in_window: candidateIds.length,
    attempted_new: newIds.length,
    cached_ok: cachedOk,
    cached_fail: cachedFail,
    rate_limited: rateLimited,
  });

  console.log(
    `[dota-immortal] cached_ok=${cachedOk}, cached_fail=${cachedFail}, rate_limited=${rateLimited}, new_ids=${newIds.length}`
  );
}

main().catch(async (err) => {
  // ✅ do not fail CI
  try {
    await ensureDir(STATE_DIR);
    await writeJson(CHECKPOINT_PATH, {
      updated_at: nowIso(),
      phase: "build",
      status: "crashed",
      error: String(err?.message || err),
    });
    await writeJson(LAST_ATTEMPT_PATH, {
      started_at: nowIso(),
      finished_at: nowIso(),
      status: "crashed",
      error: String(err?.message || err),
    });
  } catch {}
  console.error(err);
  process.exit(0);
});
