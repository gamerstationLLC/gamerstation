// lib/blob-client.ts
function normalizePath(p: string) {
  return String(p ?? "").trim().replace(/^\/+/, "");
}
function normalizeBase(b: string) {
  return String(b ?? "").trim().replace(/\/+$/, "");
}

/** Client-safe: URL builder only (NO fs/path imports). */
export function blobUrl(pathnameInput: string): string {
  const pathname = normalizePath(pathnameInput);
  if (!pathname) return "/";

  const base =
    process.env.NEXT_PUBLIC_BLOB_BASE_URL ||
    "";

  if (!base) return `/${pathname}`;
  return `${normalizeBase(base)}/${pathname}`;
}
