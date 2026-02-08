import fs from "node:fs/promises";
import path from "node:path";

function normalizePath(p: string) {
  return String(p ?? "").trim().replace(/^\/+/, "");
}

function normalizeBase(b: string) {
  return String(b ?? "").trim().replace(/\/+$/, "");
}

export function blobUrl(pathnameInput: string): string {
  const pathname = normalizePath(pathnameInput);
  if (!pathname) return "/";

  const base =
    process.env.BLOB_BASE_URL ||
    process.env.NEXT_PUBLIC_BLOB_BASE_URL ||
    "";

  if (!base) return `/${pathname}`;
  return `${normalizeBase(base)}/${pathname}`;
}

/**
 * PRODUCTION:
 *   Blob first → Disk fallback
 *
 * DEVELOPMENT:
 *   Disk first → Blob fallback
 */
export async function readPublicJson<T = any>(pathnameInput: string): Promise<T> {
  const pathname = normalizePath(pathnameInput);
  if (!pathname) throw new Error("Invalid path");

  const localPath = path.join(process.cwd(), "public", pathname);
  const url = blobUrl(pathname);

  const isProd =
    process.env.VERCEL === "1" ||
    process.env.NODE_ENV === "production";

  // ✅ Production: Blob first
  if (isProd) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return (await res.json()) as T;
    } catch {}
  }

  // ✅ Disk fallback
  try {
    const raw = await fs.readFile(localPath, "utf8");
    return JSON.parse(raw) as T;
  } catch {}

  // ✅ Final Blob attempt
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Failed to load JSON from disk or Blob: ${pathname} (${res.status})`
    );
  }

  return (await res.json()) as T;
}
