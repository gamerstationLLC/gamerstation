// app/api/lol/patch/route.ts
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

type VersionJson = { version?: string; patch?: string };

const VERSION_BLOB_PATH = "data/lol/version.json";
const VERSION_DISK_PATH = path.join(process.cwd(), "public", "data", "lol", "version.json");

function blobUrl(pathname: string) {
  const base = process.env.NEXT_PUBLIC_BLOB_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/${pathname.replace(/^\/+/, "")}`;
}

async function readVersionFromBlob(): Promise<string | null> {
  const url = blobUrl(VERSION_BLOB_PATH);
  if (!url) return null;

  try {
    const res = await fetch(url, { next: { revalidate: 600 } }); // 10 min
    if (!res.ok) return null;
    const json = (await res.json()) as VersionJson;
    const v = String(json?.version ?? json?.patch ?? "").trim();
    return v || null;
  } catch {
    return null;
  }
}

async function readVersionFromDisk(): Promise<string | null> {
  try {
    const raw = await fs.readFile(VERSION_DISK_PATH, "utf-8");
    const json = JSON.parse(raw) as VersionJson;
    const v = String(json?.version ?? json?.patch ?? "").trim();
    return v || null;
  } catch {
    return null;
  }
}

async function readVersionFromDdragon(): Promise<string | null> {
  try {
    const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", {
      next: { revalidate: 21600 }, // 6 hours
    });
    if (!res.ok) return null;
    const versions = (await res.json()) as unknown;
    if (Array.isArray(versions) && typeof versions[0] === "string") {
      const v = String(versions[0]).trim();
      return v || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET() {
  // Priority:
  // 1) Blob version.json (your desired source of truth)
  // 2) Disk /public/data/lol/version.json (dev/local fallback)
  // 3) Data Dragon versions.json (last resort)
  const blobV = await readVersionFromBlob();
  if (blobV) {
    return NextResponse.json({ patch: blobV, source: "blob" });
  }

  const diskV = await readVersionFromDisk();
  if (diskV) {
    return NextResponse.json({ patch: diskV, source: "disk" });
  }

  const ddV = await readVersionFromDdragon();
  if (ddV) {
    return NextResponse.json({ patch: ddV, source: "ddragon" });
  }

  return NextResponse.json({ patch: "—", source: "none" });
}
