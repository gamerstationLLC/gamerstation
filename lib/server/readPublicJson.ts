// lib/server/readPublicJson.ts
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

type ReadPublicJsonOptions = {
  revalidateSeconds?: number;
  noStore?: boolean;
};

function normalizePath(p: string) {
  return String(p ?? "").trim().replace(/^\/+/, "");
}
function normalizeBase(b: string) {
  return String(b ?? "").trim().replace(/\/+$/, "");
}

function getBlobBase() {
  const base = process.env.BLOB_BASE_URL || process.env.NEXT_PUBLIC_BLOB_BASE_URL || "";
  return normalizeBase(base);
}

function normalizeBlobKey(input: string) {
  const s = normalizePath(input);
  if (!s) return s;
  if (s.startsWith("public/data/")) return s.replace(/^public\/data\//, "data/");
  if (s.startsWith("data/")) return s;
  return `data/${s}`;
}

/**
 * Only these paths are allowed to come from Blob (per your policy):
 * - meta builds
 * - champion tiers
 * - leaderboards
 * - pokemon datasets (catch calc)
 *
 * Everything else must read from disk (/public/...) and should NOT hit Blob.
 */
function isBlobManaged(key: string) {
  // key is normalized like "data/..."
  if (key.startsWith("data/lol/leaderboards/")) return true;
  if (key.startsWith("data/lol/champion_tiers")) return true; // adjust if your file name differs
  if (key.includes("data/lol/meta_builds")) return true; // ranked/casual variants

  // ✅ Pokémon catch-calc datasets
  if (key.startsWith("data/pokemon/")) return true;

  return false;
}

async function readDiskJson<T>(key: string): Promise<T> {
  // key like "data/lol/champions_full.json" should exist at public/data/lol/...
  const localPath = path.join(process.cwd(), "public", key);
  const raw = await fs.readFile(localPath, "utf8");
  return JSON.parse(raw) as T;
}

async function readBlobJson<T>(key: string, opts: ReadPublicJsonOptions): Promise<T> {
  const base = getBlobBase();
  if (!base) throw new Error(`readPublicJson: Missing BLOB_BASE_URL / NEXT_PUBLIC_BLOB_BASE_URL (key="${key}")`);

  const url = `${base}/${key}`;
  const revalidateSeconds = typeof opts.revalidateSeconds === "number" ? opts.revalidateSeconds : 900;

  const res = await fetch(url, {
    ...(opts.noStore ? { cache: "no-store" as const } : {}),
    next: opts.noStore ? undefined : { revalidate: revalidateSeconds },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `readPublicJson: Blob fetch failed (${res.status}) url=${url} key="${key}"` +
        (text ? `\nBody: ${text.slice(0, 500)}` : "")
    );
  }

  return (await res.json()) as T;
}

export async function readPublicJson<T>(pathnameInput: string, opts: ReadPublicJsonOptions = {}): Promise<T> {
  const raw = normalizePath(pathnameInput);
  if (!raw) throw new Error("readPublicJson: missing pathname");

  const key = normalizeBlobKey(raw); // "data/..."

  // ✅ Enforce your policy:
  // - If it's blob-managed, use Blob (and fail loudly if missing)
  // - Otherwise, read from disk only (and never touch Blob)
  if (isBlobManaged(key)) {
    return readBlobJson<T>(key, opts);
  }

  return readDiskJson<T>(key);
}
