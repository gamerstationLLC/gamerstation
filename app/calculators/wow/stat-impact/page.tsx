// app/calculators/wow/stat-impact/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import StatImpactClient from "./StatImpactClient";

export const metadata: Metadata = {
  title: "WoW Stat Impact (Upgrade vs Sidegrade) | GamerStation",
  description:
    "Compare two World of Warcraft items using spec-based stat weights to estimate upgrade vs sidegrade impact.",
};

export const dynamic = "force-static";
export const revalidate = 600;

export default function WowStatImpactPage() {
  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  return (
    <main className="min-h-screen bg-transparent text-white px-6 py-16">
      <div className="mx-auto max-w-6xl">
        {/* ✅ Standard GS header */}
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/gs-logo-v2.png"
              alt="GamerStation"
              className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_25px_rgba(0,255,255,0.20)]"
            />
            <div className="text-lg font-black">
              GamerStation<span className="align-super text-[0.6em]">™</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/calculators/wow" className={navBtn}>
              WoW Hub
            </Link>
            <Link href="/calculators" className={navBtn}>
              Calculators
            </Link>
          </div>
        </header>

        <div className="mt-8">
          <div className="mb-2 text-3xl font-black">WoW Stat Impact</div>
          <div className="text-sm text-neutral-400">
            Compare two items using stat weights (upgrade vs sidegrade).
          </div>
        </div>

        <div className="mt-10">
          <StatImpactClient />
        </div>

        <div className="mt-10 text-xs text-neutral-600">
          Disclaimer: Approximation. Real WoW performance depends on talents, spec mechanics,
          procs, encounter effects, and more.
        </div>
      </div>
    </main>
  );
}
