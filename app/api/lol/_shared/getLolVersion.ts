// app/api/lol/_shared/getLolVersion.ts
import fs from "node:fs/promises";
import path from "node:path";

export type VersionJson = {
  patch?: string; // display patch (e.g. "26.4")
  ddragon?: string; // ddragon asset version (e.g. "16.4.1") - optional
  version?: string; // legacy alias (treat as display patch)
  chosenRealm?: string | null;
  updatedAt?: string;
  source?: string;
};

type Source = "blob" | "disk" | "realms" | "none";
type DdragonSource = "realms" | "versions" | "none";

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

function pickDisplayPatch(json: VersionJson | null): string | null {
  if (!json) return null;
  return normalize(json.patch) ?? normalize(json.version) ?? null;
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

async function readDdragonAssetVersion(): Promise<{
  ddragon: string | null;
  chosenRealm: string | null;
  realmsTried: any[];
  source: DdragonSource;
}> {
  const realms = ["na", "euw", "kr"];
  const tried: any[] = [];

  let best: { region: string; v?: string; dd?: string } | null = null;

  for (const r of realms) {
    const url = `https://ddragon.leagueoflegends.com/realms/${r}.json`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        tried.push({ region: r, ok: false, status: res.status });
        continue;
      }
      const j = await res.json();

      const v = typeof j?.v === "string" ? j.v : undefined;
      const dd = typeof j?.dd === "string" ? j.dd : undefined;

      tried.push({ region: r, ok: true, v, dd });

      const candidate = dd ?? v;
      if (candidate && (!best || cmpVersion(candidate, best.dd ?? best.v) > 0)) {
        best = { region: r, v, dd: candidate };
      }
    } catch (e: any) {
      tried.push({ region: r, ok: false, error: String(e?.message ?? e) });
    }
  }

  const bestDd = normalize(best?.dd);
  if (bestDd) {
    return { ddragon: bestDd, chosenRealm: best?.region ?? null, realmsTried: tried, source: "realms" };
  }

  // Fallback: versions.json (first item)
  try {
    const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", {
      next: { revalidate: 60 * 60 }, // 1 hour
    });
    if (res.ok) {
      const arr = (await res.json()) as unknown;
      if (Array.isArray(arr) && typeof arr[0] === "string") {
        const v0 = normalize(arr[0]);
        if (v0) return { ddragon: v0, chosenRealm: null, realmsTried: tried, source: "versions" };
      }
    }
  } catch {
    // ignore
  }

  return { ddragon: null, chosenRealm: null, realmsTried: tried, source: "none" };
}

export async function getLolVersion(): Promise<{
  patch: string;
  ddragon: string;
  version: string;
  chosenRealm: string | null;
  fallbackUsed: boolean;
  source: Source;
  ddragonSource: DdragonSource;
  updatedAt: string;
  realmsTried?: any[];
}> {
  // 1) Display patch (26.x): blob -> disk -> unknown
  const blobJson = await readFromBlob();
  const blobPatch = pickDisplayPatch(blobJson);

  if (blobPatch) {
    const dd = await readDdragonAssetVersion();
    return {
      patch: blobPatch, // ✅ 26.4
      ddragon: dd.ddragon ?? "unknown", // ✅ 16.x.x for assets
      version: blobPatch, // legacy: keep “version” == display patch
      chosenRealm: dd.chosenRealm ?? (blobJson?.chosenRealm ?? null),
      fallbackUsed: false,
      source: "blob",
      ddragonSource: dd.source,
      updatedAt: blobJson?.updatedAt ?? new Date().toISOString(),
      realmsTried: dd.realmsTried,
    };
  }

  const diskJson = await readFromDisk();
  const diskPatch = pickDisplayPatch(diskJson);

  if (diskPatch) {
    const dd = await readDdragonAssetVersion();
    return {
      patch: diskPatch,
      ddragon: dd.ddragon ?? "unknown",
      version: diskPatch,
      chosenRealm: dd.chosenRealm ?? (diskJson?.chosenRealm ?? null),
      fallbackUsed: true,
      source: "disk",
      ddragonSource: dd.source,
      updatedAt: diskJson?.updatedAt ?? new Date().toISOString(),
      realmsTried: dd.realmsTried,
    };
  }

  const dd = await readDdragonAssetVersion();
  return {
    patch: "unknown",
    ddragon: dd.ddragon ?? "unknown",
    version: "unknown",
    chosenRealm: dd.chosenRealm ?? null,
    fallbackUsed: true,
    source: "none",
    ddragonSource: dd.source,
    updatedAt: new Date().toISOString(),
    realmsTried: dd.realmsTried,
  };
}
