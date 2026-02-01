import Link from "next/link";

export default function WoWPage() {
  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10 sm:py-16">
        {/* ✅ Standard GS header: brand left, ONLY Calculators top-right */}
        <header className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90">
            <img
              src="/gs-logo-v2.png"
              alt="GamerStation"
              className="
                h-10 w-10 rounded-xl bg-black p-1
                shadow-[0_0_30px_rgba(0,255,255,0.35)]
              "
            />
            <span className="text-lg font-black tracking-tight">
              GamerStation<span className="align-super text-[0.6em]">™</span>
            </span>
          </Link>

          <div className="ml-auto">
            <Link href="/calculators" className={navBtn}>
              Calculators
            </Link>
          </div>
        </header>

        {/* Title + intro */}
        <div className="mt-8 sm:mt-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            World of Warcraft
          </h1>
          <p className="mt-2 text-sm sm:text-base text-neutral-300">
            Choose a category to get started.
          </p>
        </div>

        {/* Cards */}
        <div className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* PvE */}
          <Link
            href="/calculators/wow/pve"
            className="
              rounded-2xl border border-neutral-800
              p-5 sm:p-6
              transition
              hover:border-neutral-600
              active:scale-[0.99]
              focus:outline-none focus:ring-2 focus:ring-cyan-400/30
            "
          >
            <div className="text-base font-semibold">PvE</div>
            <div className="mt-2 text-sm text-neutral-400">
              Mythic+ scaling, dungeon math, PvE tools.
            </div>
          </Link>

          {/* PvP (Coming Soon) */}
          <div
            className="
              rounded-2xl border border-neutral-800 bg-neutral-950
              p-5 sm:p-6
              opacity-60 cursor-not-allowed select-none
            "
            aria-disabled="true"
          >
            <div className="text-base font-semibold">
              PvP{" "}
              <span className="ml-1 text-xs text-neutral-400">(coming soon)</span>
            </div>
            <div className="mt-2 text-sm text-neutral-500">
              Arena & RBG calculators.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
