#!/usr/bin/env node
// scripts/dota/finalize-immortal-from-cache.ts
//
// Reads cached match JSON files and computes Immortal-only hero picks/wins.
// Writes: public/data/dota/immortal_hero_stats.json
//
// Behavior:
// - Produces an output file whenever there is ANY usable data.
// - If computed data is tiny, it will NOT overwrite an existing good output.
// - Writes a checkpoint every run so you can debug quickly.

import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

type HeroAgg = { picks: number; wins: number };

const ROOT = process.cwd();

const CACHE_ROOT = path.join(ROOT, "scripts", "dota", "cache", "immortal_v2");
const MATCHES_DIR = path.join(CACHE_ROOT, "matches");
const STATE_DIR = path.join(CACHE_ROOT, "state");

const CHECKPOINT_PATH = path.join(STATE_DIR, "finalize_checkpoint.json");
const OUT_PATH = path.join(ROOT, "public", "data", "dota", "immortal_hero_stats.json");

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

function playerWon(matchRadiantWin: boolean, playerSlot: number) {
  const isRadiant = playerSlot < 128;
  return Boolean(isRadiant) === Boolean(matchRadiantWin);
}

async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function summarizeRows(rows: Array<{ hero_id: number; picks: number; wins: number }>) {
  const heroes = rows.length;
  const totalPicks = rows.reduce((s, r) => s + r.picks, 0);
  return { heroes, totalPicks };
}

/**
 * Overwrite policy:
 * - If we computed NOTHING => never overwrite. (Keep existing output if present.)
 * - If we computed something but it's "tiny" => overwrite ONLY if no previous output exists.
 * - Otherwise => overwrite.
 */
function classifyQuality(heroes: number, totalPicks: number) {
  // These are *soft* thresholds: tune via env if needed.
  const MIN_HEROES_OK = clampInt(process.env.DOTA_IMMORTAL_MIN_HEROES_OK ?? 70) || 70;
  const MIN_TOTAL_PICKS_OK = clampInt(process.env.DOTA_IMMORTAL_MIN_TOTAL_PICKS_OK ?? 5000) || 5000;

  const MIN_HEROES_TINY = clampInt(process.env.DOTA_IMMORTAL_MIN_HEROES_TINY ?? 10) || 10;
  const MIN_TOTAL_PICKS_TINY = clampInt(process.env.DOTA_IMMORTAL_MIN_TOTAL_PICKS_TINY ?? 200) || 200;

  if (heroes <= 0 || totalPicks <= 0) return "none" as const;

  // "tiny" means data exists but is probably not representative yet
  if (heroes < MIN_HEROES_TINY || totalPicks < MIN_TOTAL_PICKS_TINY) return "tiny" as const;

  // "partial" means usable but not at your "production-quality" bar
  if (heroes < MIN_HEROES_OK || totalPicks < MIN_TOTAL_PICKS_OK) return "partial" as const;

  return "ok" as const;
}

async function main() {
  await ensureDir(STATE_DIR);

  const WINDOW_DAYS = clampInt(process.env.DOTA_IMMORTAL_WINDOW_DAYS ?? 7) || 7;
  const MIN_RANK_TIER = clampInt(process.env.DOTA_IMMORTAL_MIN_RANK_TIER ?? 80) || 80;

  const minStart = Math.floor(Date.now() / 1000) - WINDOW_DAYS * 86400;

  let files: string[] = [];
  try {
    files = await fs.readdir(MATCHES_DIR);
  } catch {
    // No cache directory at all
    const hadPrev = await fileExists(OUT_PATH);
    await writeJson(CHECKPOINT_PATH, {
      updated_at: nowIso(),
      status: "no_cache",
      note: "No matches cache directory found.",
      cache_dir: path.relative(ROOT, MATCHES_DIR),
      kept_previous_output: hadPrev,
    });
    console.log("[dota-immortal] No cache to finalize.");
    process.exit(0);
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  if (!jsonFiles.length) {
    const hadPrev = await fileExists(OUT_PATH);
    await writeJson(CHECKPOINT_PATH, {
      updated_at: nowIso(),
      status: "no_files",
      note: "No cached match files found.",
      cache_dir: path.relative(ROOT, MATCHES_DIR),
      kept_previous_output: hadPrev,
    });
    console.log("[dota-immortal] No cached match files to finalize.");
    process.exit(0);
  }

  const agg = new Map<number, HeroAgg>();
  let matchesRead = 0;
  let matchesUsed = 0;
  let immortalPlayerRows = 0;
  let skippedOld = 0;

  for (const f of jsonFiles) {
    const p = path.join(MATCHES_DIR, f);
    const m = await readJson(p);
    matchesRead++;

    const startTime = clampInt(m?.start_time ?? 0);
    if (!startTime || startTime < minStart) {
      skippedOld++;
      continue;
    }

    const radiantWin = Boolean(m?.radiant_win);
    const players = Array.isArray(m?.players) ? m.players : [];
    if (!players.length) continue;

    let usedThisMatch = false;

    for (const pl of players) {
      const heroId = clampInt(pl?.hero_id ?? 0);
      const rankTier = clampInt(pl?.rank_tier ?? 0);
      const slot = clampInt(pl?.player_slot ?? -1);

      if (heroId <= 0) continue;
      if (slot < 0) continue;
      if (rankTier < MIN_RANK_TIER) continue;

      immortalPlayerRows++;
      usedThisMatch = true;

      const cur = agg.get(heroId) || { picks: 0, wins: 0 };
      cur.picks += 1;
      if (playerWon(radiantWin, slot)) cur.wins += 1;
      agg.set(heroId, cur);
    }

    if (usedThisMatch) matchesUsed++;
  }

  // Convert to rows
  const rows = Array.from(agg.entries())
    .map(([hero_id, v]) => {
      const picks = clampInt(v.picks);
      const wins = clampInt(v.wins);
      const winrate = picks > 0 ? wins / picks : 0;
      return { hero_id, picks, wins, winrate };
    })
    .sort((a, b) => b.picks - a.picks);

  const { heroes, totalPicks } = summarizeRows(rows);
  const quality = classifyQuality(heroes, totalPicks);

  const hadPrev = await fileExists(OUT_PATH);

  // If nothing computed: never overwrite; keep previous output if present
  if (quality === "none") {
    await writeJson(CHECKPOINT_PATH, {
      updated_at: nowIso(),
      status: "empty",
      note: "No usable Immortal rows computed from cache (likely rank_tier filter too strict or cache is old).",
      window_days: WINDOW_DAYS,
      min_rank_tier: MIN_RANK_TIER,
      matches_read: matchesRead,
      matches_used: matchesUsed,
      matches_skipped_old: skippedOld,
      immortal_player_rows: immortalPlayerRows,
      heroes,
      total_picks: totalPicks,
      kept_previous_output: hadPrev,
      out_file: hadPrev ? path.relative(ROOT, OUT_PATH) : null,
    });

    console.log("[dota-immortal] Computed 0 rows. Kept previous output:", hadPrev);
    process.exit(0);
  }

  // If tiny: only overwrite if no previous output exists
  if (quality === "tiny" && hadPrev) {
    await writeJson(CHECKPOINT_PATH, {
      updated_at: nowIso(),
      status: "tiny_refused_overwrite",
      note: "Computed dataset is tiny; refused to overwrite existing output. Keep crawling and rerun finalize.",
      window_days: WINDOW_DAYS,
      min_rank_tier: MIN_RANK_TIER,
      matches_read: matchesRead,
      matches_used: matchesUsed,
      matches_skipped_old: skippedOld,
      immortal_player_rows: immortalPlayerRows,
      heroes,
      total_picks: totalPicks,
      kept_previous_output: true,
      out_file: path.relative(ROOT, OUT_PATH),
    });

    console.log("[dota-immortal] Tiny dataset; refused overwrite. heroes=%d totalPicks=%d", heroes, totalPicks);
    process.exit(0);
  }

  // Otherwise, write output (ok/partial always writes, tiny writes only if no prev)
  const out = {
    generated_at: nowIso(),
    status: quality, // "ok" | "partial" | "tiny"
    source: "opendota_publicmatches+matches",
    window_days: WINDOW_DAYS,
    min_rank_tier: MIN_RANK_TIER,
    matches_used: matchesUsed,
    matches_read: matchesRead,
    matches_skipped_old: skippedOld,
    immortal_player_rows: immortalPlayerRows,
    heroes,
    total_picks: totalPicks,
    rows,
  };

  await writeJson(OUT_PATH, out);

  await writeJson(CHECKPOINT_PATH, {
    updated_at: nowIso(),
    status: "wrote_output",
    quality,
    window_days: WINDOW_DAYS,
    min_rank_tier: MIN_RANK_TIER,
    matches_used: matchesUsed,
    matches_read: matchesRead,
    matches_skipped_old: skippedOld,
    immortal_player_rows: immortalPlayerRows,
    heroes,
    total_picks: totalPicks,
    out_file: path.relative(ROOT, OUT_PATH),
    overwrote_previous_output: hadPrev,
  });

  console.log(
    `[dota-immortal] Finalized -> ${path.relative(ROOT, OUT_PATH)} quality=${quality} heroes=${heroes} totalPicks=${totalPicks}`
  );
}

main().catch(async (err) => {
  try {
    await ensureDir(STATE_DIR);
    await writeJson(CHECKPOINT_PATH, {
      updated_at: nowIso(),
      status: "crashed",
      error: String(err?.message || err),
    });
  } catch {}
  console.error(err);
  process.exit(0);
});
