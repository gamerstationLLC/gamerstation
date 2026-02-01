// app/calculators/lol/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";

import LolClient from "./LolClient";
import { readPublicJson } from "@/lib/server/readPublicJson";

export const metadata: Metadata = {
  title: "LoL Damage Calculator (Burst & DPS) | GamerStation",
  description:
    "Calculate burst damage, DPS, and time-to-kill in League of Legends using official Riot Data Dragon values. Simple and Advanced modes supported.",
};

// ✅ Segment config (VALID)
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

    // ✅ AA / DPS fields
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

/**
 * ✅ Cached "latest patch" getter with safe fallback.
 * - Uses Data Dragon versions endpoint (cached by Next)
 * - Falls back to your local public version.json if Riot fetch fails
 */
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
      next: { revalidate: 21600 }, // 6 hours
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
  // ✅ Read from disk: /public/data/lol/champions_full.json
  const json = await readPublicJson<LolChampionFile>("data/lol/champions_full.json");

  const patch = version;

  const champions: ChampionIndexRow[] = (json.champions ?? [])
    .map((c: any) => ({
      id: String(c.id),
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

        // ✅ Make AA usable
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
  // ✅ Read from disk: /public/data/lol/items.json
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
    const allowedByMap = x._maps?.[SR_MAP_ID] !== false; // missing maps => allowed
    const allowedInStore = x._inStore !== false;
    return allowedByMap && allowedInStore;
  });

  const purch = srOnly.filter((x) => x.purchasable);

  const byName = new Map<string, (typeof purch)[number]>();
  for (const it of purch) {
    const key = it.name.trim().toLowerCase();
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, it);
      continue;
    }
    const prevGold = prev.gold ?? -1;
    const nextGold = it.gold ?? -1;
    if (nextGold > prevGold) byName.set(key, it);
  }

  const items: ItemRow[] = Array.from(byName.values())
    .map(({ _maps, _inStore, ...rest }) => rest as ItemRow)
    .sort((a, b) => a.name.localeCompare(b.name));

  return { patch, items };
}

function LoadingShell() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="h-4 w-40 rounded bg-white/10" />
        <div className="mt-8 h-10 w-[min(560px,100%)] rounded bg-white/10" />
        <div className="mt-4 h-4 w-[min(720px,100%)] rounded bg-white/10" />
        <div className="mt-10 h-[520px] w-full rounded-xl bg-white/5" />
      </div>
    </main>
  );
}

export default async function LolCalculatorPage() {
  const version = await getLatestDdragonVersion();

  const [{ patch, champions }, { items }] = await Promise.all([
    loadLolIndex(version),
    loadLolItems(version),
  ]);

  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="mx-auto max-w-6xl">
       <header className="flex items-center gap-3">
  {/* GS brand */}
  <Link href="/" className="flex items-center gap-2 hover:opacity-90">
    <img
      src="/gs-logo-v2.png"
      alt="GamerStation"
      className="
        h-10 w-10 rounded-xl bg-black p-1
        shadow-[0_0_30px_rgba(0,255,255,0.35)]
      "
    />
    <span className="text-lg font-black tracking-tight">
      GamerStation<span className="align-super text-[0.6em]">™</span>
    </span>
  </Link>

  {/* Top-right: ONLY Calculators */}
  <div className="ml-auto">
    <Link
      href="/calculators/lol/hub"
      className="rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]"
    >
      LoL Hub
    </Link>
  </div>
</header>

          
        <h1 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight">
          League of Legends Damage Calculator
        </h1>

        <p className="mt-2 text-sm text-neutral-400 italic">
          Not affiliated with, endorsed by, or sponsored by Riot Games.
        </p>

        <p className="mt-3 text-neutral-300 max-w-3xl">
          Choose a champion and see how much damage you can deal in a combo or over a short time
          window. [Summoner&apos;s Rift Only]
        </p>

        {/* ✅ Required by Next when LolClient uses useSearchParams() */}
        <Suspense fallback={<LoadingShell />}>
          <LolClient champions={champions} patch={patch} items={items} />
        </Suspense>
      </div>
    </main>
  );
}
