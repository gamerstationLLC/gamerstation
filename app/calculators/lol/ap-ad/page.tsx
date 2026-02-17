import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";

import ItemCompareClient from "./client";
import { readPublicJson } from "@/lib/server/readPublicJson";

export const metadata: Metadata = {
  title: "LoL Item Compare (Champion Stats + Deltas) | GamerStation",
  description:
    "Pick a champion to import base stats by level, then compare two items with clean green/red deltas. Summoner's Rift items only.",
};

// keep it similar to your LoL page
export const revalidate = 21600; // 6 hours

type LolChampionFile = {
  version?: string;
  champions?: any[];
};

type LolItemsFile = {
  version?: string;
  data?: Record<string, any>;
};

export type ChampionIndexRow = {
  id: string; // Data Dragon champion "id" (e.g., "Aatrox")
  key?: string; // numeric key as string if present
  name: string;
  title?: string;
  partype?: string;
  tags?: string[];
  stats: {
    hp: number;
    hpperlevel: number;

    armor: number;
    armorperlevel: number;

    spellblock: number;
    spellblockperlevel: number;

    // AA fields
    attackdamage: number;
    attackdamageperlevel: number;

    attackspeed: number;
    attackspeedperlevel: number;
  };
};

export type ItemRow = {
  id: string;
  name: string;
  gold: number | null;
  purchasable: boolean;
  tags: string[];
  stats: Record<string, number>;
  description: string;
};

async function getLatestDdragonVersion(): Promise<string> {
  let fallback = "unknown";

  try {
    const local = await readPublicJson<{ version?: string }>("data/lol/version.json");
    fallback = local.version ?? fallback;
  } catch {
    // ignore
  }

  try {
    const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", {
      next: { revalidate: 21600 },
    });
    if (!res.ok) throw new Error(`versions.json failed: ${res.status}`);
    const versions = (await res.json()) as string[];
    return versions?.[0] ?? fallback;
  } catch {
    return fallback;
  }
}

async function loadLolIndex(version: string): Promise<{
  patch: string;
  champions: ChampionIndexRow[];
}> {
  // EXACTLY like your LoL calc: disk public json
  const json = await readPublicJson<LolChampionFile>("data/lol/champions_full.json");
  const patch = version;

  const champions: ChampionIndexRow[] = (json.champions ?? [])
    .map((c: any) => ({
      id: String(c.id),
      key: c.key != null ? String(c.key) : undefined,
      name: String(c.name),
      title: c.title,
      tags: c.tags ?? [],
      partype: c.partype ?? "",
      stats: {
        hp: Number(c.stats?.hp ?? 0),
        hpperlevel: Number(c.stats?.hpperlevel ?? 0),

        armor: Number(c.stats?.armor ?? 0),
        armorperlevel: Number(c.stats?.armorperlevel ?? 0),

        spellblock: Number(c.stats?.spellblock ?? 0),
        spellblockperlevel: Number(c.stats?.spellblockperlevel ?? 0),

        attackdamage: Number(c.stats?.attackdamage ?? 0),
        attackdamageperlevel: Number(c.stats?.attackdamageperlevel ?? 0),

        attackspeed: Number(c.stats?.attackspeed ?? 0),
        attackspeedperlevel: Number(c.stats?.attackspeedperlevel ?? 0),
      },
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { patch, champions };
}

async function loadLolItems(version: string): Promise<{ patch: string; items: ItemRow[] }> {
  // EXACTLY like your LoL calc: disk public json
  const json = await readPublicJson<LolItemsFile>("data/lol/items.json");
  const patch = version;

  const SR_MAP_ID = "11";

  const rows = Object.entries(json.data ?? {}).map(([id, it]: any) => ({
    id: String(id),
    name: String(it?.name ?? id),
    gold: typeof it?.gold?.total === "number" ? it.gold.total : null,
    purchasable: it?.gold?.purchasable ?? true,
    tags: Array.isArray(it?.tags) ? it.tags : [],
    stats: (it?.stats ?? {}) as Record<string, number>,
    description: String(it?.description ?? ""),
    _maps: it?.maps,
    _inStore: it?.inStore,
  }));

  const srOnly = rows.filter((x) => {
    const allowedByMap = x._maps?.[SR_MAP_ID] !== false;
    const allowedInStore = x._inStore !== false;
    return allowedByMap && allowedInStore;
  });

  const purch = srOnly.filter((x) => x.purchasable);

  // de-dupe by name; keep higher gold version (same as your page)
  const byName = new Map<string, (typeof purch)[number]>();
  for (const it of purch) {
    const k = it.name.trim().toLowerCase();
    const prev = byName.get(k);
    if (!prev) {
      byName.set(k, it);
      continue;
    }
    const prevGold = prev.gold ?? -1;
    const nextGold = it.gold ?? -1;
    if (nextGold > prevGold) byName.set(k, it);
  }

  const items: ItemRow[] = Array.from(byName.values())
    .map(({ _maps, _inStore, ...rest }) => rest as ItemRow)
    .sort((a, b) => a.name.localeCompare(b.name));

  return { patch, items };
}

function LoadingShell() {
  return (
    <main className="min-h-screen bg-transparent text-white px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="h-4 w-44 rounded bg-white/10" />
        <div className="mt-8 h-10 w-[min(560px,100%)] rounded bg-white/10" />
        <div className="mt-4 h-4 w-[min(720px,100%)] rounded bg-white/10" />
        <div className="mt-10 h-[520px] w-full rounded-2xl bg-white/5" />
      </div>
    </main>
  );
}

const topButtonClass =
  "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

export default async function LolItemComparePage() {
  const version = await getLatestDdragonVersion();

  const [{ patch, champions }, { items }] = await Promise.all([
    loadLolIndex(version),
    loadLolItems(version),
  ]);

  return (
    <main className="min-h-screen bg-transparent text-white px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90">
            <img
              src="/gs-logo-v2.png"
              alt="GamerStation"
              className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_30px_rgba(0,255,255,0.35)]"
            />
            <span className="text-lg font-black tracking-tight">
              GamerStation<span className="align-super text-[0.6em]">™</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/calculators/lol/hub" className={topButtonClass}>
              LoL Hub
            </Link>
            
          </div>
        </header>

        <h1 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight">LoL Item Compare</h1>

        <p className="mt-2 text-sm text-neutral-400 italic">
          Not affiliated with, endorsed by, or sponsored by Riot Games.
        </p>

        <p className="mt-3 text-neutral-300 max-w-3xl">
          Pick a champion (imports base stats by level), then compare two items with clean stat deltas.
          Summoner&apos;s Rift items only.
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-2 py-2">
          <Link href="/tools/lol/meta" className={topButtonClass}>
            Meta
          </Link>
          <Link href="/tools/lol/champion-tiers" className={topButtonClass}>
            Champion Tiers
          </Link>
          <Link href="/calculators/lol/champions" className={topButtonClass}>
            Index
          </Link>
        </div>

        <Suspense fallback={<LoadingShell />}>
          <ItemCompareClient champions={champions} items={items} patch={patch} />
        </Suspense>
      </div>
    </main>
  );
}
