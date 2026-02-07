// lib/blob.ts
function normalizePath(p: string) {
  return String(p ?? "").trim().replace(/^\/+/, "");
}

function normalizeBase(b: string) {
  return String(b ?? "").trim().replace(/\/+$/, "");
}

/**
 * Returns absolute public Blob URL if a base is configured.
 * Otherwise returns "/<pathname>".
 */
export function blobUrl(pathnameInput: string): string {
  const pathname = normalizePath(pathnameInput);
  if (!pathname) return "/";

  // Prefer server-only base, fall back to public base if you need client usage too
  const base =
    process.env.BLOB_BASE_URL ||
    process.env.NEXT_PUBLIC_BLOB_BASE_URL ||
    "";

  if (!base) return `/${pathname}`;
  return `${normalizeBase(base)}/${pathname}`;
}

// Optional convenience alias if you want:
export const blob = blobUrl;
