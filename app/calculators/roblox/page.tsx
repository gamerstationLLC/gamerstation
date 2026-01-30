import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Roblox Calculators | GamerStation",
  description:
    "Roblox calculators for popular games like Blox Fruits, Arsenal, and more. XP, leveling, and combat tools—fast and free.",
  alternates: {
    canonical: "/calculators/roblox",
  },
  openGraph: {
    title: "Roblox Calculators | GamerStation",
    description:
      "Roblox calculators for popular games like Blox Fruits, Arsenal, and more.",
    url: "/calculators/roblox",
    type: "website",
  },
};

export default function RobloxCalculatorsPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Back link */}
        <header className="-ml-2">
          <a
  href="/calculators"
  className="
    ml-auto rounded-xl border border-neutral-700
    bg-black-950/70 px-4 py-2 text-sm text-neutral-200
    transition
    hover:border-neutral-500 hover:bg-neutral-900/70
    shadow-[0_0_20px_rgba(0,255,255,0.08)]
  "
>
  Calculators
</a>
        </header>

        <h1 className="mt-8 text-4xl font-bold">Roblox</h1>
        <p className="mt-3 text-neutral-300 max-w-2xl">
          Calculators and tools for popular Roblox games. Built for speed,
          clarity, and progression planning.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {/* Blox Fruits */}
          <Link
            href="/calculators/roblox/bloxfruits"
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 hover:border-neutral-600 transition"
          >
            <div className="text-sm font-semibold">Blox Fruits</div>
            <div className="mt-2 text-sm text-neutral-400">
              XP/leveling calculator & combat calculator.
            </div>
          </Link>

          {/* Arsenal */}
          <Link
            href="/calculators/roblox/arsenal"
            className="group rounded-2xl border border-neutral-800 bg-neutral-950 p-6 hover:border-neutral-600 transition"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Arsenal</div>
             
            </div>
            <div className="mt-2 text-sm text-neutral-400">
              Roblox Arsenal damage calculator. 
            </div>
          </Link>
        </div>

        <div className="mt-12 text-xs text-neutral-500">
          GamerStation Roblox tools are always free for core features.
        </div>
      </div>
    </main>
  );
}
