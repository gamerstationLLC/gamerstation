/**
 * Build Pokémon per-game dropdown datasets for GamerStation Capture Calc.
 *
 * Output:
 *  - public/data/pokemon/games.json
 *  - public/data/pokemon/by_game/<gameKey>.json
 *
 * Run:
 *   npx tsx scripts/pokemon/build-capture-data.ts
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public", "data", "pokemon");
const BY_GAME_DIR = path.join(OUT_DIR, "by_game");

const POKEAPI = "https://pokeapi.co/api/v2";

/**
 * Curated "major games" list.
 * (You can expand this list freely—this structure supports any count.)
 *
 * key: used as file name in by_game/<key>.json
 * versionGroup: must match PokéAPI version-group slug
 * ruleset: used by the calculator to pick formula details
 */
type GameDef = {
  key: string;
  label: string;
  versionGroup: string;
  ruleset:
    | "gen1"
    | "gen2"
    | "gen3"
    | "gen4"
    | "gen5"
    | "gen6"
    | "gen7"
    | "gen8"
    | "gen9";
};

const MAJOR_GAMES: GameDef[] = [
  // Gen 1
  { key: "redblue", label: "Red / Blue", versionGroup: "red-blue", ruleset: "gen1" },
  { key: "yellow", label: "Yellow", versionGroup: "yellow", ruleset: "gen1" },

  // Gen 2
  { key: "goldsilver", label: "Gold / Silver", versionGroup: "gold-silver", ruleset: "gen2" },
  { key: "crystal", label: "Crystal", versionGroup: "crystal", ruleset: "gen2" },

  // Gen 3
  { key: "rubysapphire", label: "Ruby / Sapphire", versionGroup: "ruby-sapphire", ruleset: "gen3" },
  { key: "emerald", label: "Emerald", versionGroup: "emerald", ruleset: "gen3" },
  { key: "frlg", label: "FireRed / LeafGreen", versionGroup: "firered-leafgreen", ruleset: "gen3" },

  // Gen 4
  { key: "dp", label: "Diamond / Pearl", versionGroup: "diamond-pearl", ruleset: "gen4" },
  { key: "platinum", label: "Platinum", versionGroup: "platinum", ruleset: "gen4" },
  { key: "hgss", label: "HeartGold / SoulSilver", versionGroup: "heartgold-soulsilver", ruleset: "gen4" },

  // Gen 5
  { key: "bw", label: "Black / White", versionGroup: "black-white", ruleset: "gen5" },
  { key: "bw2", label: "Black 2 / White 2", versionGroup: "black-2-white-2", ruleset: "gen5" },

  // Gen 6
  { key: "xy", label: "X / Y", versionGroup: "x-y", ruleset: "gen6" },
  { key: "oras", label: "Omega Ruby / Alpha Sapphire", versionGroup: "omega-ruby-alpha-sapphire", ruleset: "gen6" },

  // Gen 7
  { key: "sm", label: "Sun / Moon", versionGroup: "sun-moon", ruleset: "gen7" },
  { key: "usum", label: "Ultra Sun / Ultra Moon", versionGroup: "ultra-sun-ultra-moon", ruleset: "gen7" },

  // Gen 8
  { key: "swsh", label: "Sword / Shield", versionGroup: "sword-shield", ruleset: "gen8" },
  { key: "bdsp", label: "Brilliant Diamond / Shining Pearl", versionGroup: "brilliant-diamond-and-shining-pearl", ruleset: "gen8" },

  // Gen 9
  { key: "sv", label: "Scarlet / Violet", versionGroup: "scarlet-violet", ruleset: "gen9" },
];

type BaseStats = {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
};

type PokemonRow = {
  id: number;
  name: string;
  slug: string;
  sprite: string | null;
  capture_rate: number | null;
  base_stats: BaseStats | null;
};

async function fetchJSON(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": "GamerStation/1.0" } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${url}`);
  return res.json();
}

function slugify(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureDirs() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(BY_GAME_DIR, { recursive: true });
}

/**
 * Simple concurrency limiter (no deps).
 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      out[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from({ length: Math.max(1, limit) }, () => worker());
  await Promise.all(workers);
  return out;
}

async function getSpeciesCaptureRate(speciesName: string): Promise<number | null> {
  try {
    const sp = await fetchJSON(`${POKEAPI}/pokemon-species/${speciesName}`);
    return typeof sp?.capture_rate === "number" ? sp.capture_rate : null;
  } catch {
    return null;
  }
}

async function getPokemonStatsAndSprite(pokemonName: string): Promise<{
  id: number;
  base_stats: BaseStats | null;
  sprite: string | null;
}> {
  const p = await fetchJSON(`${POKEAPI}/pokemon/${pokemonName}`);

  const id = typeof p?.id === "number" ? p.id : -1;

  const statsArr: any[] = Array.isArray(p?.stats) ? p.stats : [];
  const stat = (key: string) =>
    statsArr.find((x) => x?.stat?.name === key)?.base_stat ?? null;

  const base_stats: BaseStats | null =
    stat("hp") != null
      ? {
          hp: Number(stat("hp")) || 0,
          atk: Number(stat("attack")) || 0,
          def: Number(stat("defense")) || 0,
          spa: Number(stat("special-attack")) || 0,
          spd: Number(stat("special-defense")) || 0,
          spe: Number(stat("speed")) || 0,
        }
      : null;

  const sprite =
    p?.sprites?.other?.["official-artwork"]?.front_default ??
    p?.sprites?.front_default ??
    null;

  return { id, base_stats, sprite };
}

/**
 * For a version-group, get the union of all Pokémon entries from its Pokédex(es).
 */
async function getSpeciesListForVersionGroup(versionGroup: string): Promise<string[]> {
  const vg = await fetchJSON(`${POKEAPI}/version-group/${versionGroup}`);
  const pokedexRefs: any[] = Array.isArray(vg?.pokedexes) ? vg.pokedexes : [];
  const pokedexNames = pokedexRefs.map((p) => p?.name).filter(Boolean);

  const allSpecies = new Set<string>();

  for (const dexName of pokedexNames) {
    const dex = await fetchJSON(`${POKEAPI}/pokedex/${dexName}`);
    const entries: any[] = Array.isArray(dex?.pokemon_entries) ? dex.pokemon_entries : [];
    for (const e of entries) {
      const speciesName = e?.pokemon_species?.name;
      if (speciesName) allSpecies.add(String(speciesName));
    }
  }

  return Array.from(allSpecies);
}

async function buildGame(game: GameDef) {
  console.log(`\n=== Building ${game.label} (${game.versionGroup}) ===`);

  const species = await getSpeciesListForVersionGroup(game.versionGroup);
  console.log(`Species count: ${species.length}`);

  // Pull capture_rate + stats/sprite with concurrency limits (be nice to PokeAPI).
  const rows = await mapLimit(
    species.sort((a, b) => a.localeCompare(b)),
    10,
    async (speciesName) => {
      const capture_rate = await getSpeciesCaptureRate(speciesName);

      // For stats/sprite: use the species name as pokemon name (works for most).
      // Some species have different default forms; if a miss happens, we still keep capture_rate.
      let id = -1;
      let base_stats: BaseStats | null = null;
      let sprite: string | null = null;

      try {
        const data = await getPokemonStatsAndSprite(speciesName);
        id = data.id;
        base_stats = data.base_stats;
        sprite = data.sprite;
      } catch {
        // leave nulls
      }

      const row: PokemonRow = {
        id,
        name: speciesName,
        slug: slugify(speciesName),
        sprite,
        capture_rate,
        base_stats,
      };

      return row;
    }
  );

  // Filter out truly broken entries where we got nothing useful
  const filtered = rows.filter((r) => r.name && r.slug && r.capture_rate != null);

  // Sort by Pokédex-ish id first (if present), else alphabetically
  filtered.sort((a, b) => {
    const ai = a.id > 0 ? a.id : Number.MAX_SAFE_INTEGER;
    const bi = b.id > 0 ? b.id : Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });

  const outPath = path.join(BY_GAME_DIR, `${game.key}.json`);
  await fs.writeFile(outPath, JSON.stringify(filtered, null, 2), "utf8");
  console.log(`Wrote: ${path.relative(ROOT, outPath)} (${filtered.length} rows)`);
}

async function main() {
  await ensureDirs();

  const gamesOut = MAJOR_GAMES.map((g) => ({
    key: g.key,
    label: g.label,
    versionGroup: g.versionGroup,
    ruleset: g.ruleset,
  }));

  await fs.writeFile(path.join(OUT_DIR, "games.json"), JSON.stringify(gamesOut, null, 2), "utf8");
  console.log(`Wrote: ${path.relative(ROOT, path.join(OUT_DIR, "games.json"))}`);

  for (const g of MAJOR_GAMES) {
    await buildGame(g);
  }

  console.log("\n✅ Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
