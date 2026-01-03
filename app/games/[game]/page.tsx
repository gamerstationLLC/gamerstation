import Link from "next/link";

const GAMES = [
  { slug: "cod", name: "Call of Duty", desc: "TTK + buffs/nerfs" },
  { slug: "valorant", name: "Valorant", desc: "TTK / econ tools (later)" },
  { slug: "fortnite", name: "Fortnite", desc: "DPS/TTK + drop tools (later)" },
  { slug: "w101", name: "Wizard101", desc: "Damage/resist calculators (later)" },
  { slug: "universal", name: "Universal", desc: "General calculators" },
];

export default function GamesPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-sm text-neutral-300 hover:text-white">
            ← Home
          </Link>
          <Link href="/calculators" className="text-sm text-neutral-300 hover:text-white">
            Calculators →
          </Link>
        </header>

        <h1 className="mt-8 text-4xl font-bold">Choose a Game</h1>
        <p className="mt-3 max-w-2xl text-neutral-300">
          Pick a game to see tools for it.
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
