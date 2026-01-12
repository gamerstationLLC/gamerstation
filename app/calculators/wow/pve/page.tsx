import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "WoW PvE Calculators – Stat Impact, Mythic+ Scaling & Mistake Analysis | GamerStation",
  description:
    "World of Warcraft PvE calculators for raid and Mythic+. Analyze stat impact, Mythic+ scaling, and DPS loss from downtime or mistakes using fast, non-simulation tools.",
};

export default function WoWPvEHubPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Link
            href="/calculators/wow"
            className="text-sm text-neutral-300 hover:text-white"
          >
            ← Back to WoW
          </Link>
        </header>

        <h1 className="mt-8 text-4xl font-bold">WoW PvE</h1>
        <p className="mt-3 text-neutral-300">
          Pick a PvE tool to get started.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {/* Mythic+ Scaling */}
          <Link
            href="/calculators/wow/pve/mythic-plus"
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 hover:border-neutral-600 transition"
          >
            <div className="text-sm font-semibold">Mythic+ Scaling</div>
            <div className="mt-2 text-sm text-neutral-400">
              Enemy health & damage multipliers by key level.
            </div>
          </Link>

          {/* Uptime / Mistake Impact */}
          <Link
            href="/calculators/wow/pve/uptime"
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 hover:border-neutral-600 transition"
          >
            <div className="text-sm font-semibold">
              Uptime / Mistake Impact
            </div>
            <div className="mt-2 text-sm text-neutral-400">
              Estimate DPS loss from downtime and missed cooldowns.
            </div>
          </Link>

          {/* Stat Impact */}
          <Link
            href="/calculators/wow/pve/stat-impact"
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 hover:border-neutral-600 transition"
          >
            <div className="text-sm font-semibold">Stat Impact</div>
            <div className="mt-2 text-sm text-neutral-400">
              Rough stat value estimates by content type (ST vs AoE).
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
