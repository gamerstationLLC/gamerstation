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
        <header className="mb-8 flex items-center">
  {/* Left: Logo */}
  <Link href="/" className="flex items-center gap-2 hover:opacity-90">
    <img
      src="/gs-logo-v2.png"
      alt="GamerStation"
      className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_30px_rgba(0,255,255,0.12)]"
    />
    <span className="text-lg font-black tracking-tight">
      GamerStation<span className="align-super text-[0.6em]">TM</span>
    </span>
  </Link>

  {/* Right: Tools button */}
  <a
  href="/calculators/roblox"
  className="
    ml-auto rounded-xl border border-neutral-800
    bg-black px-4 py-2 text-sm text-neutral-200
    transition
    hover:border-grey-400
   
    hover:text-white
    hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]
  "
>
  Roblox Hub
</a>
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
