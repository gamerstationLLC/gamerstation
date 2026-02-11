import type { Metadata } from "next";
import Link from "next/link";
import ArsenalClient from "./client";

export const metadata: Metadata = {
  title: "Arsenal Weapon Damage Calculator | GamerStation",
  description:
    "Arsenal weapon damage calculator. Compare body damage, headshot multipliers, shots to kill, and damage per magazine using real weapon stats.",
  alternates: {
    canonical: "/calculators/roblox/arsenal",
  },
  openGraph: {
    title: "Arsenal Weapon Damage Calculator | GamerStation",
    description:
      "Compare Arsenal weapons by damage, headshot multipliers, shots to kill, and damage per magazine using real weapon stats.",
    url: "/calculators/roblox/arsenal",
    type: "website",
  },
};

export default function ArsenalPage() {
  return (
    <main className="min-h-screen bg-transparent text-white px-6 py-16">
      <div className="mx-auto max-w-6xl">
        {/* Back */}
        <header className="-ml-2">
          <Link
            href="/calculators/roblox"
            className="text-sm text-neutral-300 hover:text-white"
          >
            â† Back to Roblox
          </Link>
        </header>

        {/* Title */}
        <h1 className="mt-8 text-4xl font-bold">
          Arsenal Weapon Damage Calculator
        </h1>

        <p className="mt-3 max-w-3xl text-neutral-300">
          Pick any Arsenal weapon and analyze its damage profile, headshot
          multiplier, shots to kill, and damage per magazine using real,
          community-sourced weapon stats. Built for speed and clarity.
        </p>

        <div className="mt-10">
          <ArsenalClient />
        </div>

        <div className="mt-12 text-xs text-neutral-500">
          Weapon data sourced from the Arsenal Wiki. Core features are always
          free on GamerStation.
        </div>
      </div>
    </main>
  );
}
