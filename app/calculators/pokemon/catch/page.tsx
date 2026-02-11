import type { Metadata } from "next";
import Link from "next/link";
import PokemonCatchCalcClient from "./client";
import { readPublicJson } from "@/lib/server/readPublicJson";

export const metadata: Metadata = {
  title: "Pokemon Catch Calculator | GamerStation",
  description:
    "Pick a Pokemon game and Pokemon, auto-fill base catch rate and stats, and estimate catch chance by HP, status, and ball.",
  alternates: { canonical: "/tools/pokemon/catch" },
};

export const revalidate = 86400;

export type GameDef = {
  gameKey: string;
  label: string;
  versionName: string;
  versionGroup: string;
  generation: string;
  pokedex: string;
  rulesetKey: string;
  // âœ… optional: if you later decide to put exact filename here
  byGameFile?: string; // e.g. "sv" or "scarletviolet"
};

export default async function PokemonCatchPage() {
  const gamesRaw = await readPublicJson<unknown>("data/pokemon/games.json", {
    revalidateSeconds: 86400,
  });

  const games: GameDef[] = Array.isArray(gamesRaw) ? (gamesRaw as GameDef[]) : [];

  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  return (
    <main className="min-h-screen bg-transparent text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/gs-logo-v2.png"
                alt="GamerStation"
                className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_25px_rgba(0,255,255,0.25)]"
              />
              <div className="text-lg font-black tracking-tight">
                GamerStation
                <span className="align-super text-[0.6em]">TM</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link className={navBtn} href="/calculators">
              Calculators
            </Link>
          </div>
        </header>

        <div className="mt-10">
          <h1 className="text-3xl font-black tracking-tight">Pokemon Catch Calculator</h1>
          <p className="mt-2 text-sm text-neutral-300">
            Pick the exact game, then the exact Pokemon. Weâ€™ll auto-fill base catch rate + stats.
          </p>
        </div>

        <div className="mt-8">
          <PokemonCatchCalcClient games={games} />
        </div>
      </div>
    </main>
  );
}
