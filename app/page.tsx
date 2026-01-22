import type { Metadata } from "next";
import Link from "next/link";

// ✅ Homepage-only metadata (canonical + google verification)
export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  verification: {
    google: [
      "4PC_v8BAE_F7-BT66Rz3aodHsFygO6pjz7vrKWRHYpI",
      "BbCfisC6OtfA0Xjo0YAizMxT_fv3QDqaaZQr4nudzRw",
    ],
  },
};

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
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

      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center min-w-0">
            <img
              src="/gs-logo-v2.png"
              alt="GamerStation"
              className="h-20 w-auto rounded-2xl bg-black p-1 shadow-[0_0_40px_rgba(0,255,255,0.15)] sm:h-25 sm:p-2"
            />
            <h1 className="ml-3 translate-x-[2px] text-2xl font-black tracking-tight leading-none sm:translate-x-[4px] sm:text-4xl">
              GamerStation<span className="align-super text-[0.65em]">™</span>
            </h1>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3 text-sm">
            <Link
              href="/calculators"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-neutral-200 hover:bg-white/10 sm:text-sm"
            >
              Calculators
            </Link>
            <button
              disabled
              className="hidden sm:inline-flex rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-500 cursor-not-allowed"
            >
              Compare (Coming soon)
            </button>
          </nav>
        </header>

        {/* Hero */}
        <section className="mt-10 grid gap-8 lg:mt-14 lg:grid-cols-2 lg:items-center lg:gap-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-neutral-300 sm:text-xs">
              <span className="h-2 w-2 rounded-full bg-white/70" />
              Live calculators • Fast results • Clean UI
            </div>

            <h2 className="mt-5 text-xl font-bold tracking-tight sm:text-3xl">
              Multi-game calculators <span className="text-neutral-300">&</span>{" "}
              stats tools.
            </h2>

            <p className="mt-4 max-w-xl text-sm text-neutral-300 sm:text-base">
              One hub for high-signal tools: <span className="text-white">TTK</span>, sensitivity,
              drop odds, XP, and more — with a patchwatch feed for buffs/nerfs.
            </p>

            {/* ✅ MOBILE: 3-across compact row */}
            <div className="mt-6 grid grid-cols-3 gap-2 sm:hidden">
              {[
                ["Speed", "Instant results"],
                ["Clarity", "Transparent formulas"],
                ["Focus", "No fluff"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-xl border border-white/10 bg-white/5 px-2 py-2"
                >
                  <div className="text-[10px] text-neutral-400 leading-none">{k}</div>
                  <div className="mt-1 text-[11px] font-semibold leading-snug">{v}</div>
                </div>
              ))}
            </div>

            {/* Desktop unchanged */}
            <div className="mt-8 hidden max-w-xl grid-cols-3 gap-3 sm:grid">
              {[
                ["Speed", "Instant results"],
                ["Clarity", "Transparent formulas"],
                ["Focus", "No fluff"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="text-xs text-neutral-400">{k}</div>
                  <div className="mt-1 text-sm font-semibold">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel unchanged */}
          <div className="relative">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Featured</div>
                  <div className="mt-1 text-xs text-neutral-400">
                    Start here — most used tools.
                  </div>
                </div>
                <div className="hidden sm:inline-flex rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-neutral-300">
                  v0.1
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:mt-6 sm:gap-4">
                <Link
                  href="/calculators/ttk/cod"
                  className="rounded-2xl border border-white/10 bg-black/40 p-4 hover:border-white/20 sm:p-5"
                >
                  <div className="text-sm font-semibold">COD TTK Calculator</div>
                  <div className="mt-2 text-xs text-neutral-400">
                    Weapons dropdown + Warzone plates.
                  </div>
                  <div className="mt-2 text-xs text-neutral-400">
                    Patchwatch feed for expected balance changes.
                  </div>
                </Link>

                <Link
  href="/calculators/lol/champions"
  className="rounded-2xl border border-white/10 bg-black/40 p-4 hover:border-white/20 sm:p-5"
>
  <div className="text-sm font-semibold">LoL Champion Index</div>
  <div className="mt-2 text-xs text-neutral-400">
    Search champions to view base stats, scaling, and ability numbers.
  </div>
  <div className="mt-2 text-xs text-neutral-400">
    Jump directly into the damage calculator with a champion selected.
  </div>
</Link>

              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 sm:mt-6">
                <div className="text-xs text-neutral-400">Coming next</div>
                <ul className="mt-2 space-y-1 text-sm text-neutral-200">
                  <li>• Minecraft damage calc</li>
                  <li>• Compare multiple weapons (COD and Fortnite)</li>
                  <li>• XP calculator for OSRS</li>
                </ul>
              </div>
            </div>

            <div className="pointer-events-none absolute -inset-1 -z-10 rounded-[28px] bg-gradient-to-r from-white/10 via-white/5 to-transparent blur-xl" />
          </div>
        </section>

        
        {/* ✅ Homepage-only footer (keeps compliance without polluting every page) */}
<footer className="mt-16 border-t border-neutral-800 pt-6 text-center text-xs text-neutral-500">
  <div className="space-y-3">
    <p>
      GamerStation is not affiliated with or endorsed by Activision, Epic Games,
      Riot Games, or any game publishers. All trademarks belong to their
      respective owners.
    </p>

    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
      <Link className="hover:text-white" href="/privacy">
        Privacy
      </Link>
      <Link className="hover:text-white" href="/terms">
        Terms
      </Link>
      <Link className="hover:text-white" href="/contact">
        Contact
      </Link>
      <Link className="hover:text-white" href="/disclaimer">
        Disclaimer
      </Link>
    </div>

    <p className="text-[11px] text-neutral-600">
      © {new Date().getFullYear()} GamerStation
    </p>
  </div>
</footer>

      </div>
    </main>
  );
}
