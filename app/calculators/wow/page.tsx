import Link from "next/link";

export default function WoWPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Link
            href="/calculators"
            className="text-sm text-neutral-300 hover:text-white"
          >
            ← Back to Calculators
          </Link>
        </header>

        <h1 className="mt-8 text-4xl font-bold">World of Warcraft</h1>
        <p className="mt-3 text-neutral-300">
          Choose a category to get started.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {/* PvE */}
          <Link
            href="/calculators/wow/pve"
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 hover:border-neutral-600 transition"
          >
            <div className="text-sm font-semibold">PvE</div>
            <div className="mt-2 text-sm text-neutral-400">
              Mythic+ scaling, dungeon math, PvE tools.
            </div>
          </Link>

          {/* PvP (Coming Soon) */}
          <div
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 opacity-60 cursor-not-allowed"
          >
            <div className="text-sm font-semibold">
              PvP{" "}
              <span className="ml-1 text-xs text-neutral-400">
                (coming soon)
              </span>
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
