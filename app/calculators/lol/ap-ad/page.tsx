// app/calculators/lol/ap-ad/page.tsx
import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import ApAdClient, { type ChampionRow } from "./client";

export type ItemRow = Record<string, any>;
export type SpellsOverrides = Record<string, any>;

async function readJson<T>(absPath: string): Promise<T> {
  const raw = await fs.readFile(absPath, "utf-8");
  return JSON.parse(raw) as T;
}

/**
 * Tries several candidate locations so you don't have to perfectly match my guess.
 * Put your file in ONE of these places (or add your path to the list).
 */
async function readFirstJson<T>(candidates: string[]): Promise<T | null> {
  for (const rel of candidates) {
    const abs = path.join(process.cwd(), rel);
    try {
      return await readJson<T>(abs);
    } catch {
      // keep trying
    }
  }
  return null;
}

function normalizeChampionRows(data: any): ChampionRow[] {
  if (Array.isArray(data)) return data as ChampionRow[];

  if (data?.data && typeof data.data === "object") {
    return Object.values(data.data) as ChampionRow[];
  }

  if (Array.isArray(data?.champions)) return data.champions as ChampionRow[];

  return [];
}

function normalizeItemRows(data: any): ItemRow[] {
  if (Array.isArray(data)) return data as ItemRow[];

  if (data?.data && typeof data.data === "object") {
    return Object.values(data.data) as ItemRow[];
  }

  if (Array.isArray(data?.items)) return data.items as ItemRow[];

  return [];
}

async function loadPatch(): Promise<string> {
  const v =
    (await readFirstJson<any>([
      "public/data/lol/versions.json",
      "data/lol/versions.json",
      "public/data/lol/version.json",
      "data/lol/version.json",
    ])) ?? null;

  if (Array.isArray(v) && v[0]) return String(v[0]);
  if (typeof v === "string") return v;
  if (v?.patch) return String(v.patch);
  if (v?.version) return String(v.version);

  return "latest";
}

export default async function Page() {
  const patch = await loadPatch();

  const championsRaw =
    (await readFirstJson<any>([
      "public/data/lol/champions_index.json",
      "public/data/lol/champions.json",
      "public/data/lol/champions_full.json",
      "data/lol/champions_index.json",
      "data/lol/champions.json",
      "data/lol/champions_full.json",
      "public/data/lol/ddragon/championFull.json",
      "public/data/lol/ddragon/champion.json",
    ])) ?? null;

  const champions = normalizeChampionRows(championsRaw);

  const itemsRaw =
    (await readFirstJson<any>([
      "public/data/lol/items.json",
      "public/data/lol/items_index.json",
      "public/data/lol/items_full.json",
      "public/data/lol/item.json",
      "data/lol/items.json",
      "data/lol/items_index.json",
      "data/lol/items_full.json",
      "public/data/lol/ddragon/item.json",
      "public/data/lol/ddragon/items.json",
    ])) ?? null;

  const items = normalizeItemRows(itemsRaw);

  // ✅ Load spell overrides (numeric truth for spell damage)
  const overrides =
    (await readFirstJson<SpellsOverrides>([
      "public/data/lol/spells_overrides.json",
      "data/lol/spells_overrides.json",
      "public/data/lol/overrides/spells_overrides.json",
      "data/lol/overrides/spells_overrides.json",
    ])) ?? {};

  return (
    <main className="relative min-h-screen text-white">
      {/* Hub-style black background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_30%_20%,rgba(255,255,255,0.06),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_70%_10%,rgba(255,255,255,0.04),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_50%_60%,transparent_40%,rgba(0,0,0,0.8))]" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <Link href="/calculators/lol/hub" className="text-sm text-neutral-300 hover:text-white">
          ← Back to Hub
        </Link>

        <h1 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight">
          League of Legends AP / AD Stat Impact
        </h1>

        <p className="mt-2 text-sm text-neutral-400 italic">
          Not affiliated with, endorsed by, or sponsored by Riot Games.
        </p>

        <p className="mt-3 text-neutral-300 max-w-3xl">
          See exactly how much{" "}
          <span className="text-white font-semibold">+10 Ability Power</span> or{" "}
          <span className="text-white font-semibold">+10 Attack Damage</span> changes your{" "}
          <span className="text-white font-semibold">real damage after Armor &amp; Magic Resist</span>.
          Perfect for item decisions, build optimization, and breakpoint checks.
        </p>

        <div className="mt-10">
          <ApAdClient champions={champions} patch={patch} items={items} overrides={overrides} />
        </div>
      </div>
    </main>
  );
}
