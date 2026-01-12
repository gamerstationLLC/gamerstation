// app/calculators/wow/pve/stat-impact/page.tsx
import Link from "next/link";
import StatImpactClient from "./StatImpactClient";


export const metadata = {
  title: "WoW Stat Impact Calculator | GamerStation",
  description:
    "Directional stat priority calculator for World of Warcraft PvE.",
};

export default function StatImpactPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Link
            href="/calculators/wow/pve"
            className="text-sm text-neutral-300 hover:text-white"
          >
            ← Back to WoW PvE
          </Link>
        </header>

        <h1 className="mt-8 text-4xl font-bold">Stat Impact</h1>
        <p className="mt-3 text-neutral-300">
          Import a character, choose a spec + content type, and get directional
          stat priority (non-sim).
        </p>

        <div className="mt-10">
          <StatImpactClient />
        </div>
      </div>
    </main>
  );
}
