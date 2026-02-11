import type { Metadata } from "next";
import Link from "next/link";
import BloxFruitsCombatClient from "./client";

export const metadata: Metadata = {
  title: "Blox Fruits Combat / Build Calculator | GamerStation",
  description:
    "Blox Fruits combat/build calculator for Roblox. Compare builds with fruits, swords, guns, and accessories. Fast and clean tools by GamerStation.",
  alternates: {
    canonical: "/calculators/roblox/bloxfruits/combat",
  },
  openGraph: {
    title: "Blox Fruits Combat / Build Calculator | GamerStation",
    description:
      "Compare Blox Fruits builds with fruits, swords, guns, and accessories. Combat calculator tools by GamerStation.",
    url: "/calculators/roblox/bloxfruits/combat",
    type: "website",
  },
};

export default function BloxFruitsCombatPage() {
  return (
    <main className="min-h-screen bg-transparent text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Back link */}
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
  href="/calculators/roblox/bloxfruits"
  className="
    ml-auto rounded-xl border border-neutral-800
    bg-black px-4 py-2 text-sm text-neutral-200
    transition
    hover:border-grey-400
   
    hover:text-white
    hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]
  "
>
  Blox Fruits Hub
</a>
</header>

        {/* Hero */}
        <h1 className="text-3xl sm:text-4xl font-bold">
          Blox Fruits Combat / Build Calculator
        </h1>
        <p className="mt-3 max-w-2xl text-neutral-300">
          Build comparison tools for fruits, swords, guns, and accessories.
        </p>

        {/* App */}
        <section className="mt-12">
          <BloxFruitsCombatClient />
        </section>

        {/* SEO copy */}
        <section className="mt-16 space-y-4 text-sm text-neutral-300">
          <h2 className="text-lg font-semibold text-white">
            What this combat calculator will include
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Build picker: fruit + sword/gun + accessory</li>
            <li>Damage / time-to-kill estimates with user-entered stats</li>
            <li>Optional toggles (PvE/PvP, buffs, multipliers)</li>
            
          </ul>

          <p className="text-neutral-400">
            Early versions will prioritize clarity over simulation. No clutter,
            no confusing â€œblack boxâ€ math.
          </p>
        </section>

        <footer className="mt-12 text-xs text-neutral-500">
          Built by GamerStation. Core calculator features are never paywalled.
        </footer>
      </div>
    </main>
  );
}
