// lib/lol/ddragon.ts
export type DDragonSpellVar = {
  key: string; // e.g. "a1"
  link: string; // "ap", "attackdamage", "bonusattackdamage", etc.
  coeff: number | number[];
};

export type DDragonSpell = {
  id: string;
  name: string;
  tooltip: string;
  maxrank: number;
  effect: Array<number[] | null>;
  vars?: DDragonSpellVar[];
};

export type DDragonChampionFull = {
  id: string; // "Ahri"
  key: string;
  name: string;
  title: string;
  spells: DDragonSpell[]; // Q,W,E,R in order
  stats: Record<string, number>;
};

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_DDRAGON_BASE ||
    "https://ddragon.leagueoflegends.com"
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`DDragon fetch failed ${res.status}: ${url}`);
  return (await res.json()) as T;
}

// Client-side in-memory cache so champs don't refetch repeatedly
const champCache = new Map<string, DDragonChampionFull>();

/**
 * Fetch full champion JSON from Data Dragon.
 * `championId` should be like "Ahri", "Vladimir", "Blitzcrank"
 * `version` can be your `patch` prop (recommended).
 */
export async function getChampionFull(params: {
  championId: string;
  version: string;
  locale?: string;
}): Promise<DDragonChampionFull> {
  const { championId, version, locale = "en_US" } = params;
  const cacheKey = `${version}:${locale}:${championId}`;

  const cached = champCache.get(cacheKey);
  if (cached) return cached;

  const url = `${baseUrl()}/cdn/${version}/data/${locale}/champion/${championId}.json`;
  const raw = await fetchJson<{ data: Record<string, DDragonChampionFull> }>(url);

  const firstKey = Object.keys(raw.data)[0];
  if (!firstKey) throw new Error(`No champion data found for ${championId}.`);

  const champ = raw.data[firstKey]!;
  champCache.set(cacheKey, champ);
  return champ;
}
