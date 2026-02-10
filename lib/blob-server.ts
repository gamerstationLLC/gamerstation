// lib/blob-server.ts
import "server-only";
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

// server reader (blob-first in prod)
export async function readPublicJson<T = any>(pathnameInput: string): Promise<T> {
  const pathname = normalizePath(pathnameInput);
  if (!pathname) throw new Error("Invalid path");

  const hasBlobBase = Boolean(process.env.BLOB_BASE_URL || process.env.NEXT_PUBLIC_BLOB_BASE_URL);
  const preferBlob = hasBlobBase && (process.env.VERCEL === "1" || process.env.NODE_ENV === "production");

  const localPath = path.join(process.cwd(), "public", pathname);
  const url = blobUrl(pathname);

  if (preferBlob) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return (await res.json()) as T;
    } catch {}
  }

  try {
    const raw = await fs.readFile(localPath, "utf8");
    return JSON.parse(raw) as T;
  } catch {}

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load JSON from disk or Blob: ${pathname} (${res.status})`);
  return (await res.json()) as T;
}
