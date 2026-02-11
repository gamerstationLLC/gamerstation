import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blox Fruits Calculators | XP & Combat | GamerStation",
  description:
    "Blox Fruits calculators for Roblox. XP & leveling tools plus combat/build calculators. Clean, fast, and free.",
  alternates: {
    canonical: "/calculators/roblox/bloxfruits",
  },
  openGraph: {
    title: "Blox Fruits Calculators | GamerStation",
    description:
      "Blox Fruits calculators for Roblox. XP/leveling and combat/build tools.",
    url: "/calculators/roblox/bloxfruits",
    type: "website",
  },
};

export default function BloxFruitsHubPage() {
  return (
    <main className="min-h-screen bg-transparent text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Back link */}
        <header className="-ml-2">
          <Link
            href="/calculators/roblox"
            className="text-sm text-neutral-300 hover:text-white"
          >
            â† Back to Roblox
          </Link>
        </header>

        {/* Hero */}
        <h1 className="mt-8 text-4xl font-bold">Blox Fruits</h1>
        <p className="mt-3 max-w-2xl text-neutral-300">
          Choose a calculator below. Start with XP and leveling, then move on to
          combat and build tools.
        </p>

        {/* Cards */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {/* XP / Leveling */}
          <Link
            href="/calculators/roblox/bloxfruits/xp"
            className="group rounded-2xl border border-neutral-800 bg-neutral-950 p-6 transition hover:border-neutral-600"
          >
            <div className="text-sm font-semibold">
              XP / Leveling Calculator
            </div>
            <div className="mt-2 text-sm text-neutral-400">
              Estimate time to reach a target level.
            </div>
            
          </Link>

          {/* Combat / Build */}
          <Link
            href="/calculators/roblox/bloxfruits/combat"
            className="group rounded-2xl border border-neutral-800 bg-neutral-950 p-6 transition hover:border-neutral-600"
          >
            <div className="text-sm font-semibold">
              Combat / Build Calculator
            </div>
            <div className="mt-2 text-sm text-neutral-400">
              Compare fruits, swords, guns, and accessories.
            </div>
            
          </Link>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-xs text-neutral-500">
          Built by GamerStation. Core calculator features are never paywalled.
        </footer>
      </div>
    </main>
  );
}
