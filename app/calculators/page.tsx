import Link from "next/link";

export default function CalculatorsPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Ambient background (matches Tools/Home vibe) */}
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
          <header className="mb-8 flex items-center">
  {/* Left: Logo */}
  <Link href="/" className="flex items-center gap-2 hover:opacity-90">
    <img
      src="/gs-logo-v2.png"
      alt="GamerStation"
      className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_30px_rgba(0,255,255,0.12)]"
    />
    <span className="text-lg font-black tracking-tight">
      GamerStation<span className="align-super text-[0.6em]">™</span>
    </span>
  </Link>

  {/* Right: Tools button */}
  <a
  href="/tools"
  className="
    ml-auto rounded-xl border border-neutral-800
    bg-black px-4 py-2 text-sm text-neutral-200
    transition
    hover:border-grey-400
   
    hover:text-white
    hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]
  "
>
  Tools
</a>
</header>


          <h1 className="mt-2 text-4xl font-bold tracking-tight">Calculators</h1>
          <p className="mt-3 text-neutral-300">Pick a game to get started.</p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {/* DPS (generic / legacy) */}
            <Link
              href="/calculators/dps"
              className="rounded-2xl border border-neutral-800 bg-black/60 p-6 transition hover:border-neutral-600 hover:bg-black/75"
            >
              <div className="text-sm font-semibold">DPS Calculator</div>
              <div className="mt-2 text-sm text-neutral-400">
                Universal damage-per-second estimate.
              </div>
            </Link>

            {/* COD TTK */}
            <Link
              href="/games/cod"
              className="rounded-2xl border border-neutral-800 bg-black/60 p-6 transition hover:border-neutral-600 hover:bg-black/75"
            >
              <div className="text-sm font-semibold">Call of Duty</div>
              <div className="mt-2 text-sm text-neutral-400">
                TTK calculator + weapon buffs / nerfs.
              </div>
            </Link>

            {/* Fortnite TTK */}
            <Link
              href="/calculators/ttk/fortnite"
              className="rounded-2xl border border-neutral-800 bg-black/60 p-6 transition hover:border-neutral-600 hover:bg-black/75"
            >
              <div className="text-sm font-semibold">Fortnite TTK Calculator</div>
              <div className="mt-2 text-sm text-neutral-400">
                Per-rarity weapon damage • live fire rates
              </div>
            </Link>

            {/* OSRS DPS */}
            <Link
              href="/calculators/dps/osrs"
              className="rounded-2xl border border-neutral-800 bg-black/60 p-6 transition hover:border-neutral-600 hover:bg-black/75"
            >
              <div className="text-sm font-semibold">OSRS DPS Calculator</div>
              <div className="mt-2 text-sm text-neutral-400">
                Baseline DPS + hit chance + time-to-kill.
              </div>
            </Link>

            {/* League of Legends */}
            <Link
              href="/calculators/lol/hub"
              className="rounded-2xl border border-neutral-800 bg-black/60 p-6 transition hover:border-neutral-600 hover:bg-black/75"
            >
              <div className="text-sm font-semibold">League of Legends</div>
              <div className="mt-2 text-sm text-neutral-400">
                Burst + AP/AD stat impact calculators.
              </div>
            </Link>

            {/* World of Warcraft */}
            <Link
              href="/calculators/wow"
              className="rounded-2xl border border-neutral-800 bg-black/60 p-6 transition hover:border-neutral-600 hover:bg-black/75"
            >
              <div className="text-sm font-semibold">World of Warcraft</div>
              <div className="mt-2 text-sm text-neutral-400">
                PvE & PvP calculators for Mythic+, raids, and arenas.
              </div>
            </Link>

            {/* Roblox Calculators */}
            <Link
              href="/calculators/roblox"
              className="rounded-2xl border border-neutral-800 bg-black/60 p-6 transition hover:border-neutral-600 hover:bg-black/75"
            >
              <div className="text-sm font-semibold">Roblox Calculators</div>
              <div className="mt-2 text-sm text-neutral-400">
                XP, leveling, and progression tools for top Roblox games.
              </div>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
