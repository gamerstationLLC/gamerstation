// app/tools/lol/champion-tiers/page.tsx
import Link from "next/link";
import { Suspense } from "react";
import LolChampionTiersClient, { type ChampionStatsRow } from "./client";
import { readPublicJson } from "@/lib/blob"; // ✅ switched to Blob-first helper

export const metadata = {
  title: "LoL Champion Tiers (S–D) | GamerStation",
  description:
    "League of Legends champion tier list (S–D) based on pick rate, win rate, and ban rate (when applicable). Updated frequently.",
};

export const dynamic = "force-static";
export const revalidate = 600;

// -----------------------------
// Helpers (Blob-first now)
// -----------------------------
async function readJsonSafe<T>(pathname: string): Promise<T | null> {
  try {
    return await readPublicJson<T>(pathname);
  } catch {
    return null;
  }
}

async function guessPatch(): Promise<string> {
  const v1 = await readJsonSafe<any>("data/lol/version.json");
  const v2 = await readJsonSafe<any>("data/lol/patch.json");

  const p = String(v1?.version ?? v1?.patch ?? v2?.version ?? v2?.patch ?? "").trim();

  return p || "—";
}

async function loadChampionTierRows(): Promise<ChampionStatsRow[]> {
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

function SeoBlock({ patch }: { patch: string }) {
  return (
    <section className="mt-8 border-t border-white/10 pt-6">
      {/* Collapsed by default, still rendered as HTML */}
      <details className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6" open={false}>
        <summary className="cursor-pointer select-none list-none">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">About this LoL Tier List</h2>
              <p className="mt-1 text-xs text-white/65">
                S–D tiers for the current patch, with win rate / pick rate / ban rate signals. (Tap
                to expand)
              </p>
            </div>
            <span className="text-white/65" aria-hidden>
              ▸
            </span>
          </div>
        </summary>

        <div className="mt-4 space-y-5 text-sm text-white/80">
          <p>
            This page is a <strong>League of Legends tier list</strong> for the{" "}
            <strong>current patch</strong> (Patch <strong>{patch}</strong>). It groups champions
            into <strong>S, A, B, C, and D tiers</strong> using a blended score that emphasizes{" "}
            <strong>win rate</strong>, <strong>pick rate</strong>, and <strong>ban rate</strong>{" "}
            (when available). Use it to quickly spot <strong>meta champions</strong> that are
            performing well right now.
          </p>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">Common searches this matches</h3>
            <ul className="list-disc pl-5 text-sm text-white/80">
              <li>LoL tier list</li>
              <li>League of Legends tier list</li>
              <li>LoL tier list patch {patch}</li>
              <li>best champions right now</li>
              <li>meta champions</li>
              <li>best champs for ranked</li>
              <li>best champions by role (top/jungle/mid/adc/support)</li>
              <li>LoL ranked tier list</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">How to use it</h3>
            <ul className="list-disc pl-5 text-sm text-white/80">
              <li>
                Start with <strong>S tier</strong> to find high-impact picks.
              </li>
              <li>
                Filter/sort (in the client) to compare champions by the underlying stats.
              </li>
              <li>
                Pair it with{" "}
                <Link href="/calculators/lol/meta" className="text-white hover:underline">
                  LoL Meta Builds
                </Link>{" "}
                to get items/runes for those champions.
              </li>
              <li>
                Use the{" "}
                <Link href="/calculators/lol" className="text-white hover:underline">
                  LoL Damage Calculator
                </Link>{" "}
                to test burst/DPS with the items you see in meta builds.
              </li>
            </ul>
          </div>

          <p className="text-xs text-white/55">
            Note: tiers are a snapshot of performance signals, not a guarantee for every matchup or
            team comp.
          </p>
        </div>
      </details>
    </section>
  );
}

export default async function LolChampionTiersPage() {
  const [patch, initialRows] = await Promise.all([guessPatch(), loadChampionTierRows()]);

  const cacheLabel = formatCacheLabel(revalidate);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <GSBrand />

          <Link
            href="/tools"
            className="rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600 hover:text-white"
          >
            Tools
          </Link>
        </div>

        <div className="mt-3">
          <h1 className="text-xl font-black text-white">LoL Champion Tiers</h1>
        </div>

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
        <div>
        <SeoBlock patch={patch} />
        </div>
      </div>

      <Suspense
        fallback={
          <div className="rounded-2xl border border-neutral-800 bg-black/60 p-6 text-sm text-neutral-400">
            Loading tier list…
          </div>
        }
      >
        
        <LolChampionTiersClient initialRows={initialRows} patch={patch} hrefBase="/calculators/lol/champions" />
      </Suspense>

      <div className="mt-4 text-xs text-neutral-500">
        Tiers are computed from a blended score (pick volume + winrate + banrate when applicable).
        This is a meta snapshot, not a guarantee for every matchup.
      </div>

      {/* ✅ Collapsed SEO content at bottom */}
      
    </main>
  );
}
