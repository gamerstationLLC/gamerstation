// lib/blizzard/wow.ts
export type BnetRegion = "us" | "eu" | "kr" | "tw";

const API_HOST: Record<BnetRegion, string> = {
  us: "https://us.api.blizzard.com",
  eu: "https://eu.api.blizzard.com",
  kr: "https://kr.api.blizzard.com",
  tw: "https://tw.api.blizzard.com",
};

const OAUTH_HOST: Record<BnetRegion, string> = {
  us: "https://us.battle.net",
  eu: "https://eu.battle.net",
  kr: "https://kr.battle.net",
  tw: "https://tw.battle.net",
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

/**
 * Warm-lambda token cache (Vercel). Helps keep API calls snappy.
 * Cache is per-region to avoid re-fetching tokens when switching regions.
 */
declare global {
  // eslint-disable-next-line no-var
  var __bnetTokenCache:
    | Partial<Record<BnetRegion, { token: string; expiresAtMs: number }>>
    | undefined;
}

export function getWowApiHost(region: BnetRegion) {
  return API_HOST[region];
}

export function getWowLocale(region: BnetRegion) {
  return region === "eu" ? "en_GB" : "en_US";
}

export function getWowProfileNamespace(region: BnetRegion) {
  // For Profile API calls like /profile/wow/character/.../statistics
  return `profile-${region}`;
}

export function getWowDynamicNamespace(region: BnetRegion) {
  // For Data API calls like /data/wow/realm/index
  return `dynamic-${region}`;
}

/**
 * Client Credentials OAuth token (Application Authentication).
 * Do NOT call this from the browser.
 */
export async function getBnetAccessToken(region: BnetRegion): Promise<string> {
  const clientId = requireEnv("BNET_CLIENT_ID");
  const clientSecret = requireEnv("BNET_CLIENT_SECRET");

  const now = Date.now();
  const cache = globalThis.__bnetTokenCache;
  const hit = cache?.[region];

  // Reuse token until ~60s before expiry
  if (hit && hit.expiresAtMs - 60_000 > now) {
    return hit.token;
  }

  const url = `${OAUTH_HOST[region]}/oauth/token`;
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Blizzard token error (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  globalThis.__bnetTokenCache = {
    ...(globalThis.__bnetTokenCache ?? {}),
    [region]: {
      token: json.access_token,
      expiresAtMs: now + json.expires_in * 1000,
    },
  };

  return json.access_token;
}

// -------------------- Realms --------------------

export type WowRealm = {
  name: string;
  slug: string;
};

export async function fetchWowRealms(region: BnetRegion): Promise<WowRealm[]> {
  const token = await getBnetAccessToken(region);
  const host = getWowApiHost(region);

  const namespace = getWowDynamicNamespace(region);
  const locale = getWowLocale(region);

  const url = `${host}/data/wow/realm/index?namespace=${namespace}&locale=${locale}`;

  // Realms rarely change — cache for 24h on the server to reduce Blizzard calls.
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Accept-Encoding": "gzip, deflate, br",
    },
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Realm index error (${res.status}): ${text}`);
  }

  const data: any = await res.json();

  const realms: WowRealm[] = Array.isArray(data?.realms)
    ? data.realms
        .map((r: any) => ({
          name: String(r?.name ?? "").trim(),
          slug: String(r?.slug ?? "").trim(),
        }))
        .filter((r: WowRealm) => r.name && r.slug)
    : [];

  realms.sort((a, b) => a.name.localeCompare(b.name));
  return realms;
}

// -------------------- Character Stats --------------------

export type WowCharacterStats = {
  region: BnetRegion;
  realmSlug: string;
  name: string;

  level: number | null;

  primary: {
    strength: number | null;
    agility: number | null;
    intellect: number | null;
  };

  secondary: {
    critRating: number | null;
    critPct: number | null;

    hasteRating: number | null;
    hastePct: number | null;

    masteryRating: number | null;
    masteryPct: number | null;

    versatilityRating: number | null;
    versatilityDamageDoneBonusPct: number | null;
    versatilityDamageTakenReductionPct: number | null;
  };
};

/**
 * Fetches Blizzard Profile "statistics" payload and returns a small,
 * consistent shape for your Stat Impact calculator.
 *
 * Requires: region + realmSlug + character name.
 */
export async function fetchWowCharacterStats(input: {
  region: BnetRegion;
  realmSlug: string;
  name: string;
}): Promise<WowCharacterStats> {
  const region = input.region;
  const realmSlug = input.realmSlug.trim().toLowerCase();
  const name = input.name.trim().toLowerCase();

  const token = await getBnetAccessToken(region);
  const host = getWowApiHost(region);

  const namespace = getWowProfileNamespace(region);
  const locale = getWowLocale(region);

  const url =
    `${host}/profile/wow/character/${encodeURIComponent(realmSlug)}` +
    `/${encodeURIComponent(name)}/statistics?namespace=${namespace}&locale=${locale}`;

  // Character stats change often — do not cache at the server fetch level.
  // Your API route already sets an edge cache (e.g., s-maxage=600).
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Accept-Encoding": "gzip, deflate, br",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WoW stats error (${res.status}): ${text}`);
  }

  const data: any = await res.json();

  // Payload varies slightly (melee vs spell keys). Choose what exists.
  const crit = data?.melee_crit ?? data?.spell_crit ?? data?.crit ?? null;
  const haste = data?.melee_haste ?? data?.spell_haste ?? data?.haste ?? null;

  return {
    region,
    realmSlug,
    name,

    level: typeof data?.level === "number" ? data.level : null,

    primary: {
      strength: data?.strength?.effective ?? null,
      agility: data?.agility?.effective ?? null,
      intellect: data?.intellect?.effective ?? null,
    },

    secondary: {
      critRating: crit?.rating ?? null,
      critPct: crit?.value ?? null,

      hasteRating: haste?.rating ?? null,
      hastePct: haste?.value ?? null,

      masteryRating: data?.mastery?.rating ?? null,
      masteryPct: data?.mastery?.value ?? null,

      versatilityRating: data?.versatility ?? null,
      versatilityDamageDoneBonusPct: data?.versatile_damage_done_bonus ?? null,
      versatilityDamageTakenReductionPct:
        data?.versatile_damage_taken_reduction_bonus ?? null,
    },
  };
}
