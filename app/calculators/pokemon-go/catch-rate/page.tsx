// app/calculators/pokemon-go/catch-rate/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import CatchRateClient from "./client";

export const metadata: Metadata = {
  title: "Pokémon GO Catch Rate Calculator | GamerStation",
  description:
    "Calculate Pokémon GO catch chance per throw and across multiple balls using BCR + CPM with ball, berry, throw, curve, and medal bonuses.",
};

export const dynamic = "force-static";
export const revalidate = 600;

const navBtn =
  "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

export default function PokemonGoCatchRatePage() {
  return (
    <main className="min-h-screen bg-transparent px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        {/* ✅ Standard GS header (canonical) */}
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/gs-logo-v2.png"
              alt="GamerStation"
              className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_25px_rgba(0,255,255,0.20)]"
            />
            <span className="text-lg font-black tracking-tight">
              GamerStation
              <span className="align-super text-[0.6em]">™</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/calculators" className={navBtn}>
              Calculators
            </Link>
          </div>
        </header>

        {/* Title / subtitle */}
        <div className="mt-10">
          <div className="mb-2 text-4xl font-black tracking-tight">
            Pokémon GO Catch Rate Calculator
          </div>
          <div className="text-sm text-neutral-400">
            Pick a Pokémon, set its level (CPM), then tune ball / berry / throw / curve / medals to
            see catch odds per throw and across multiple balls.
          </div>
        </div>

        {/* Main tool */}
        <div className="mt-10">
          <CatchRateClient />
        </div>

        {/* Footer disclaimer */}
        <div className="mt-10 text-xs text-neutral-600">
          Disclaimer: Catch behavior can vary by in-game context. This tool uses a standard Pokémon GO
          catch model based on BCR + CPM and your selected multipliers.
        </div>
      </div>
    </main>
  );
}
