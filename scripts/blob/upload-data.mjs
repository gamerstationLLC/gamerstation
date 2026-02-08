// scripts/blob/upload-data.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

const ROOT = process.cwd();

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function optionalEnv(name) {
  const v = process.env[name];
  return v ? String(v).trim() : "";
}

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
  if (!raw) return 5000; // sane default
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid BLOB_MAX_FILES: ${raw}`);
  return n; // 0 = unlimited
}

async function existsFile(p) {
  try {
    const st = await fs.stat(p);
    return st.isFile();
  } catch {
    return false;
  }
}

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
  // Expect localRel like "public/data/lol/leaderboards/na1/..."
  const norm = localRel.replace(/\\/g, "/").replace(/^\/+/, "");
  if (norm.startsWith("public/")) return norm.slice("public/".length); // "data/..."
  return norm;
}

async function uploadOne({ localRel, blobPath, cacheSeconds }) {
  const localAbs = path.join(ROOT, localRel);

  let buf;
  try {
    buf = await fs.readFile(localAbs);
  } catch {
    console.log(`[skip] missing: ${localRel}`);
    return null;
  }

  const res = await put(blobPath, buf, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: cacheSeconds,
  });

  console.log(`[ok] ${localRel} -> ${res.url}`);
  return { localRel, blobPath, url: res.url };
}

async function main() {
  mustEnv("BLOB_READ_WRITE_TOKEN"); // ensures token exists
  const cacheSeconds = Number(optionalEnv("BLOB_CACHE_SECONDS") || "300");

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
        // localRel in repo-relative form
        const localRel = toPosix(path.relative(ROOT, fAbs));

        // only upload json files (safe)
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

  const uploaded = [];
  for (const u of finalUploads) {
    const item = await uploadOne({ ...u, cacheSeconds });
    if (item) uploaded.push(item);
  }

  // manifest (useful)
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
