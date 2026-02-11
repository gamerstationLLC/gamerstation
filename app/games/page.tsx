import Link from "next/link";

const GAMES = [
  { slug: "cod", name: "Call of Duty", desc: "TTK + buffs/nerfs" },
  { slug: "valorant", name: "Valorant", desc: "Tools coming soon" },
  { slug: "fortnite", name: "Fortnite", desc: "Tools coming soon" },
  { slug: "w101", name: "Wizard101", desc: "Tools coming soon" },
];

export default function GamesPage() {
  return (
    <main className="min-h-screen bg-transparent text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center gap-3">
  {/* GS brand */}
  <Link href="/" className="flex items-center gap-2 hover:opacity-90">
    <img
      src="/icon.png"
      alt="GamerStation"
      className="
        h-7 w-7 rounded-lg bg-black p-0.5
        shadow-[0_0_30px_rgba(0,255,255,0.35)]
        ring-1 ring-cyan-400/30
      "
    />
    <span className="text-sm font-black tracking-tight">
      GamerStation<span className="align-super text-[0.6em]">TM</span>
    </span>
  </Link>

  {/* Top-right: Tools + Calculators */}
  <div className="ml-auto flex items-center gap-2">
    <Link
      href="/tools"
      className="rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]"
    >
      Tools
    </Link>
    <Link
      href="/calculators"
      className="rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]"
    >
      Calculators
    </Link>
  </div>
</header>

        <h1 className="mt-8 text-4xl font-bold">Choose a Game</h1>
        <p className="mt-3 max-w-2xl text-neutral-300">
          Pick a game to see its tools.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((g) => (
            <Link
              key={g.slug}
              href={`/games/${g.slug}`}
              className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 hover:border-neutral-600"
            >
              <div className="text-sm font-semibold">{g.name}</div>
              <div className="mt-2 text-sm text-neutral-400">{g.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
