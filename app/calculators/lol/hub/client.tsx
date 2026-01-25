// app/calculators/lol/hub/client.tsx
"use client";

import Link from "next/link";

export default function HubClient() {
  const burstHref = "/calculators/lol";
  const statImpactHref = "/calculators/lol/ap-ad";
  const champsHref = "/calculators/lol/champions";
  const metaHref = "/calculators/lol/meta";

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Link
            href="/calculators"
            className="text-sm text-neutral-300 hover:text-white"
          >
            ← Back to Calculators
          </Link>

          <Link href="/" className="text-sm text-neutral-300 hover:text-white">
            Home
          </Link>
        </header>

        <h1 className="mt-8 text-4xl font-bold">League of Legends</h1>
        <p className="mt-3 text-neutral-300">Pick a LoL tool to get started.</p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {/* LoL Damage */}
          <Link
            href={burstHref}
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 transition hover:border-neutral-600"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">
                  LoL Damage Calculator
                </div>
                <div className="mt-2 text-sm text-neutral-400">
                  Burst + combo damage with Armor/MR mitigation.
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-neutral-800 bg-black px-3 py-1 text-xs text-neutral-300">
                Main
              </span>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-neutral-300">
              <li className="flex gap-2">
                <span className="mt-[7px] inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
                <span>Post-mitigation damage with Armor/MR</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[7px] inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
                <span>Fast kill checks (no full sim)</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[7px] inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
                <span>Uses your spells + overrides pipeline</span>
              </li>
            </ul>
          </Link>

          {/* AP/AD Stat Impact */}
          <Link
            href={statImpactHref}
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 transition hover:border-neutral-600"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">LoL AP/AD Stat Impact</div>
                <div className="mt-2 text-sm text-neutral-400">
                  See what +10 AP or +10 AD actually changes.
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-neutral-800 bg-black px-3 py-1 text-xs text-neutral-300">
                AP/AD
              </span>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-neutral-300">
              <li className="flex gap-2">
                <span className="mt-[7px] inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
                <span>Damage per +10 AP / +10 AD</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[7px] inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
                <span>Breakpoints vs target HP + resists</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[7px] inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
                <span>Perfect for item decision-making</span>
              </li>
            </ul>
          </Link>

          {/* Champion Index */}
          <Link
            href={champsHref}
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 transition hover:border-neutral-600"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Champions Index</div>
                <div className="mt-2 text-sm text-neutral-400">
                  Browse champions and stats.
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-neutral-800 bg-black px-3 py-1 text-xs text-neutral-300">
                Champs
              </span>
            </div>
          </Link>

          {/* Meta */}
          <Link
            href={metaHref}
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 transition hover:border-neutral-600"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Current Meta</div>
                <div className="mt-2 text-sm text-neutral-400">
                  Role-based boots + core items from real ranked matches.
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-neutral-800 bg-black px-3 py-1 text-xs text-neutral-300">
                Meta
              </span>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
