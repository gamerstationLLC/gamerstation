import type { Metadata } from "next";
import Link from "next/link";
import PokemonCatchCalcClient from "./client";
import { readPublicJson } from "@/lib/server/readPublicJson";

export const metadata: Metadata = {
  title: "Pokémon Catch Calculator | GamerStation",
  description:
    "Pick a Pokémon game and Pokémon, auto-fill base catch rate and stats, and estimate catch chance by HP, status, and ball.",
  alternates: { canonical: "/tools/pokemon/catch" },
};

export const revalidate = 86400;

// What your client expects
type GameDef = {
  gameKey: string; // ✅ MUST match blob filename stem (sv, bdsp, hgss, dp, frlg, etc)
  label: string;
  versionName: string;
  versionGroup: string;
  generation: string;
  pokedex: string;
  rulesetKey: string;
};

// What your games.json actually contains (from your snippet)
type RawGame = {
  key: string;
  label: string;
  versionGroup: string;
  ruleset: string; // e.g. "gen8"
};

function genFromRuleset(ruleset: string): string {
  const m = String(ruleset || "").match(/gen(\d+)/i);
  return m?.[1] ? `Gen ${m[1]}` : "—";
}

export default async function PokemonCatchPage() {
  // ✅ Disk-first, then Blob fallback (your GS pattern)
  const raw = await readPublicJson<RawGame[]>("data/pokemon/games.json", {
    revalidateSeconds: 86400,
  });

  // ✅ Normalize to client shape so the UI uses `gameKey` (sv, bdsp, hgss, etc)
  const games: GameDef[] = Array.isArray(raw)
    ? raw
        .filter((g) => g && typeof g.key === "string" && typeof g.label === "string")
        .map((g) => {
          const key = String(g.key).trim();

          return {
            gameKey: key,                 // ✅ this is the blob filename stem
            label: String(g.label || key),
            versionName: String(g.label || key), // display name
            versionGroup: String(g.versionGroup || ""),
            generation: genFromRuleset(String(g.ruleset || "")),
            pokedex: "national",
            rulesetKey: String(g.ruleset || ""),
          };
        })
    : [];

  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* ✅ Standard GS header (same style as your LoL leaderboard) */}
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
                <span className="align-super text-[0.6em]">™</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link className={navBtn} href="/tools">
              Tools
            </Link>
          </div>
        </header>

        {/* Title */}
        <div className="mt-10">
          <h1 className="text-3xl font-black tracking-tight">Pokémon Catch Calculator</h1>
          <p className="mt-2 text-sm text-neutral-300">
            Pick the exact game, then the exact Pokémon. We’ll auto-fill base catch rate + stats.
          </p>
        </div>

        <div className="mt-8">
          <PokemonCatchCalcClient games={games} />
        </div>
      </div>
    </main>
  );
}
