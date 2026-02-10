// lib/blob-client.ts
function normalizePath(p: string) {
  return String(p ?? "").trim().replace(/^\/+/, "");
}
function normalizeBase(b: string) {
  return String(b ?? "").trim().replace(/\/+$/, "");
}

/**
 * Client-safe URL builder (NO fs/path imports).
 * ✅ Uses NEXT_PUBLIC_BLOB_BASE_URL when set
 * ✅ Also uses a DEV fallback base so you can test Blob locally without commits
 */
export function blobUrl(pathnameInput: string): string {
  const pathname = normalizePath(pathnameInput);
  if (!pathname) return "/";

  const DEV_FALLBACK_BASE =
    "https://or3vgdqybw6oou7j.public.blob.vercel-storage.com";

  const base =
    process.env.NEXT_PUBLIC_BLOB_BASE_URL ||
    (process.env.NODE_ENV === "development" ? DEV_FALLBACK_BASE : "");

  if (!base) return `/${pathname}`;
  return `${normalizeBase(base)}/${pathname}`;
}
