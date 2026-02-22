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

type LolVersionJson = {
  patch?: string; // display patch (e.g. "26.4")
  ddragon?: string; // dd assets (e.g. "16.4.1")
  version?: string; // legacy alias for display patch
  updatedAt?: string;
  source?: string;
};

function getBlobBase(): string {
  return (
    process.env.NEXT_PUBLIC_BLOB_BASE_URL ||
    process.env.BLOB_BASE_URL ||
    process.env.NEXT_PUBLIC_BLOB_BASE ||
    ""
  );
}

/**
 * ✅ We need TWO versions:
 * - displayPatch: what you show in UI (e.g. "26.4")
 * - ddragon: Data Dragon asset version for CDN requests (e.g. "16.4.1")
 *
 * BOTH come from your Blob version.json (blob-only).
 * Riot versions.json is only a fallback if blob ddragon is missing.
 */
async function getLolVersions(): Promise<{ displayPatch: string; ddragon: string }> {
  let displayPatch = "unknown";
  let ddragon = "unknown";

  // 1) Blob-only version.json
  try {
    const base = getBlobBase();
    if (base) {
      const url = `${base.replace(/\/+$/, "")}/data/lol/version.json`;
      const res = await fetch(url, { next: { revalidate: 60 } }); // keep fresh
      if (res.ok) {
        const json = (await res.json()) as LolVersionJson;

        displayPatch =
          String(json.patch ?? json.version ?? displayPatch).trim() || displayPatch;

        // Prefer explicit ddragon from your pipeline
        ddragon = String(json.ddragon ?? ddragon).trim() || ddragon;
      }
    }
  } catch {
    // ignore
  }

  // 2) If blob didn't give us a valid ddragon, fallback to Riot versions.json
  if (!ddragon || ddragon === "unknown") {
    try {
      const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", {
        next: { revalidate: 21600 },
      });
      if (!res.ok) throw new Error(`versions.json failed: ${res.status}`);
      const versions = (await res.json()) as string[];
      ddragon = String(versions?.[0] ?? ddragon).trim() || ddragon;
    } catch {
      // If Riot fails, fallback to displayPatch (still better than "unknown")
      ddragon = displayPatch;
    }
  }

  return { displayPatch, ddragon };
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

function SeoBlock({ patch }: { patch: string }) {
  return (
    <section className="mt-10 border-t border-white/10 pt-8">
      <details className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6" open={false}>
        <summary className="cursor-pointer select-none list-none">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                About this LoL Damage Calculator (Patch {patch})
              </h2>
              <p className="mt-1 text-xs text-neutral-400">
                Burst combos, DPS, and time-to-kill — with items and resist math. (Tap to expand)
              </p>
            </div>
            <span className="text-neutral-400" aria-hidden>
              ▸
            </span>
          </div>
        </summary>

        <div className="mt-4 space-y-5 text-sm text-neutral-300">
          <p>
            GamerStation’s <strong>League of Legends damage calculator</strong> helps you estimate{" "}
            <strong>combo damage</strong> and <strong>DPS</strong>{" "}
            on the current patch using Riot’s Data Dragon values. It’s built for fast “real fight math”:
            items, base stats, and enemy resistances.
          </p>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">What you can calculate</h3>
            <ul className="list-disc pl-5 text-sm text-neutral-300">
              <li>
                <strong>LoL burst damage</strong> for a spell combo (e.g., Q/W/E/R + autos)
              </li>
              <li>
                <strong>DPS</strong> over a short window (autos + abilities)
              </li>
              <li>
                Damage comparisons across <strong>items</strong> and <strong>stats</strong>
              </li>
              <li>
                Practical checks like “does this combo kill?” and “what item spike is bigger?”
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">Helpful pages</h3>
            <ul className="list-disc pl-5">
              <li>
                <Link href="/calculators/lol/champions" className="text-neutral-100 hover:underline">
                  Champion stats by level index
                </Link>{" "}
                (base stats, per-level scaling)
              </li>
              <li>
                <Link href="/tools/lol/meta" className="text-neutral-100 hover:underline">
                  LoL meta builds
                </Link>{" "}
                (popular builds by champ/role)
              </li>
              <li>
                <Link href="/tools/lol/champion-tiers" className="text-neutral-100 hover:underline">
                  Champion tiers
                </Link>{" "}
                (quick power snapshot)
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">FAQ</h3>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold text-neutral-100">
                Is this a “LoL combo calculator”?
              </div>
              <p className="mt-1 text-sm text-neutral-300">
                Yes — you can model ability casts plus optional auto attacks to estimate burst, DPS,
                and kill thresholds.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold text-neutral-100">
                Does it work for armor and magic resist?
              </div>
              <p className="mt-1 text-sm text-neutral-300">
                Yes — the calculator is designed to apply resistance math so you can compare realistic
                outcomes instead of raw tooltip damage.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold text-neutral-100">
                Is this for Summoner’s Rift only?
              </div>
              <p className="mt-1 text-sm text-neutral-300">
                Currently yes (SR baseline) to keep results consistent. More modes can be added later.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold text-neutral-100">
                Is GamerStation affiliated with Riot?
              </div>
              <p className="mt-1 text-sm text-neutral-300">
                No — not affiliated with, endorsed by, or sponsored by Riot Games.
              </p>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}

function LoadingShell() {
  return (
    <main className="min-h-screen bg-transparent text-white px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="h-4 w-40 rounded bg-white/10" />
        <div className="mt-8 h-10 w-[min(560px,100%)] rounded bg-white/10" />
        <div className="mt-4 h-4 w-[min(720px,100%)] rounded bg-white/10" />
        <div className="mt-10 h-[520px] w-full rounded-xl bg-white/5" />
      </div>
    </main>
  );
}

const topButtonClass =
  "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

export default async function LolCalculatorPage() {
  const { displayPatch, ddragon } = await getLolVersions();

  const [{ champions }, { items }] = await Promise.all([
    loadLolIndex(displayPatch),
    loadLolItems(displayPatch),
  ]);

  return (
    <main className="min-h-screen bg-transparent text-white px-6 py-12">
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

          {/* Top-right */}
          <div className="ml-auto">
            <Link href="/calculators/lol/hub" className={topButtonClass}>
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
          <LolClient champions={champions} patch={displayPatch} ddragon={ddragon} items={items} />
        </Suspense>

        {/* ✅ SEO block now reflects blob-only displayPatch */}
        <SeoBlock patch={displayPatch} />
      </div>
    </main>
  );
}