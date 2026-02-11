// app/calculators/pokemon/catch/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import PokemonCatchCalcClient from "./client";
import { readPublicJson } from "@/lib/blob";
import type { RulesetKey } from "./catchMath";

export const metadata: Metadata = {
  title: "Pokémon Catch Rate Calculator | GamerStation",
  description:
    "Calculate Pokémon catch chance across games with ball, status, and HP inputs. Fast, clean, and accurate catch math by ruleset.",
};

export const dynamic = "force-static";
export const revalidate = 600;

/**
 * ✅ Export as a TYPE (not a value) so client.tsx can `import type { GameDef }`.
 * This matches how you use it in the client component: props.games: GameDef[]
 */
export type GameDef = {
  gameKey: string; // used for selection + by_game lookup
  label: string; // display label in dropdown
  rulesetKey: RulesetKey; // catch math ruleset key
  pokedex?: string; // optional display hint
  byGameFile?: string; // optional: explicit by_game/<file>.json stem
};

async function safeReadJson<T>(p: string): Promise<T | null> {
  try {
    return await readPublicJson<T>(p);
  } catch {
    return null;
  }
}

function normalizeGames(raw: unknown): GameDef[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as GameDef[];

  const anyRaw = raw as any;
  if (Array.isArray(anyRaw?.games)) return anyRaw.games as GameDef[];
  if (Array.isArray(anyRaw?.rows)) return anyRaw.rows as GameDef[];
  if (typeof raw === "object") return Object.values(anyRaw) as GameDef[];

  return [];
}

export default async function PokemonCatchCalcPage() {
  // Prefer blob/disk via your unified reader.
  const rawGames = (await safeReadJson<unknown>("/data/pokemon/games.json")) ?? null;
  const games = normalizeGames(rawGames);

  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  return (
    <main className="min-h-screen bg-transparent px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        {/* ✅ Standard GS header */}
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/gs-logo-v2.png"
              alt="GamerStation"
              className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_25px_rgba(0,255,255,0.20)]"
            />
            <div className="text-lg font-black">
              GamerStation<span className="align-super text-[0.6em]">™</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
      
            <Link href="/calculators" className={navBtn}>
              Calculators
            </Link>
          </div>
        </header>

        <div className="mt-8">
          <div className="mb-2 text-3xl font-black">Pokémon Catch Rate Calculator</div>
          <div className="text-sm text-neutral-400">
            Pick a game, pick a Pokémon, then tune HP/status/ball to see your catch odds.
          </div>
        </div>

        <div className="mt-10">
          <PokemonCatchCalcClient games={games} />
        </div>

        <div className="mt-10 text-xs text-neutral-600">
          Disclaimer: Catch formulas vary by generation/game. This tool uses the ruleset selected per game dataset.
        </div>
      </div>
    </main>
  );
}
