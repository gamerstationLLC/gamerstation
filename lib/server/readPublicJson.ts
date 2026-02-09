// lib/server/readPublicJson.ts
import fs from "node:fs/promises";
import path from "node:path";
import { blobUrl } from "@/lib/blob-client";

type ReadPublicJsonOptions = {
  /**
   * If true, skip disk read and go straight to Blob.
   * Default false.
   */
  preferBlob?: boolean;

  /**
   * Optional fetch revalidate seconds for Blob fetch.
   * Default 900 (15 min).
   */
  revalidateSeconds?: number;
};

/**
 * Paths that should ALWAYS be read from Blob in production (high-churn / blob-managed datasets).
 * Add only the datasets that your CI uploads to Blob (and are not reliably present on disk in prod).
 */
const BLOB_ONLY_PREFIXES = [
  // LoL leaderboards JSONs
  "data/lol/leaderboards/",

  // LoL meta builds JSONs
  "data/lol/meta_builds_",

  // LoL champion tiers (if you store/upload these to Blob)
  "data/lol/champion_tiers/",
  "data/lol/champ_tiers/",
  "data/lol/tiers/",
];

function isBlobOnlyPath(p: string) {
  return BLOB_ONLY_PREFIXES.some((pref) => p.startsWith(pref));
}

/**
 * Read JSON from:
 *  1) local disk: /public/<pathname>
 *  2) Blob (absolute url from NEXT_PUBLIC_BLOB_BASE_URL)
 *
 * pathname examples:
 *  - "data/lol/items.json"
 *  - "/data/lol/items.json"
 */
export async function readPublicJson<T>(
  pathnameInput: string,
  opts: ReadPublicJsonOptions = {}
): Promise<T> {
  const revalidateSeconds =
    typeof opts.revalidateSeconds === "number" ? opts.revalidateSeconds : 900;

  const pathname = String(pathnameInput ?? "")
    .trim()
    .replace(/^\/+/, ""); // remove leading slashes

  if (!pathname) throw new Error("readPublicJson: missing pathname");

  // Force Blob for specific prefixes (or if caller requested preferBlob)
  const forcedBlob = isBlobOnlyPath(pathname);
  const preferBlob = forcedBlob || Boolean(opts.preferBlob);

  // 1) Try disk first (unless preferBlob)
  if (!preferBlob) {
    try {
      const abs = path.join(process.cwd(), "public", pathname);
      const raw = await fs.readFile(abs, "utf-8");
      return JSON.parse(raw) as T;
    } catch {
      // fall through to Blob fetch
    }
  }

  // 2) Blob fetch (must be absolute in prod)
  const url = blobUrl(pathname);

  // If blobUrl fell back to "/data/..." but disk read failed, we can’t fetch relative on server reliably.
  // So require NEXT_PUBLIC_BLOB_BASE_URL for this path.
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(
      `readPublicJson: ${
        preferBlob ? "preferBlob/forcedBlob is true" : "disk read failed"
      } and NEXT_PUBLIC_BLOB_BASE_URL is not set (needed to fetch ${pathname}).`
    );
  }

  const res = await fetch(url, {
    // Next.js cache hint
    next: { revalidate: revalidateSeconds },
  });

  if (!res.ok) {
    throw new Error(`readPublicJson: fetch failed (${res.status}) for ${url}`);
  }

  return (await res.json()) as T;
}
