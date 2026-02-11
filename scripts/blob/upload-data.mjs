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

function envBool(name) {
  const v = optionalEnv(name).toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "y" || v === "on";
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
 * - blobPath is derived by stripping "public/" prefix (so it becomes "data/...")
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
 * - Leaderboards: overwrite
 * - Meta builds + Champion tiers: append versioned
 * - WoW: overwrite
 * - ✅ Pokémon: overwrite (you iterate + rename often)
 *
 * Global override:
 * - BLOB_OVERWRITE=1 will overwrite EVERYTHING
 */

function shouldOverwrite(blobPath) {
  // LoL
  if (blobPath.startsWith("data/lol/leaderboards/")) return true;
  if (blobPath === "data/manifest.json") return true;

  // WoW
  if (blobPath.startsWith("data/wow/")) return true;

  // ✅ Pokémon
  if (blobPath.startsWith("data/pokemon/")) return true;

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
  const p = optionalEnv("LOL_PATCH") || optionalEnv("BUILD_TAG");
  return p ? sanitizeTag(p) : utcStamp();
}

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

  const forceOverwrite = envBool("BLOB_OVERWRITE") || envBool("BLOB_FORCE_OVERWRITE");
  const overwrite = forceOverwrite ? true : shouldOverwrite(blobPath);

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

  if (filesSpec) uploads.push(...parseUploads(filesSpec));

  if (dirsSpec) {
    const dirs = parseDirs(dirsSpec);
    for (const dirRel of dirs) {
      const dirAbs = path.join(ROOT, dirRel);
      const absFiles = await walkFiles(dirAbs);

      for (const fAbs of absFiles) {
        const localRel = toPosix(path.relative(ROOT, fAbs));
        if (!localRel.toLowerCase().endsWith(".json")) continue;

        const blobPath = deriveBlobPathFromLocalRel(localRel);
        uploads.push({ localRel, blobPath });
      }
    }
  }

  // de-dupe by blobPath (last wins)
  const byPath = new Map();
  for (const u of uploads) byPath.set(u.blobPath, u);
  const finalUploads = [...byPath.values()];

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
  console.log(
    `[config] overwrite override: BLOB_OVERWRITE=${optionalEnv("BLOB_OVERWRITE") || "0"} BLOB_FORCE_OVERWRITE=${optionalEnv("BLOB_FORCE_OVERWRITE") || "0"}`
  );

  const uploaded = [];
  for (const u of finalUploads) {
    const item = await uploadOne(u);
    if (item) uploaded.push(item);
  }

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
