// app/tools/lol/champion-tiers/page.tsx
import Link from "next/link";
import { Suspense } from "react";
import LolChampionTiersClient, { type ChampionStatsRow } from "./client";
import { readPublicJson } from "@/lib/server/readPublicJson";

export const metadata = {
  title: "LoL Champion Tiers (S–D) | GamerStation",
  description:
    "League of Legends champion tier list (S–D) based on pick rate, win rate, and ban rate (when applicable). Updated frequently.",
};

// ✅ ISR is perfect here (fetch JSON w/ revalidate)
export const dynamic = "force-static";
export const revalidate = 600;

// -----------------------------
// Helpers (Blob-friendly)
// -----------------------------
async function readJsonSafe<T>(pathname: string): Promise<T | null> {
  try {
    return await readPublicJson<T>(pathname);
  } catch {
    return null;
  }
}

async function guessPatch(): Promise<string> {
  // Prefer your canonical "version.json" (your pipeline writes this)
  const v1 = await readJsonSafe<any>("data/lol/version.json");
  const v2 = await readJsonSafe<any>("data/lol/patch.json");

  const p = String(v1?.version ?? v1?.patch ?? v2?.version ?? v2?.patch ?? "").trim();
  return p || "—";
}

async function loadChampionTierRows(): Promise<ChampionStatsRow[]> {
  // Champion tiers should come from the output file, not meta builds
  const rowsA = await readJsonSafe<ChampionStatsRow[]>("data/lol/champion_tiers.json");
  const rowsB = await readJsonSafe<ChampionStatsRow[]>("data/lol/champion-tiers.json");

  const rows = rowsA ?? rowsB;
  if (!Array.isArray(rows)) return [];
  return rows as ChampionStatsRow[];
}

function formatCacheLabel(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds >= 3600) {
    const hours = Math.round((seconds / 3600) * 10) / 10;
    return `~${hours}h`;
  }
  return `~${Math.max(1, Math.round(seconds / 60))} min`;
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
        GamerStation<span className="align-super text-[0.6em]">™</span>
      </span>
    </Link>
  );
}

export default async function LolChampionTiersPage() {
  const [patch, initialRows] = await Promise.all([guessPatch(), loadChampionTierRows()]);
  const cacheLabel = formatCacheLabel(revalidate);

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
            href="/calculators/lol/meta"
            className="rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600 hover:text-white"
          >
            Meta
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full border border-neutral-800 bg-black/40 px-3 py-1 text-xs text-neutral-400">
              Patch <span className="text-neutral-200">{patch}</span>
            </span>

            <span className="rounded-full border border-neutral-800 bg-black/40 px-3 py-1 text-xs text-neutral-400">
              Cache <span className="text-neutral-200">{cacheLabel}</span>
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
          hrefBase="/calculators/lol/champions"
        />
      </Suspense>

      <div className="mt-4 text-xs text-neutral-500">
        Tiers are computed from a blended score (pick volume + winrate + banrate when applicable). This is a meta
        snapshot, not a guarantee for every matchup.
      </div>
    </main>
  );
}
