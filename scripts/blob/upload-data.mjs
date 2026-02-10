// scripts/blob/upload-data.mjs
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

const ROOT = process.cwd();

/* =========================
   Env helpers
========================= */
function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function optionalEnv(name) {
  const v = process.env[name];
  return v ? String(v).trim() : "";
}

/* =========================
   Spec parsing
========================= */
/**
 * Provide uploads via env:
 * BLOB_UPLOADS="public/a.json=data/a.json;public/b.json=data/b.json"
 */
function parseUploads(spec) {
  return spec
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf("=");
      if (idx === -1) throw new Error(`Invalid BLOB_UPLOADS entry: ${pair}`);
      const localRel = pair.slice(0, idx).trim();
      const blobPath = pair.slice(idx + 1).trim();
      if (!localRel || !blobPath) throw new Error(`Invalid BLOB_UPLOADS entry: ${pair}`);
      return { localRel, blobPath };
    });
}

/**
 * Directories to upload recursively:
 * BLOB_UPLOAD_DIRS="public/data/lol/leaderboards;public/data/dota/immortal"
 *
 * Rule:
 * - localRel is the file path
 * - blobPath is derived by stripping "public/" prefix (so it becomes "data/..."
 */
function parseDirs(spec) {
  return spec
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getMaxFiles() {
  const raw = String(process.env.BLOB_MAX_FILES ?? "").trim();
  if (!raw) return 5000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid BLOB_MAX_FILES: ${raw}`);
  return n; // 0 = unlimited
}

/* =========================
   FS helpers
========================= */
async function walkFiles(dirAbs) {
  const out = [];
  const stack = [dirAbs];

  while (stack.length) {
    const cur = stack.pop();
    let entries = [];
    try {
      entries = await fs.readdir(cur, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) out.push(p);
    }
  }

  return out;
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function deriveBlobPathFromLocalRel(localRel) {
  const norm = localRel.replace(/\\/g, "/").replace(/^\/+/, "");
  if (norm.startsWith("public/")) return norm.slice("public/".length); // "data/..."
  return norm;
}

function guessContentType(blobPath) {
  const lower = String(blobPath).toLowerCase();
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

/* =========================
   Overwrite vs append policy
========================= */
/**
 * Your policy:
 * - Leaderboards: overwrite the same keys every run
 * - Meta builds + Champion tiers: "append" (keep history) using versioned keys
 *
 * WoW policy:
 * - WoW outputs should overwrite, because you want "latest" always
 *   (covers: data/wow/items/index.json, packs, quick-sim presets, etc.)
 */

function shouldOverwrite(blobPath) {
  // LoL
  if (blobPath.startsWith("data/lol/leaderboards/")) return true;
  if (blobPath === "data/manifest.json") return true;

  // ✅ Meta builds: overwrite stable "latest" keys (finalize already merges safely)
  if (blobPath === "data/lol/meta_builds_ranked.json") return true;
  if (blobPath === "data/lol/meta_builds_casual.json") return true;

  // ✅ WoW: overwrite everything under data/wow/
  if (blobPath.startsWith("data/wow/")) return true;

  return false;
}

function isMetaBuilds(blobPath) {
  return blobPath.includes("data/lol/meta_builds");
}

function isChampionTiers(blobPath) {
  return blobPath.startsWith("data/lol/champion_tiers");
}

function ensureNoExt(name) {
  return String(name || "").replace(/\.json$/i, "");
}

function utcStamp() {
  // Example: 2026-02-09T21-37-00Z
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${y}-${m}-${day}T${hh}-${mm}-${ss}Z`;
}

function sanitizeTag(s) {
  return String(s || "").trim().replace(/[^\w.\-]/g, "_");
}

function getPatchTag() {
  // Prefer LOL_PATCH, then BUILD_TAG, else fallback to UTC timestamp
  const p = optionalEnv("LOL_PATCH") || optionalEnv("BUILD_TAG");
  return p ? sanitizeTag(p) : utcStamp();
}

/**
 * Versioning scheme (append history):
 * - meta builds:
 *     data/lol/meta_builds_ranked.json
 *       -> data/lol/meta_builds/meta_builds_ranked/<TAG>.json
 * - champion tiers:
 *     data/lol/champion_tiers.json
 *       -> data/lol/champion_tiers/champion_tiers/<TAG>.json
 */
function toAppendKey(blobPath) {
  const tag = getPatchTag();

  const file = blobPath.split("/").pop() || blobPath;
  const stem = ensureNoExt(file);

  if (isMetaBuilds(blobPath)) {
    return `data/lol/meta_builds/${stem}/${tag}.json`;
  }

  if (isChampionTiers(blobPath)) {
    return `data/lol/champion_tiers/${stem}/${tag}.json`;
  }

  return blobPath;
}

/**
 * Cache policy:
 * - LoL leaderboards: 60s
 * - WoW: 60s (you asked for quick propagation)
 * - Everything else: BLOB_CACHE_SECONDS (default 300)
 */
function cacheSecondsFor(blobPath) {
  const defaultOther = Number(optionalEnv("BLOB_CACHE_SECONDS") || "300");

  if (blobPath.startsWith("data/lol/leaderboards/")) return 60;
  if (blobPath.startsWith("data/wow/")) return 60;

  return Number.isFinite(defaultOther) && defaultOther > 0 ? defaultOther : 300;
}

/* =========================
   Upload
========================= */
async function uploadOne({ localRel, blobPath }) {
  const localAbs = path.join(ROOT, localRel);

  let buf;
  try {
    buf = await fs.readFile(localAbs);
  } catch {
    console.log(`[skip] missing: ${localRel}`);
    return null;
  }

  const FORCE_OVERWRITE = String(optionalEnv("BLOB_FORCE_OVERWRITE") || "0") === "1";
const overwrite = FORCE_OVERWRITE || shouldOverwrite(blobPath);


  // Append-mode: meta builds + champion tiers go to versioned keys
  const targetPath =
    overwrite
      ? blobPath
      : (isMetaBuilds(blobPath) || isChampionTiers(blobPath) ? toAppendKey(blobPath) : blobPath);

  const cacheSeconds = cacheSecondsFor(blobPath);
  const contentType = guessContentType(targetPath);

  const res = await put(targetPath, buf, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: overwrite,
    contentType,
    cacheControlMaxAge: cacheSeconds,
  });

  console.log(
    `[ok] ${localRel} -> ${res.url} (key=${targetPath} overwrite=${overwrite} cache=${cacheSeconds}s)`
  );

  return { localRel, blobPath: targetPath, url: res.url, overwrite, cacheSeconds };
}

async function main() {
  mustEnv("BLOB_READ_WRITE_TOKEN");

  const filesSpec = optionalEnv("BLOB_UPLOADS");
  const dirsSpec = optionalEnv("BLOB_UPLOAD_DIRS");

  if (!filesSpec && !dirsSpec) {
    throw new Error(`Missing env var: BLOB_UPLOADS or BLOB_UPLOAD_DIRS (need at least one)`);
  }

  const uploads = [];

  // 1) explicit file uploads
  if (filesSpec) {
    uploads.push(...parseUploads(filesSpec));
  }

  // 2) directory uploads
  if (dirsSpec) {
    const dirs = parseDirs(dirsSpec);
    for (const dirRel of dirs) {
      const dirAbs = path.join(ROOT, dirRel);
      const absFiles = await walkFiles(dirAbs);

      for (const fAbs of absFiles) {
        const localRel = toPosix(path.relative(ROOT, fAbs));

        // ✅ keep JSON-only uploads for now (your design)
        if (!localRel.toLowerCase().endsWith(".json")) continue;

        const blobPath = deriveBlobPathFromLocalRel(localRel);
        uploads.push({ localRel, blobPath });
      }
    }
  }

  // de-dupe by blobPath (last one wins)
  const byPath = new Map();
  for (const u of uploads) byPath.set(u.blobPath, u);
  const finalUploads = [...byPath.values()];

  // safety guard
  const maxFiles = getMaxFiles();
  if (maxFiles > 0 && finalUploads.length > maxFiles) {
    throw new Error(
      `Refusing to upload ${finalUploads.length} files (BLOB_MAX_FILES=${maxFiles}). ` +
        `Increase BLOB_MAX_FILES or set it to 0 to disable.`
    );
  }

  console.log(`Uploading ${finalUploads.length} files...`);
  console.log(
    `[config] cache: leaderboards=60s, wow=60s, other=BLOB_CACHE_SECONDS=${optionalEnv("BLOB_CACHE_SECONDS") || "300"}`
  );
  console.log(
    `[config] append tag source LOL_PATCH="${optionalEnv("LOL_PATCH")}" BUILD_TAG="${optionalEnv("BUILD_TAG")}" (fallback=utc timestamp)`
  );

  const uploaded = [];
  for (const u of finalUploads) {
    const item = await uploadOne(u);
    if (item) uploaded.push(item);
  }

  // manifest
  const manifest = JSON.stringify({ updatedAt: new Date().toISOString(), uploaded }, null, 2);

  const manifestRes = await put("data/manifest.json", manifest, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });

  console.log(`[ok] manifest -> ${manifestRes.url}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
