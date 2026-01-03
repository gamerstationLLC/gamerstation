// app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        {/* soft grid */}
        <div
          className="absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            backgroundPosition: "0 0",
          }}
        />

        {/* glows */}
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-1/3 -left-32 h-[420px] w-[420px] rounded-full bg-white/8 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-[520px] w-[520px] rounded-full bg-white/8 blur-3xl" />

        {/* vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black" />
      </div>

      {/* Content */}
      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3">
          {/* LOGO */}
          <Link href="/" className="flex items-center">
            <img
              src="/gs-logo-v2.png"
              alt="GamerStation"
              className="
                h-16 w-auto
                rounded-2xl
                bg-black
                p-3
                shadow-[0_0_40px_rgba(0,255,255,0.15)]
                sm:h-28 sm:p-5
              "
            />
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3 text-sm">
            <Link
              href="/calculators"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-neutral-200 backdrop-blur hover:bg-white/10 hover:text-white sm:text-sm"
            >
              Calculators
            </Link>

            {/* hide compare on mobile to reduce clutter */}
            <button
              disabled
              className="
                hidden sm:inline-flex
                rounded-xl
                border border-neutral-800
                bg-neutral-900
                px-4 py-2
                text-sm text-neutral-500
                cursor-not-allowed
              "
            >
              Compare (Coming soon)
            </button>
          </nav>
        </header>

        {/* Hero */}
        <section className="mt-10 grid gap-8 lg:mt-14 lg:grid-cols-2 lg:items-center lg:gap-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-neutral-300 backdrop-blur sm:text-xs">
              <span className="h-2 w-2 rounded-full bg-white/70" />
              Live calculators • fast results • clean UI
            </div>

            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:mt-6 sm:text-5xl">
              Multi-game calculators <span className="text-neutral-300">&</span>{" "}
              stats tools.
            </h1>

            <p className="mt-4 max-w-xl text-sm text-neutral-300 sm:text-base">
              One hub for high-signal tools:{" "}
              <span className="text-white">TTK</span>, sensitivity, drop odds,
              XP, and more — with a patchwatch feed for buffs/nerfs.
            </p>

            {/* Mobile: simple stacked list (less clutter) */}
            <div className="mt-6 space-y-2 sm:hidden">
              {[
                ["Speed", "Instant results"],
                ["Clarity", "Transparent formulas"],
                ["Focus", "No fluff"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"
                >
                  <div className="text-xs text-neutral-400">{k}</div>
                  <div className="mt-1 text-sm font-semibold">{v}</div>
                </div>
              ))}
            </div>

            {/* Desktop: your original 3 cards */}
            <div className="mt-8 hidden max-w-xl grid-cols-3 gap-3 sm:grid">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="text-xs text-neutral-400">Speed</div>
                <div className="mt-1 text-sm font-semibold">Instant results</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="text-xs text-neutral-400">Clarity</div>
                <div className="mt-1 text-sm font-semibold">
                  Transparent formulas
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="text-xs text-neutral-400">Focus</div>
                <div className="mt-1 text-sm font-semibold">No fluff</div>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="relative">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Featured</div>
                  <div className="mt-1 text-xs text-neutral-400">
                    Start here — most used tools.
                  </div>
                </div>

                {/* hide version on mobile to reduce noise */}
                <div className="hidden sm:inline-flex rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-neutral-300">
                  v0.1
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:mt-6 sm:gap-4">
                <Link
                  href="/calculators/ttk/cod"
                  className="group rounded-2xl border border-white/10 bg-black/40 p-4 hover:border-white/20 sm:p-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      COD TTK Calculator
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-neutral-400">
                    Weapons dropdown + Warzone plates.
                  </div>
                  <div className="mt-2 text-xs text-neutral-400">
                    Patchwatch feed for expected balance changes.
                  </div>
                </Link>

                {/* OSRS DPS Calculator card (entire bubble clickable) */}
                <Link
                  href="/calculators/dps/osrs"
                  className="group block rounded-2xl border border-white/10 bg-black/40 p-4 hover:border-white/20 transition sm:p-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      OSRS DPS Calculator
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-neutral-400">
                    Old School RuneScape DPS calculator with gear, prayers, and
                    combat styles.
                  </div>
                </Link>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 sm:mt-6">
                <div className="text-xs text-neutral-400">Coming next</div>
                <ul className="mt-2 space-y-1 text-sm text-neutral-200">
                  <li>• Range profiles (close/mid/long)</li>
                  <li>• Headshot/chest multipliers</li>
                  <li>• Compare multiple weapons</li>
                </ul>
              </div>
            </div>

            {/* neon-ish accent */}
            <div className="pointer-events-none absolute -inset-1 -z-10 rounded-[28px] bg-gradient-to-r from-white/10 via-white/5 to-transparent blur-xl" />
          </div>
        </section>
      </div>
    </main>
  );
}
google: "4PC_v8BAE_F7-BT66Rz3aodHsFygO6pjz7vrKWRHYpI"