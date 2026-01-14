// app/calculators/roblox/bloxfruits/xp/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import XPBloxFruitsClient from "./XPBloxFruitsClient";

export const metadata: Metadata = {
  title: "Blox Fruits XP / Leveling Calculator (Max Level 2550) | GamerStation",
  description:
    "Estimate Blox Fruits leveling time from your current level to a target level using your XP-per-quest rate. Includes manual XP mode for exact totals.",
  alternates: {
    canonical: "/calculators/roblox/bloxfruits/xp",
  },
  openGraph: {
    title: "Blox Fruits XP / Leveling Calculator | GamerStation",
    description:
      "Estimate Blox Fruits leveling time from your current level to a target level. Manual XP mode supported for exact totals.",
    url: "/calculators/roblox/bloxfruits/xp",
    type: "website",
  },
};

export default function BloxFruitsXPPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Back link */}
        <header className="-ml-2 mb-6">
          <Link
            href="/calculators/roblox/bloxfruits"
            className="text-sm text-neutral-300 hover:text-white"
          >
            ← Back to Blox Fruits Hub
          </Link>
        </header>

        {/* Hero */}
        <h1 className="text-3xl sm:text-4xl font-bold">
          Blox Fruits XP / Leveling Calculator
        </h1>
        <p className="mt-3 max-w-2xl text-neutral-300">
          Estimate how long it will take to reach your target level based on your
          XP per quest and pace. Use Manual XP mode if you already know the exact
          XP needed.
        </p>

        {/* Calculator */}
        <section id="calculator" className="mt-12">
          <XPBloxFruitsClient />
        </section>

        {/* SEO / explanatory copy */}
        <section className="mt-16 space-y-4 text-sm text-neutral-300">
          <h2 className="text-lg font-semibold text-white">
            How the XP calculator works
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Enter your current level and your target level (max 2550)</li>
            <li>Set your average XP per quest and quests per minute</li>
            <li>Toggle 2× XP to reflect codes/events</li>
            <li>
              Use Manual XP mode to paste an exact XP total for the most accurate
              estimate
            </li>
          </ul>

          <p className="text-neutral-400">
            Estimates depend on your route, quest choice, and consistency. Manual
            XP mode is recommended when you have an exact XP total.
          </p>
        </section>

        <footer className="mt-12 text-xs text-neutral-500">
          GamerStation calculators are free for core functionality.
        </footer>
      </div>
    </main>
  );
}
