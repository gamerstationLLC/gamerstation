// app/tools/lol/items/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import ItemsIndexClient from "./client";

export const metadata: Metadata = {
  title: "LoL Items | GamerStation",
  description:
    "League of Legends items index with win rate, pick volume, and top champions who build each item.",
};

type ItemUsageRow = {
  itemId: number;
  slug: string;
  games: number;
  wins: number;
  winrate: number; // 0..1
  topChamps: Array<{
    champId: number;
    games: number;
    wins: number;
    winrate: number; // 0..1
  }>;
};

type ItemsUsageFile = {
  generatedAt: string;
  source: "ranked" | "casual" | "combined";
  patchBucket?: string;
  items: ItemUsageRow[];
};

// ✅ Your items.json (Data Dragon shaped)
type LoLItemsJson = {
  version?: string; // ddversion for assets (e.g. "16.4.1")
  type?: string;
  basic?: any;
  data: Record<
    string,
    {
      name?: string;
      tags?: string[];
      gold?: { total?: number; sell?: number };
      image?: { full?: string };
      maps?: Record<string, boolean>;
      requiredChampion?: string;
      inStore?: boolean;
      hideFromAll?: boolean;
    }
  >;
};

type DDragonChampionLite = {
  id: string; // "Aatrox"
  key: string; // "266"
  name: string; // "Aatrox"
};

type DDragonChampionJson = {
  version?: string;
  data: Record<string, DDragonChampionLite>;
};

type LolVersionJson = {
  patch?: string; // display patch (e.g. "26.4")
  ddragon?: string; // dd assets (e.g. "16.4.1")
  version?: string; // legacy alias for display patch
  updatedAt?: string;
  source?: string;
};

export type EnrichedItemRow = {
  itemId: number;
  slug: string;
  name: string;
  iconUrl: string;
  costTotal: number | null;
  tags: string[];
  games: number;
  wins: number;
  winrate: number;
  topChamps: Array<{
    champId: number;
    champName: string;
    champKey: string | null;
    champIconUrl: string | null;
    games: number;
    wins: number;
    winrate: number;
  }>;
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function slugify(name: string) {
  return (name || "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getBlobBase(): string {
  return (
    process.env.NEXT_PUBLIC_BLOB_BASE_URL ||
    process.env.BLOB_BASE_URL ||
    process.env.NEXT_PUBLIC_BLOB_BASE ||
    ""
  );
}

// ✅ Disk-first (good for items.json and other static files that exist in repo)
async function readJsonDiskFirst<T>(publicRelPath: string): Promise<T | null> {
  const rel = publicRelPath.startsWith("/") ? publicRelPath.slice(1) : publicRelPath;
  const diskPath = `${process.cwd()}/public/${rel}`;

  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(diskPath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    // ignore
  }

  const base = getBlobBase();
  if (!base) return null;

  try {
    const url = `${base.replace(/\/+$/, "")}/${rel}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ✅ Blob-first (ONLY for items_usage_* per your request)
async function readJsonBlobFirst<T>(publicRelPath: string): Promise<T | null> {
  const rel = publicRelPath.startsWith("/") ? publicRelPath.slice(1) : publicRelPath;
  const base = getBlobBase();

  if (base) {
    try {
      const url = `${base.replace(/\/+$/, "")}/${rel}`;
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (res.ok) return (await res.json()) as T;
    } catch {
      // ignore and fall back
    }
  }

  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(`${process.cwd()}/public/${rel}`, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ✅ Display patch: READ ONLY FROM /public/data/lol/version.json (disk-only)
async function readDisplayPatchDiskOnly(): Promise<{
  displayPatch: string;
  ddragonFromVersionJson: string | null;
  updatedAt: string | null;
  source: string | null;
}> {
  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(`${process.cwd()}/public/data/lol/version.json`, "utf8");
    const json = JSON.parse(raw) as LolVersionJson;

    const displayPatch = (json.patch || json.version || "").trim() || "unknown";
    const ddragonFromVersionJson = (json.ddragon || "").trim() || null;

    return {
      displayPatch,
      ddragonFromVersionJson,
      updatedAt: (json.updatedAt || "").trim() || null,
      source: (json.source || "").trim() || null,
    };
  } catch {
    return {
      displayPatch: "unknown",
      ddragonFromVersionJson: null,
      updatedAt: null,
      source: null,
    };
  }
}

// NOTE: patch for icons should match the items.json version (most consistent)
async function getChampIdToKeyMap(
  ddragonPatch: string
): Promise<Map<number, { key: string; name: string }>> {
  try {
    const res = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${ddragonPatch}/data/en_US/champion.json`,
      { next: { revalidate: 60 * 60 * 24 } }
    );
    if (!res.ok) return new Map();

    const json = (await res.json()) as DDragonChampionJson;
    const map = new Map<number, { key: string; name: string }>();

    for (const c of Object.values(json.data || {})) {
      const champId = Number(c.key);
      if (!Number.isFinite(champId) || champId <= 0) continue;
      map.set(champId, { key: c.id, name: c.name });
    }

    return map;
  } catch {
    return new Map();
  }
}

function isRealStoreItem(d: any): boolean {
  if (!d) return false;
  if (d.inStore === false) return false;
  if (d.hideFromAll === true) return false;
  if (typeof d.requiredChampion === "string" && d.requiredChampion.trim()) return false;
  if (typeof d.name !== "string" || !d.name.trim()) return false;
  return true;
}

export default async function ItemsIndexPage() {
  // ✅ display patch ONLY from /public/data/lol/version.json
  const versionInfo = await readDisplayPatchDiskOnly();
  const displayPatch = versionInfo.displayPatch;

  // ✅ usage is Blob-first
  const usage = await readJsonBlobFirst<ItemsUsageFile>("/data/lol/items_usage_combined.json");

  // ✅ items.json is canonical list + DDragon asset version (keep this for icons)
  const itemsJson = await readJsonDiskFirst<LoLItemsJson>("/data/lol/items.json");
  const ddragonPatch = (itemsJson?.version || "unknown").trim();

  const cacheTag = `lol-items-${ddragonPatch}-${usage?.source ?? "unknown"}`;

  // Page shell (your Dota style)
  const Shell = ({
    children,
    subtitle,
  }: {
    children: React.ReactNode;
    subtitle?: React.ReactNode;
  }) => (
    <main className="relative min-h-screen overflow-hidden bg-transparent text-white">
      <div className="relative px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <header className="mb-6 flex items-center">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/gs-logo-v2.png"
                alt="GamerStation"
                className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_30px_rgba(0,255,255,0.12)]"
              />
              <span className="text-lg font-black tracking-tight">
                GamerStation
                <span className="align-super text-[0.6em]">™</span>
              </span>
            </Link>

            <Link
              href="/tools"
              className="ml-auto rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white"
            >
              Tools
            </Link>
          </header>

          <h1 className="text-4xl font-bold tracking-tight">LoL Items</h1>

          <p className="mt-3 text-neutral-300">
            League items with win rate + popularity from GamerStation meta builds. Item data from Data Dragon.
            <span className="text-neutral-500"> (Auto refresh on patch change)</span>
          </p>

          {subtitle ? <div className="mt-3 text-sm text-neutral-400">{subtitle}</div> : null}

          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );

  if (!itemsJson?.data || !ddragonPatch || ddragonPatch === "unknown") {
    return (
      <Shell subtitle="Missing items.json (canonical item list).">
        <div className="rounded-2xl border border-neutral-800 bg-black/40 p-5 text-neutral-200">
          Missing <span className="font-mono text-neutral-100">/public/data/lol/items.json</span>{" "}
          (disk-first, blob fallback).
        </div>
      </Shell>
    );
  }

  // build lookup for usage by itemId
  const usageById = new Map<number, ItemUsageRow>();
  for (const row of usage?.items || []) {
    if (Number.isFinite(row.itemId)) usageById.set(row.itemId, row);
  }

  // champ map for top champ icons/names (use DDragon asset patch)
  const champMap = await getChampIdToKeyMap(ddragonPatch);

  // ✅ canonical index = all items from items.json
  const enriched: EnrichedItemRow[] = Object.entries(itemsJson.data)
    .map(([idStr, d]) => {
      const itemId = Number(idStr);
      if (!Number.isFinite(itemId) || itemId <= 0) return null;
      if (!isRealStoreItem(d)) return null;

      const name = (d?.name || `Item ${itemId}`).trim();
      const slug = slugify(name);

      const iconFile = d?.image?.full || `${itemId}.png`;
      const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${ddragonPatch}/img/item/${iconFile}`;

      const tags = Array.isArray(d?.tags) ? d.tags : [];
      const costTotal =
        typeof d?.gold?.total === "number" && Number.isFinite(d.gold.total) ? d.gold.total : null;

      const u = usageById.get(itemId);

      const topChamps = (u?.topChamps || []).map((c) => {
        const meta = champMap.get(c.champId);
        const champName = meta?.name || `Champion ${c.champId}`;
        const champKey = meta?.key || null;
        const champIconUrl = champKey
          ? `https://ddragon.leagueoflegends.com/cdn/${ddragonPatch}/img/champion/${champKey}.png`
          : null;

        return {
          champId: c.champId,
          champName,
          champKey,
          champIconUrl,
          games: c.games,
          wins: c.wins,
          winrate: clamp01(c.winrate),
        };
      });

      return {
        itemId,
        slug,
        name,
        iconUrl,
        costTotal,
        tags,

        games: u?.games ?? 0,
        wins: u?.wins ?? 0,
        winrate: clamp01(u?.winrate ?? 0),

        topChamps,
      } satisfies EnrichedItemRow;
    })
    .filter(Boolean) as EnrichedItemRow[];

  // Sort: usage-heavy first, then cost/name stable
  enriched.sort((a, b) => {
    if (b.games !== a.games) return b.games - a.games;
    const ac = a.costTotal ?? 0;
    const bc = b.costTotal ?? 0;
    if (bc !== ac) return bc - ac;
    return a.name.localeCompare(b.name);
  });

  const generatedAt = usage?.generatedAt || new Date().toISOString();
  const source = usage?.source || "combined";

  return (
    <Shell
      subtitle={
        <>
          Patch <span className="font-semibold text-neutral-200">{displayPatch}</span> ·{" "}
          <span className="font-semibold text-neutral-200">{enriched.length}</span> items · usage{" "}
          <span className="font-semibold text-neutral-200">{source}</span> · generated{" "}
          <span className="font-semibold text-neutral-200">
            {new Date(generatedAt).toLocaleString()}
          </span>
          <span className="text-neutral-600">
            {" "}
            · assets <span className="font-semibold text-neutral-400">{ddragonPatch}</span>
          </span>
        </>
      }
    >
      <ItemsIndexClient
        key={cacheTag}
        patch={ddragonPatch}
        items={enriched}
        generatedAt={generatedAt}
        source={source}
        totalItems={enriched.length}
      />
    </Shell>
  );
}