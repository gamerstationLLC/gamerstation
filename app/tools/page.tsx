import Link from "next/link";

export const metadata = {
  title: "Tools | GamerStation",
  description: "Stats tools, leaderboards, and utilities across games.",
};

export default function ToolsPage() {
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

            {/* Right: Calculators button */}
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

          <h1 className="mt-2 text-4xl font-bold tracking-tight">Tools</h1>
          <p className="mt-3 text-neutral-300">
            This is the hub for non-calculator utilities (leaderboards, meta pages, indexes).
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <Link
              href="/tools/lol/leaderboard"
              className="rounded-2xl border border-neutral-800 bg-black/60 p-6 transition hover:border-neutral-600 hover:bg-black/75"
            >
              <div className="text-sm font-semibold">LoL Leaderboards</div>
              <div className="mt-2 text-sm text-neutral-400">
                Filter top players by region/role.
              </div>
            </Link>

            <Link
              href="/calculators/lol/champions"
              className="rounded-2xl border border-neutral-800 bg-black/60 p-6 transition hover:border-neutral-600 hover:bg-black/75"
            >
              <div className="text-sm font-semibold">LoL Champion Index</div>
              <div className="mt-2 text-sm text-neutral-400">
                Base stats + ability numbers.
              </div>
            </Link>

            <Link
              href="/calculators/lol/meta"
              className="rounded-2xl border border-neutral-800 bg-black/60 p-6 transition hover:border-neutral-600 hover:bg-black/75"
            >
              <div className="text-sm font-semibold">LoL Meta</div>
              <div className="mt-2 text-sm text-neutral-400">
                Role-based boots + core items from real ranked matches.
              </div>
            </Link>

            {/* ✅ Dota 2 Player Stats */}
            <Link
              href="/tools/dota/meta"
              className="rounded-2xl border border-neutral-800 bg-black/60 p-6 transition hover:border-neutral-600 hover:bg-black/75"
            >
              <div className="text-sm font-semibold">Dota 2 Meta</div>
              <div className="mt-2 text-sm text-neutral-400">
                Winrate, MMR estimate, and pickrate (OpenDota).
              </div>
            </Link>

{/* ✅ Dota 2 champ index */}
            <Link
              href="/tools/dota/heroes"
              className="rounded-2xl border border-neutral-800 bg-black/60 p-6 transition hover:border-neutral-600 hover:bg-black/75"
            >
              <div className="text-sm font-semibold">Dota 2 Hero Index</div>
              <div className="mt-2 text-sm text-neutral-400">
                Current heros and stats.
              </div>
            </Link>

            {/* Meta Loadouts */}
            <Link
              href="/games/cod/meta-loadouts"
              className="rounded-2xl border border-neutral-800 bg-black/60 p-6 transition hover:border-neutral-600 hover:bg-black/75"
            >
              <div className="text-sm font-semibold">COD Meta Loadouts</div>
              <div className="mt-2 text-sm text-neutral-400">
                Current best weapon builds for Warzone and Multiplayer.
              </div>
            </Link>

            {/* Weapon Buffs / Nerfs */}
            <Link
              href="/games/cod/buffs-nerfs"
              className="rounded-2xl border border-neutral-800 bg-black/60 p-6 transition hover:border-neutral-600 hover:bg-black/75"
            >
              <div className="text-sm font-semibold">COD Weapon Buffs / Nerfs</div>
              <div className="mt-2 text-sm text-neutral-400">
                Patch watch: expected buffs, nerfs, rebalances, and meta shifts.
              </div>
            </Link>

            
          </div>
        </div>
      </div>
    </main>
  );
}
