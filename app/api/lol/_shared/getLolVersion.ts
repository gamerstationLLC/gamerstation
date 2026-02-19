// app/api/_shared/getLolVersion.ts
import fs from "node:fs/promises";
import path from "node:path";

export type VersionJson = {
  patch?: string;
  ddragon?: string;
  version?: string; // legacy alias
  chosenRealm?: string | null;
  updatedAt?: string;
  source?: string;
};

const VERSION_BLOB_PATH = "data/lol/version.json";
const VERSION_DISK_PATH = path.join(process.cwd(), "public", "data", "lol", "version.json");

function blobUrl(pathname: string) {
  const base = process.env.NEXT_PUBLIC_BLOB_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/${pathname.replace(/^\/+/, "")}`;
}

function normalize(x: unknown): string | null {
  const v = String(x ?? "").trim();
  return v ? v : null;
}

function pick(json: VersionJson | null): { patch: string | null; ddragon: string | null } {
  if (!json) return { patch: null, ddragon: null };
  const patch = normalize(json.patch) ?? normalize(json.version);
  const ddragon = normalize(json.ddragon) ?? normalize(json.version) ?? normalize(json.patch);
  return { patch, ddragon };
}

function cmpVersion(a?: string, b?: string) {
  const pa = String(a || "").split(".").map((x) => Number.parseInt(x, 10) || 0);
  const pb = String(b || "").split(".").map((x) => Number.parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

async function readFromBlob(): Promise<VersionJson | null> {
  const url = blobUrl(VERSION_BLOB_PATH);
  if (!url) return null;

  try {
    const res = await fetch(url, { next: { revalidate: 600 } }); // 10 min
    if (!res.ok) return null;
    return (await res.json()) as VersionJson;
  } catch {
    return null;
  }
}

async function readFromDisk(): Promise<VersionJson | null> {
  try {
    const raw = await fs.readFile(VERSION_DISK_PATH, "utf-8");
    return (JSON.parse(raw) as VersionJson) ?? null;
  } catch {
    return null;
  }
}

async function readFromRealms(): Promise<VersionJson | null> {
  const realms = ["na", "euw", "kr"];
  let best: { region: string; v?: string; dd?: string } | null = null;

  for (const r of realms) {
    const url = `https://ddragon.leagueoflegends.com/realms/${r}.json`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const j = await res.json();

      const v = typeof j?.v === "string" ? j.v : undefined;
      const dd = typeof j?.dd === "string" ? j.dd : undefined;

      if (v && (!best || cmpVersion(v, best.v) > 0)) best = { region: r, v, dd };
    } catch {
      // ignore
    }
  }

  if (!best?.v) return null;

  return {
    patch: best.v,
    ddragon: best.dd ?? best.v,
    version: best.dd ?? best.v,
    chosenRealm: best.region,
    updatedAt: new Date().toISOString(),
    source: "ddragon-realms-fallback",
  };
}

export async function getLolVersion() {
  const blobJson = await readFromBlob();
  const fromBlob = pick(blobJson);
  if (fromBlob.patch) {
    return {
      patch: fromBlob.patch,
      ddragon: fromBlob.ddragon,
      version: normalize(blobJson?.version) ?? fromBlob.ddragon ?? fromBlob.patch,
      chosenRealm: blobJson?.chosenRealm ?? null,
      fallbackUsed: false,
      source: "blob" as const,
    };
  }

  const diskJson = await readFromDisk();
  const fromDisk = pick(diskJson);
  if (fromDisk.patch) {
    return {
      patch: fromDisk.patch,
      ddragon: fromDisk.ddragon,
      version: normalize(diskJson?.version) ?? fromDisk.ddragon ?? fromDisk.patch,
      chosenRealm: diskJson?.chosenRealm ?? null,
      fallbackUsed: true,
      source: "disk" as const,
    };
  }

  const realmJson = await readFromRealms();
  const fromRealms = pick(realmJson);
  if (fromRealms.patch) {
    return {
      patch: fromRealms.patch,
      ddragon: fromRealms.ddragon,
      version: normalize(realmJson?.version) ?? fromRealms.ddragon ?? fromRealms.patch,
      chosenRealm: realmJson?.chosenRealm ?? null,
      fallbackUsed: true,
      source: "realms" as const,
    };
  }

  return {
    patch: "unknown",
    ddragon: "unknown",
    version: "unknown",
    chosenRealm: null,
    fallbackUsed: true,
    source: "none" as const,
  };
}
