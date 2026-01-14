import Link from "next/link";

export default function CalculatorsPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-sm text-neutral-300 hover:text-white">
            ← Back to Home
          </Link>
        </header>

        <h1 className="mt-8 text-4xl font-bold">Calculators</h1>
        <p className="mt-3 text-neutral-300">
          Pick a tool to get started.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {/* DPS (generic / legacy) */}
          <Link
            href="/calculators/dps"
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 hover:border-neutral-600 transition"
          >
            <div className="text-sm font-semibold">DPS Calculator</div>
            <div className="mt-2 text-sm text-neutral-400">
              Universal damage-per-second estimate.
            </div>
          </Link>

          {/* COD TTK */}
          <Link
            href="/games/cod"
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 hover:border-neutral-600 transition"
          >
            <div className="text-sm font-semibold">Call of Duty</div>
            <div className="mt-2 text-sm text-neutral-400">
              TTK calculator + weapon buffs / nerfs.
            </div>
          </Link>

          {/* Fortnite TTK */}
          <Link
            href="/calculators/ttk/fortnite"
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 hover:border-neutral-600 transition"
          >
            <div className="text-sm font-semibold">Fortnite TTK Calculator</div>
            <div className="mt-2 text-sm text-neutral-400">
              Per-rarity weapon damage • live fire rates
            </div>
          </Link>

          {/* OSRS DPS */}
          <Link
            href="/calculators/dps/osrs"
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 hover:border-neutral-600 transition"
          >
            <div className="text-sm font-semibold">OSRS DPS Calculator</div>
            <div className="mt-2 text-sm text-neutral-400">
              Baseline DPS + hit chance + time-to-kill.
            </div>
          </Link>

          {/* League of Legends */}
          <Link
            href="/calculators/lol"
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 hover:border-neutral-600 transition"
          >
            <div className="text-sm font-semibold">League of Legends</div>
            <div className="mt-2 text-sm text-neutral-400">
              Burst + DPS/time-window damage calculator.
            </div>
          </Link>

          {/* World of Warcraft */}
<Link
  href="/calculators/wow"
  className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 hover:border-neutral-600 transition"
>
  <div className="text-sm font-semibold">World of Warcraft</div>
  <div className="mt-2 text-sm text-neutral-400">
    PvE & PvP calculators for Mythic+, raids, and arenas.
  </div>
</Link>


{/* Roblox Calculators */}
<Link
  href="/calculators/roblox"
  className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 hover:border-neutral-600 transition"
>
  <div className="text-sm font-semibold">Roblox Calculators</div>
  <div className="mt-2 text-sm text-neutral-400">
    XP, leveling, and progression tools for top Roblox games.
  </div>
</Link>

        </div>
      </div>
    </main>
  );
}
