// scripts/pokemon/build-catch-data.ts
//
// Builds:
//  - public/data/pokemon/games.json
//  - public/data/pokemon/by_game/*.json
//
// Data source: PokeAPI (species + pokemon endpoints)
// Output is designed to match your Catch Calculator client.
//
// Run:
//   npx tsx scripts/pokemon/build-catch-data.ts
//
// Optional env:
//   POKEMON_OUT_DIR=public/data/pokemon
//   POKEMON_CONCURRENCY=12
//   POKEMON_ONLY=sv,bw2   (comma-separated byGameFile stems)

import fs from "node:fs/promises";
import path from "node:path";

type RulesetKey = "gen1" | "gen2" | "gen34" | "gen5plus" | "letsgo" | "pla";

type GameDef = {
  gameKey: string;
  label: string;
  versionName: string;
  versionGroup: string;
  generation: string;
  pokedex: string;
  rulesetKey: RulesetKey;
  // ✅ IMPORTANT: this MUST match your by_game filename stem (sv, bw2, hgss, etc.)
  byGameFile: string;
};

type MonRow = {
  id: number;
  name: string; // "pikachu"
  slug: string; // same as name for now
  displayName: string; // "Pikachu"
  sprite: string; // official artwork url
  capture_rate: number; // 0..255
  base_stats: {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
  };
};

// -------------------------
// Config
// -------------------------

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, process.env.POKEMON_OUT_DIR ?? "public/data/pokemon");
const BY_GAME_DIR = path.join(OUT_DIR, "by_game");

const CONCURRENCY = clampInt(process.env.POKEMON_CONCURRENCY, 12, 1, 64);
const ONLY = parseOnly(process.env.POKEMON_ONLY);

// -------------------------
// Game mapping (matches your by_game filenames)
// -------------------------

const GAMES: GameDef[] = [
  {
    gameKey: "redblue",
    byGameFile: "redblue",
    label: "Red / Blue",
    versionName: "red-blue",
    versionGroup: "red-blue",
    generation: "gen1",
    pokedex: "national",
    rulesetKey: "gen1",
  },
  {
    gameKey: "yellow",
    byGameFile: "yellow",
    label: "Yellow",
    versionName: "yellow",
    versionGroup: "red-blue",
    generation: "gen1",
    pokedex: "national",
    rulesetKey: "gen1",
  },
  {
    gameKey: "goldsilver",
    byGameFile: "goldsilver",
    label: "Gold / Silver",
    versionName: "gold-silver",
    versionGroup: "gold-silver",
    generation: "gen2",
    pokedex: "national",
    rulesetKey: "gen2",
  },
  {
    gameKey: "crystal",
    byGameFile: "crystal",
    label: "Crystal",
    versionName: "crystal",
    versionGroup: "gold-silver",
    generation: "gen2",
    pokedex: "national",
    rulesetKey: "gen2",
  },
  {
    gameKey: "rubysapphire",
    byGameFile: "rubysapphire",
    label: "Ruby / Sapphire",
    versionName: "ruby-sapphire",
    versionGroup: "ruby-sapphire",
    generation: "gen3",
    pokedex: "national",
    rulesetKey: "gen34",
  },
  {
    gameKey: "emerald",
    byGameFile: "emerald",
    label: "Emerald",
    versionName: "emerald",
    versionGroup: "ruby-sapphire",
    generation: "gen3",
    pokedex: "national",
    rulesetKey: "gen34",
  },
  {
    gameKey: "frlg",
    byGameFile: "frlg",
    label: "FireRed / LeafGreen",
    versionName: "firered-leafgreen",
    versionGroup: "firered-leafgreen",
    generation: "gen3",
    pokedex: "national",
    rulesetKey: "gen34",
  },
  {
    gameKey: "dp",
    byGameFile: "dp",
    label: "Diamond / Pearl",
    versionName: "diamond-pearl",
    versionGroup: "diamond-pearl",
    generation: "gen4",
    pokedex: "national",
    rulesetKey: "gen34",
  },
  {
    gameKey: "platinum",
    byGameFile: "platinum",
    label: "Platinum",
    versionName: "platinum",
    versionGroup: "diamond-pearl",
    generation: "gen4",
    pokedex: "national",
    rulesetKey: "gen34",
  },
  {
    gameKey: "hgss",
    byGameFile: "hgss",
    label: "HeartGold / SoulSilver",
    versionName: "heartgold-soulsilver",
    versionGroup: "heartgold-soulsilver",
    generation: "gen4",
    pokedex: "national",
    rulesetKey: "gen34",
  },
  {
    gameKey: "bw",
    byGameFile: "bw",
    label: "Black / White",
    versionName: "black-white",
    versionGroup: "black-white",
    generation: "gen5",
    pokedex: "national",
    rulesetKey: "gen5plus",
  },
  {
    gameKey: "bw2",
    byGameFile: "bw2",
    label: "Black 2 / White 2",
    versionName: "black-2-white-2",
    versionGroup: "black-2-white-2",
    generation: "gen5",
    pokedex: "national",
    rulesetKey: "gen5plus",
  },
  {
    gameKey: "xy",
    byGameFile: "xy",
    label: "X / Y",
    versionName: "x-y",
    versionGroup: "x-y",
    generation: "gen6",
    pokedex: "national",
    rulesetKey: "gen5plus",
  },
  {
    gameKey: "oras",
    byGameFile: "oras",
    label: "Omega Ruby / Alpha Sapphire",
    versionName: "omega-ruby-alpha-sapphire",
    versionGroup: "omega-ruby-alpha-sapphire",
    generation: "gen6",
    pokedex: "national",
    rulesetKey: "gen5plus",
  },
  {
    gameKey: "sm",
    byGameFile: "sm",
    label: "Sun / Moon",
    versionName: "sun-moon",
    versionGroup: "sun-moon",
    generation: "gen7",
    pokedex: "national",
    rulesetKey: "gen5plus",
  },
  {
    gameKey: "usum",
    byGameFile: "usum",
    label: "Ultra Sun / Ultra Moon",
    versionName: "ultra-sun-ultra-moon",
    versionGroup: "ultra-sun-ultra-moon",
    generation: "gen7",
    pokedex: "national",
    rulesetKey: "gen5plus",
  },
  {
    gameKey: "swsh",
    byGameFile: "swsh",
    label: "Sword / Shield",
    versionName: "sword-shield",
    versionGroup: "sword-shield",
    generation: "gen8",
    pokedex: "national",
    rulesetKey: "gen5plus",
  },
  {
    gameKey: "sv",
    byGameFile: "sv",
    label: "Scarlet / Violet",
    versionName: "scarlet-violet",
    versionGroup: "scarlet-violet",
    generation: "gen9",
    pokedex: "national",
    rulesetKey: "gen5plus",
  },
];

// By-generation max national dex number
// (Used to bound the build. Adjust any time.)
const GEN_MAX: Record<string, number> = {
  gen1: 151,
  gen2: 251,
  gen3: 386,
  gen4: 493,
  gen5: 649,
  gen6: 721,
  gen7: 809,
  gen8: 905,
  gen9: 1025,
};

// -------------------------
// PokeAPI types
// -------------------------

type NamedAPIResource = { name: string; url: string };

type PokeApiName = { name: string; language: NamedAPIResource };

type PokeApiSpecies = {
  id: number;
  name: string;
  capture_rate: number;
  names: PokeApiName[];
};

type PokeApiStat = { stat: NamedAPIResource; base_stat: number };

type PokeApiPokemon = {
  id: number;
  name: string;
  stats: PokeApiStat[];
  sprites?: {
    other?: {
      ["official-artwork"]?: { front_default?: string | null };
    };
  };
};

function getEnglishName(names: PokeApiName[], fallback: string): string {
  const hit = names.find((n) => n.language?.name === "en" && n.name);
  return hit?.name?.trim() || titleCase(fallback);
}

function statMap(stats: PokeApiStat[]) {
  const out: Record<string, number> = {};
  for (const s of stats) {
    const key = (s.stat?.name || "").toLowerCase();
    out[key] = Number(s.base_stat ?? 0);
  }
  return out;
}

// -------------------------
// Fetch helpers
// -------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

function speciesUrl(id: number) {
  return `https://pokeapi.co/api/v2/pokemon-species/${id}/`;
}
function pokemonUrl(id: number) {
  return `https://pokeapi.co/api/v2/pokemon/${id}/`;
}

async function buildMonRow(id: number): Promise<MonRow | null> {
  try {
    const [species, mon] = await Promise.all([
      fetchJson<PokeApiSpecies>(speciesUrl(id)),
      fetchJson<PokeApiPokemon>(pokemonUrl(id)),
    ]);

    const s = statMap(mon.stats || []);
    const sprite =
      mon.sprites?.other?.["official-artwork"]?.front_default ||
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

    return {
      id,
      name: mon.name,
      slug: mon.name,
      displayName: getEnglishName(species.names || [], mon.name),
      capture_rate: Number(species.capture_rate ?? 0),
      sprite,
      base_stats: {
        hp: Number(s.hp ?? 0),
        atk: Number(s.attack ?? 0),
        def: Number(s.defense ?? 0),
        spa: Number(s["special-attack"] ?? 0),
        spd: Number(s["special-defense"] ?? 0),
        spe: Number(s.speed ?? 0),
      },
    };
  } catch {
    // Some ids can be missing / special forms oddities; skip safely
    return null;
  }
}

// Simple concurrency pool
async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length) as R[];
  let i = 0;

  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

// -------------------------
// FS helpers
// -------------------------

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function writeJson(fileAbs: string, data: unknown) {
  const txt = JSON.stringify(data, null, 2);
  await fs.writeFile(fileAbs, txt, "utf8");
}

// -------------------------
// Utils
// -------------------------

function titleCase(s: string) {
  return (s || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function clampInt(vRaw: unknown, fallback: number, min: number, max: number) {
  const n = Number(String(vRaw ?? "").trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function parseOnly(v: string | undefined): Set<string> | null {
  const raw = (v ?? "").trim();
  if (!raw) return null;
  const parts = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return new Set(parts);
}

// -------------------------
// Main
// -------------------------

async function main() {
  await ensureDir(OUT_DIR);
  await ensureDir(BY_GAME_DIR);

  // ✅ write games.json with byGameFile mapping
  const gamesOut = GAMES.map((g) => ({
    gameKey: g.gameKey,
    label: g.label,
    versionName: g.versionName,
    versionGroup: g.versionGroup,
    generation: g.generation,
    pokedex: g.pokedex,
    rulesetKey: g.rulesetKey,
    byGameFile: g.byGameFile,
  }));

  await writeJson(path.join(OUT_DIR, "games.json"), gamesOut);

  // Build each by_game file
  const selectedGames = ONLY ? GAMES.filter((g) => ONLY.has(g.byGameFile)) : GAMES;

  for (const g of selectedGames) {
    const maxId = GEN_MAX[g.generation] ?? 151;
    const ids = Array.from({ length: maxId }, (_, i) => i + 1);

    console.log(`[pokemon] building ${g.byGameFile}.json (${g.label}) ids=1..${maxId} concurrency=${CONCURRENCY}`);

    const rows = await mapPool(ids, CONCURRENCY, async (id) => buildMonRow(id));
    const cleaned = rows.filter((x): x is MonRow => !!x);

    // stable sort
    cleaned.sort((a, b) => a.id - b.id);

    const outFile = path.join(BY_GAME_DIR, `${g.byGameFile}.json`);
    await writeJson(outFile, cleaned);

    console.log(`[pokemon] wrote ${path.relative(ROOT, outFile)} rows=${cleaned.length}`);
  }

  console.log(`[pokemon] done. games.json + by_game/*.json updated.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
