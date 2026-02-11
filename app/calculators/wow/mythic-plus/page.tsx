import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:
    "WoW PvE Calculators – Stat Impact, Mythic+ Scaling & Mistake Analysis | GamerStation",
  description:
    "World of Warcraft PvE calculators for raid and Mythic+. Analyze stat impact, Mythic+ scaling, and DPS loss from downtime or mistakes using fast, non-simulation tools.",
};

export default function WoWPvEHubPage() {
  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  return (
    <main className="min-h-screen bg-transparent text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* ✅ Standard GS header */}
        <header className="flex items-center gap-3">
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

          <div className="ml-auto">
            <Link href="/calculators" className={navBtn}>
              Calculators
            </Link>
          </div>
        </header>

        {/* Back link */}
        
        <h1 className="mt-8 text-4xl font-bold">WoW Hub</h1>
        <p className="mt-3 text-neutral-300">
          Pick a utility to get started.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          
<Link
            href="/calculators/wow/damage-calculator"
            className="rounded-2xl border border-neutral-800 p-6 hover:border-neutral-600 transition"
          >
            <div className="text-sm font-semibold">Damage Calculator</div>
            <div className="mt-2 text-sm text-neutral-400">
              Calculate damages for your WoW characters.
            </div>
          </Link>

          <Link
            href="/calculators/wow/upgrade-checker"
            className="rounded-2xl border border-neutral-800 p-6 hover:border-neutral-600 transition"
          >
            <div className="text-sm font-semibold">Item Upgrades</div>
            <div className="mt-2 text-sm text-neutral-400">
              Compare impact of items from WoW.
            </div>
          </Link>
          
          {/* Mythic+ Scaling */}
          <Link
            href="/calculators/wow/mythic-plus"
            className="rounded-2xl border border-neutral-800 p-6 hover:border-neutral-600 transition"
          >
            <div className="text-sm font-semibold">Mythic+ Scaling</div>
            <div className="mt-2 text-sm text-neutral-400">
              Enemy health & damage multipliers by key level.
            </div>
          </Link>

          {/* Uptime / Mistake Impact */}
          <Link
            href="/calculators/wow/uptime"
            className="rounded-2xl border border-neutral-800  p-6 hover:border-neutral-600 transition"
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
            href="/calculators/wow/stat-impact"
            className="rounded-2xl border border-neutral-800 p-6 hover:border-neutral-600 transition"
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
