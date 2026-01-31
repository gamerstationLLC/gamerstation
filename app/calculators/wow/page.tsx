import Link from "next/link";

export default function WoWPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-10 sm:py-16">
        {/* Header row */}
        <header className="flex items-center justify-end">
          <Link
            href="/calculators"
            className="
              inline-flex items-center justify-center
              rounded-xl border border-neutral-800
              bg-black px-4 py-2 text-sm text-neutral-200
              transition
             hover:text-white
              hover:shadow-[0_0_25px_rgba(0,255,255,0.25)]
              focus:outline-none focus:ring-2 focus:ring-cyan-400/30
            "
          >
            Calculators
          </Link>
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
