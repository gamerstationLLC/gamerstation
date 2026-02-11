"use client";

import Link from "next/link";

export default function HubClient() {
  const burstHref = "/calculators/lol";
  const statImpactHref = "/calculators/lol/ap-ad";
  const champsHref = "/calculators/lol/champions";
  const metaHref = "/calculators/lol/meta";

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent text-white">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-1/3 -left-32 h-[420px] w-[420px] rounded-full bg-white/8 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-[520px] w-[520px] rounded-full bg-white/8 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black" />
      </div>

      <div className="relative px-6 py-16">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <header className="mb-8 flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90">
              <img
                src="/gs-logo-v2.png"
                alt="GamerStation"
                className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_30px_rgba(0,255,255,0.12)]"
              />
              <span className="text-lg font-black tracking-tight">
                GamerStation<span className="align-super text-[0.6em]">â„¢</span>
              </span>
            </Link>

            <a
  href="/calculators"
  className="
    ml-auto rounded-xl border border-neutral-800
    bg-black px-4 py-2 text-sm text-neutral-200
    transition
    hover:border-grey-400
   
    hover:text-white
    hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]
  "
>
  Calculators
</a>


          </header>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            League of Legends
          </h1>
          <p className="mt-3 text-neutral-300">
            Pick a LoL calculator to get started.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {/* LoL Damage */}
            <Link
              href={burstHref}
              className="rounded-2xl border border-neutral-800 bg-black/60 p-6 transition hover:border-neutral-600 hover:bg-black/75"
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
              className="rounded-2xl border border-neutral-800 bg-black/60 p-6 transition hover:border-neutral-600 hover:bg-black/75"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">
                    LoL AP/AD Stat Impact
                  </div>
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
            
          </div>
        </div>
      </div>
    </main>
  );
}

