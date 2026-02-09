import { blobUrl } from "@/lib/blob-client";

async function safeFetchJson<T>(url: string, cache: RequestCache = "no-store"): Promise<T | null> {
  try {
    const res = await fetch(url, { cache });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchJsonBlobFirst<T>(
  blobPath: string,     // "data/lol/meta_builds_ranked.json"
  diskPath: string,     // "/data/lol/meta_builds_ranked.json"
  opts?: { cache?: RequestCache; debugLabel?: string }
): Promise<{ json: T; source: "blob" | "disk" }> {
  const cache = opts?.cache ?? "no-store";

  const bUrl = blobUrl(blobPath);

  const fromBlob = await safeFetchJson<T>(bUrl, cache);
  if (fromBlob) {
    if (opts?.debugLabel) console.log(`[${opts.debugLabel}] source=blob`, bUrl);
    return { json: fromBlob, source: "blob" };
  }

  const fromDisk = await safeFetchJson<T>(diskPath, cache);
  if (fromDisk) {
    if (opts?.debugLabel) console.log(`[${opts.debugLabel}] source=disk`, diskPath);
    return { json: fromDisk, source: "disk" };
  }

  throw new Error(
    `Failed to load JSON (blob first, disk fallback): ${bUrl} OR ${diskPath}`
  );
}
