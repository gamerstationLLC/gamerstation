// app/calculators/lol/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import fs from "node:fs/promises";
import path from "node:path";
import LolClient from "./LolClient";

export const metadata: Metadata = {
  title: "LoL Damage Calculator (Burst & DPS) | GamerStation",
  description:
    "Calculate burst damage, DPS, and time-to-kill in League of Legends using official Riot Data Dragon values. Simple and Advanced modes supported.",
};


type LolChampionFile = {
  version?: string;
  champions?: any[];
};

type LolItemsFile = {
  version?: string;
  data?: Record<string, any>;
};

export type ChampionIndexRow = {
  id: string;
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

    // ✅ ADD for AA / DPS math
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

async function loadLolIndex(): Promise<{
  patch: string;
  champions: ChampionIndexRow[];
}> {
  const filePath = path.join(process.cwd(), "data", "lol", "champions_full.json");
  const raw = await fs.readFile(filePath, "utf-8");
  const json = JSON.parse(raw) as LolChampionFile;

  const patch = json.version ?? "unknown";

  const champions: ChampionIndexRow[] = (json.champions ?? [])
    .map((c: any) => ({
      id: c.id,
      name: c.name,
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

async function loadLolItems(): Promise<{ patch: string; items: ItemRow[] }> {
  const filePath = path.join(process.cwd(), "data", "lol", "items.json");
  const raw = await fs.readFile(filePath, "utf-8");
  const json = JSON.parse(raw) as LolItemsFile;

  const patch = json.version ?? "unknown";
  const SR_MAP_ID = "11";

  // Build rows while keeping raw fields needed for filtering
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

  // ✅ SR-only + inStore
  const srOnly = rows.filter((x) => {
    const allowedByMap = x._maps?.[SR_MAP_ID] !== false; // missing maps => allowed
    const allowedInStore = x._inStore !== false;
    return allowedByMap && allowedInStore;
  });

  // ✅ purchasable only (your existing filter)
  const purch = srOnly.filter((x) => x.purchasable);

  // ✅ dedupe by normalized name (keeps the more expensive one if duplicates exist)
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


export default async function LolCalculatorPage() {
  const [{ patch, champions }, { items }] = await Promise.all([
    loadLolIndex(),
    loadLolItems(),
  ]);

  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/calculators"
          className="text-sm text-neutral-300 hover:text-white"
        >
          ← Back to Calculators
        </Link>

        <h1 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight">
          League of Legends Damage Calculator
        </h1>

        <p className="mt-2 text-sm text-neutral-400 italic">
          Not affiliated with, endorsed by, or sponsored by Riot Games.
        </p>

        <p className="mt-3 text-neutral-300 max-w-3xl">
          Choose a champion and see how much damage you can deal in a combo or over a short time window. [Summoner's Rift Only]
        </p>


        <LolClient champions={champions} patch={patch} items={items} />
      </div>
    </main>

);
}
