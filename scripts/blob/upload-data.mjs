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

/**
 * Provide uploads via env:
 * BLOB_UPLOADS="public/data/lol/meta_builds_ranked.json=data/lol/meta_builds_ranked.json;public/data/lol/meta_builds_casual.json=data/lol/meta_builds_casual.json"
 *
 * Optional limits:
 * - BLOB_MAX_FILES: hard cap to avoid accidentally uploading thousands (default 5000)
 */
function parseUploads(spec) {
  return spec
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf("=");
      if (idx === -1) {
        throw new Error(`Invalid BLOB_UPLOADS entry (missing '='): ${pair}`);
      }
      const localRel = pair.slice(0, idx).trim();
      const blobPath = pair.slice(idx + 1).trim();
      if (!localRel || !blobPath) {
        throw new Error(`Invalid BLOB_UPLOADS entry: ${pair}`);
      }
      return [localRel, blobPath];
    });
}

function getMaxFiles() {
  const raw = String(process.env.BLOB_MAX_FILES ?? "").trim();
  if (!raw) return 0; // ✅ safe default for leaderboards
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid BLOB_MAX_FILES: ${raw}`);
  }
  return n; // 0 = unlimited, >0 = cap
}

async function main() {
  mustEnv("BLOB_READ_WRITE_TOKEN");
  const spec = mustEnv("BLOB_UPLOADS");

  const FILES = parseUploads(spec);

  // ✅ Max-files guard (default 5000, configurable)
  const maxFiles = getMaxFiles();
  if (maxFiles > 0 && FILES.length > maxFiles) {
    throw new Error(
      `Refusing to upload ${FILES.length} files (BLOB_MAX_FILES=${maxFiles}). ` +
        `This is a safety guard. Increase BLOB_MAX_FILES or set it to 0 to disable.`
    );
  }

  const uploaded = [];

  for (const [localRel, blobPath] of FILES) {
    const localPath = path.join(ROOT, localRel);

    let buf;
    try {
      buf = await fs.readFile(localPath);
    } catch {
      console.log(`[skip] missing: ${localRel}`);
      continue;
    }

    const res = await put(blobPath, buf, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: Number(process.env.BLOB_CACHE_SECONDS || "300"),
    });

    uploaded.push({ localRel, blobPath, url: res.url });
    console.log(`[ok] ${localRel} -> ${res.url}`);
  }

  // Optional manifest (safe + useful)
  const manifest = JSON.stringify(
    { updatedAt: new Date().toISOString(), uploaded },
    null,
    2
  );

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
