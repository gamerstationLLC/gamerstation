import Link from "next/link";

export default function CodHubPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
<header className="mb-10 flex items-center justify-between">
  <Link
    href="/calculators"
    className="text-sm text-neutral-300 hover:text-white"
  >
    ← Back to calculators
  </Link>

  <Link
    href="/"
    className="text-sm text-neutral-300 hover:text-white"
  >
    Home
  </Link>
</header>



        {/* Title */}
        <h1 className="mt-8 text-4xl font-bold">Call of Duty</h1>
        <p className="mt-3 max-w-2xl text-neutral-300">
          TTK tools + weapon buffs/nerfs, in one place.
        </p>

        {/* Cards */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {/* TTK Calculator */}
          <Link
            href="/calculators/ttk/cod"
            className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 hover:border-neutral-600"
          >
            <div className="text-sm font-semibold">TTK Calculator</div>
            <div className="mt-2 text-sm text-neutral-400">
              Shots-to-kill + time-to-kill based on damage, RPM, and target HP.
            </div>
          </Link>

          {/* Weapon Buffs / Nerfs */}
          <Link
            href="/games/cod/buffs-nerfs"
            className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 hover:border-neutral-600"
          >
            <div className="text-sm font-semibold">Weapon Buffs / Nerfs</div>
            <div className="mt-2 text-sm text-neutral-400">
              Patch watch: expected buffs, nerfs, rebalances, and meta shifts.
            </div>
          </Link>
        </div>

        {/* Optional small footer */}
        <p className="mt-10 text-xs text-neutral-500">
          Tip: Later we can add “latest meta loadouts” and auto-update this page.
        </p>
      </div>
    </main>
  );
}
