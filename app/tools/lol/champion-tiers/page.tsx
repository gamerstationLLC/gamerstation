// app/tools/lol/champion-tiers/page.tsx
import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { Suspense } from "react";
import LolChampionTiersClient, { type ChampionStatsRow } from "./client";

export const metadata = {
  title: "LoL Champion Tiers (S–D) | GamerStation",
  description:
    "League of Legends champion tier list (S–D) based on pick rate, win rate, and ban rate (when applicable). Updated frequently.",
};

export const dynamic = "force-dynamic";

// -----------------------------
// Helpers (STATIC path reads)
// -----------------------------
async function readJsonIfExists<T>(absPath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(absPath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function abs(rel: string) {
  return path.join(process.cwd(), rel);
}

async function guessPatch(): Promise<string> {
  // Try a few known locations/structures, but with static paths
  const patch1 = await readJsonIfExists<any>(abs("public/data/lol/patch.json"));
  const patch2 = await readJsonIfExists<any>(abs("public/data/lol/version.json"));
  const patch3 = await readJsonIfExists<any>(abs("public/data/lol/meta_builds.json"));
  const patch4 = await readJsonIfExists<any>(abs("public/data/lol/meta_builds_ranked.json"));
  const patch5 = await readJsonIfExists<any>(abs("public/data/lol/meta_builds_casual.json"));

  const patchObj = patch1 ?? patch2 ?? patch3 ?? patch4 ?? patch5;

  const p = (patchObj?.patch ?? patchObj?.version ?? patchObj?.dataDragon ?? "")
    .toString()
    .trim();

  return p || "—";
}

async function loadChampionTierRows(): Promise<ChampionStatsRow[]> {
  // Prefer dedicated tiers JSON; keep a fallback to meta_builds.json in case you used that
  const rows1 = await readJsonIfExists<ChampionStatsRow[]>(
    abs("public/data/lol/champion_tiers.json")
  );
  const rows2 = await readJsonIfExists<ChampionStatsRow[]>(
    abs("public/data/lol/champion-tiers.json")
  );
  const rows3 = await readJsonIfExists<any>(abs("public/data/lol/meta_builds.json"));

  const rows = rows1 ?? rows2 ?? rows3;

  if (!Array.isArray(rows)) return [];
  return rows as ChampionStatsRow[];
}

function GSBrand() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <img
        src="/gs-logo-v2.png"
        alt="GamerStation"
        className="h-10 w-10 rounded-xl bg-black p-1 shadow"
      />
      <span className="text-lg font-black text-white">
        GamerStation
        <span className="align-super text-[0.6em]">™</span>
      </span>
    </Link>
  );
}

export default async function LolChampionTiersPage() {
  const [patch, initialRows] = await Promise.all([
    guessPatch(),
    loadChampionTierRows(),
  ]);

  const cacheLabel = "~5 min";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* Header: Tools top-right, title below brand, meta below title */}
      <div className="mb-4">
        {/* Row 1 */}
        <div className="flex items-center justify-between gap-3">
          <GSBrand />

          <Link
            href="/tools"
            className="rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600 hover:text-white"
          >
            Tools
          </Link>
        </div>

        {/* Row 2: Title (below GamerStation) */}
        <div className="mt-3">
          <h1 className="text-xl font-black text-white">LoL Champion Tiers</h1>
        </div>

        {/* Row 3: Meta below title + patch/cache right */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/tools/lol/meta"
            className="rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600 hover:text-white"
          >
            Meta
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full border border-neutral-800 bg-black/40 px-3 py-1 text-xs text-neutral-400">
              Patch {patch}
            </span>
            <span className="rounded-full border border-neutral-800 bg-black/40 px-3 py-1 text-xs text-neutral-400">
              Cache {cacheLabel}
            </span>
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="rounded-2xl border border-neutral-800 bg-black/60 p-6 text-sm text-neutral-400">
            Loading tier list…
          </div>
        }
      >
        <LolChampionTiersClient
          initialRows={initialRows}
          patch={patch}
          cacheLabel={cacheLabel}
          hrefBase="/calculators/lol/champions"
        />
      </Suspense>

      <div className="mt-4 text-xs text-neutral-500">
        Tiers are computed from a blended score (pick volume + winrate + banrate
        when applicable). This is a meta snapshot, not a guarantee for every
        matchup.
      </div>
    </main>
  );
}
