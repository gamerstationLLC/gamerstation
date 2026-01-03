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
          <Link
  href="/calculators/ttk/fortnite"
  className="group rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-white/20"
>
  <div className="flex items-center justify-between">
    <div className="text-sm font-semibold">Fortnite TTK Calculator</div>
    <div className="text-xs text-neutral-400 group-hover:text-neutral-200">
      
    </div>
  </div>
  <div className="mt-2 text-xs text-neutral-400">
    Per-rarity weapon damage • live fire rates
  </div>
</Link>
<Link
  href="/calculators/dps/osrs"
  className="group rounded-2xl border border-neutral-800 bg-neutral-950 p-6 hover:border-neutral-600 transition"
>
  <div className="mt-2 text-sm font-semibold">OSRS DPS Calculator</div>
  <p className="mt-2 text-sm text-neutral-300">
    Baseline DPS + hit chance + time-to-kill.
  </p>
  <div className="mt-4 text-sm text-neutral-400 group-hover:text-white">
    
  </div>
</Link>
        </div>
      </div>
    </main>
  );
}
