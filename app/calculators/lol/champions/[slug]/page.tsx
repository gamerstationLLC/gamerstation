// app/calculators/lol/champions/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import fs from "node:fs/promises";
import path from "node:path";

import StatsClient, {
  type ChampionBaseStats,
  type ChampionAbility,
} from "./StatsClient";

type ChampionRow = {
  id: string; // "Ahri"
  name: string;
  title?: string;
  stats?: Record<string, number>;

  // ✅ from your fetch script
  spells?: Array<{
    name?: string;
    tooltip?: string;
    description?: string;
    cooldown?: number[];
    cost?: number[];
    costBurn?: string;
    cooldownBurn?: string;
  }>;

  passive?: {
    name?: string;
    description?: string;
  };
};

type ChampionsFullFile = {
  version?: string; // NOTE: may represent "last changed" depending on your pipeline
  champions?: ChampionRow[];
};

type OverridesSpell = { type?: string; base?: number[] };
type OverridesEntry = {
  id?: string; // championId like "Annie"
  Q?: OverridesSpell;
  W?: OverridesSpell;
  E?: OverridesSpell;
  R?: OverridesSpell;
};
type SpellsOverridesFile = Record<string, OverridesEntry>;

/* -------------------- Blob helpers (local-test friendly) -------------------- */

function blobUrl(pathname: string) {
  const base = process.env.NEXT_PUBLIC_BLOB_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/${pathname.replace(/^\/+/, "")}`;
}

async function fetchJsonFromBlob<T>(pathname: string): Promise<T | null> {
  const url = blobUrl(pathname);
  if (!url) return null;

  try {
    const res = await fetch(url, {
      // ✅ allow Next to revalidate instead of pure no-store
      // (helps crawlers see stable titles)
      next: { revalidate: 60 * 60 }, // 1 hour
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function readJsonAbs<T>(absPath: string): Promise<T> {
  const raw = await fs.readFile(absPath, "utf-8");
  return JSON.parse(raw) as T;
}

/**
 * For this route we want:
 * - Local FS first (works in dev without env vars, and works at build time)
 * - Blob fallback if you move these files out of repo later
 */
async function readJsonLocalFirstBlobFallback<T>(
  localAbsPath: string,
  blobPathname: string
): Promise<T | null> {
  try {
    return await readJsonAbs<T>(localAbsPath);
  } catch {
    // try blob
  }
  return await fetchJsonFromBlob<T>(blobPathname);
}

/* -------------------- paths (static, no dynamic tracing) -------------------- */

const CHAMPIONS_FULL_LOCAL = path.join(
  process.cwd(),
  "public",
  "data",
  "lol",
  "champions_full.json"
);
const OVERRIDES_LOCAL = path.join(
  process.cwd(),
  "public",
  "data",
  "lol",
  "spells_overrides.json"
);

// Blob pathnames (relative to NEXT_PUBLIC_BLOB_BASE_URL)
const CHAMPIONS_FULL_BLOB = "data/lol/champions_full.json";
const VERSION_BLOB = "data/lol/version.json"; // ✅ version ONLY from blob
const OVERRIDES_BLOB = "data/lol/spells_overrides.json";

/* -------------------- data loaders -------------------- */

async function readChampionsFull(): Promise<ChampionsFullFile> {
  const file =
    (await readJsonLocalFirstBlobFallback<ChampionsFullFile>(
      CHAMPIONS_FULL_LOCAL,
      CHAMPIONS_FULL_BLOB
    )) ?? null;

  if (!file) throw new Error("champions_full.json missing (local and blob)");
  return file;
}

/**
 * ✅ Patch label source of truth:
 * 1) Blob version.json ONLY
 * 2) Riot ddragon versions endpoint (server fetch)
 *
 * We DO NOT use local version.json.
 * We DO NOT use champions_full.version for SEO patch labeling.
 */
let currentPatchPromise: Promise<string> | null = null;

async function readCurrentPatch(): Promise<string> {
  if (!currentPatchPromise) {
    currentPatchPromise = (async () => {
      // 1) Blob version.json ONLY
      const json = await fetchJsonFromBlob<{ version?: string }>(VERSION_BLOB);
      const v = String(json?.version ?? "").trim();
      if (v) return v;

      // 2) Fallback: Data Dragon versions (latest is first)
      try {
        const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", {
          next: { revalidate: 60 * 60 }, // 1 hour
        });
        if (!res.ok) return "current";
        const arr = (await res.json()) as unknown;
        if (Array.isArray(arr) && typeof arr[0] === "string") {
          const vv = String(arr[0]).trim();
          if (vv) return vv;
        }
      } catch {
        // ignore
      }

      return "current";
    })();
  }
  return currentPatchPromise;
}

/* ------------------- slug + champion helpers ------------------- */

function normalizeSlug(s: unknown) {
  if (typeof s !== "string") return "";
  return s.trim().toLowerCase();
}

async function unwrapParams<T>(maybePromise: T | Promise<T>): Promise<T> {
  return await Promise.resolve(maybePromise);
}

function findChampionBySlug(champions: ChampionRow[], slug: unknown): ChampionRow | null {
  const wanted = normalizeSlug(slug);
  if (!wanted) return null;

  const byId = champions.find((c) => normalizeSlug(c.id) === wanted);
  if (byId) return byId;

  const byName = champions.find((c) => normalizeSlug(c.name) === wanted);
  return byName ?? null;
}

function toBaseStats(stats: Record<string, number> | undefined): ChampionBaseStats {
  const n = (k: string) => Number(stats?.[k] ?? 0);
  return {
    hp: n("hp"),
    hpperlevel: n("hpperlevel"),
    mp: n("mp"),
    mpperlevel: n("mpperlevel"),
    hpregen: n("hpregen"),
    hpregenperlevel: n("hpregenperlevel"),
    mpregen: n("mpregen"),
    mpregenperlevel: n("mpregenperlevel"),
    armor: n("armor"),
    armorperlevel: n("armorperlevel"),
    spellblock: n("spellblock"),
    spellblockperlevel: n("spellblockperlevel"),
    attackdamage: n("attackdamage"),
    attackdamageperlevel: n("attackdamageperlevel"),
    attackspeed: n("attackspeed"),
    attackspeedperlevel: n("attackspeedperlevel"),
    movespeed: n("movespeed"),
    attackrange: n("attackrange"),
    crit: n("crit"),
    critperlevel: n("critperlevel"),
  };
}

/* ------------------- tooltip helpers (keep it not-wiki) ------------------- */

function stripHtml(s: string) {
  return s.replace(/<\/?[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function shortSummaryFromText(s: string, maxLen = 190) {
  const clean = stripHtml(s);
  if (!clean) return "";
  const first = clean.split(/(?<=[.!?])\s+/)[0] ?? clean;
  if (first.length <= maxLen) return first;
  return first.slice(0, maxLen - 1).trimEnd() + "¦";
}

function asNumArray(x: any): number[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const out = x.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  return out.length ? out : undefined;
}

function parseSlashNums(s: any): number[] | undefined {
  if (typeof s !== "string") return undefined;
  const out = s
    .split("/")
    .map((p) => Number(p))
    .filter((n) => Number.isFinite(n));
  return out.length ? out : undefined;
}

/* -------------------- overrides loader (cached per module) -------------------- */

let overridesPromise: Promise<SpellsOverridesFile | null> | null = null;

async function readSpellsOverrides(): Promise<SpellsOverridesFile | null> {
  if (!overridesPromise) {
    overridesPromise = (async () => {
      const file =
        (await readJsonLocalFirstBlobFallback<SpellsOverridesFile>(
          OVERRIDES_LOCAL,
          OVERRIDES_BLOB
        )) ?? null;
      return file;
    })();
  }
  return overridesPromise;
}

async function findOverridesEntryByChampionId(
  championId: string
): Promise<OverridesEntry | null> {
  const file = await readSpellsOverrides();
  if (!file) return null;

  for (const v of Object.values(file)) {
    if (v?.id === championId) return v;
  }
  return null;
}

function toDamageType(t?: string): ChampionAbility["damageType"] | undefined {
  const s = String(t ?? "").toLowerCase();
  if (!s) return undefined;
  if (s === "magic") return "magic";
  if (s === "physical" || s === "phys") return "physical";
  if (s === "true") return "true";
  return "mixed";
}

/* ------------------------- build merged abilities list ------------------------- */

function buildAbilitiesFromChampion(
  champ: ChampionRow,
  overrides: OverridesEntry | null
): ChampionAbility[] {
  // Data Dragon spells array is Q,W,E,R order
  const ddSpells = champ.spells ?? [];

  const Q = ddSpells[0] ?? {};
  const W = ddSpells[1] ?? {};
  const E = ddSpells[2] ?? {};
  const R = ddSpells[3] ?? {};

  const passive = champ.passive ?? {};

  const baseFromOverrides = (key: "Q" | "W" | "E" | "R"): number[] | undefined => {
    const arr = overrides?.[key]?.base;
    if (!Array.isArray(arr)) return undefined;
    const out = arr.map((n) => Number(n)).filter((n) => Number.isFinite(n));
    return out.length ? out : undefined;
  };

  const mkSpell = (key: "Q" | "W" | "E" | "R", dd: any) => {
    const tooltip = String(dd?.tooltip ?? dd?.description ?? "");
    const summary = tooltip ? shortSummaryFromText(tooltip) : undefined;

    const cooldown =
      asNumArray(dd?.cooldown) ?? parseSlashNums(dd?.cooldownBurn) ?? undefined;

    const cost = asNumArray(dd?.cost) ?? parseSlashNums(dd?.costBurn) ?? undefined;

    const base = baseFromOverrides(key);
    const oType = overrides?.[key]?.type;

    const scalars =
      base && base.length
        ? [
            {
              label: "Base Damage",
              values: base,
              precision: 0,
            },
          ]
        : undefined;

    return {
      key,
      name: String(dd?.name ?? key),
      summary,
      cooldown,
      cost,
      scalars,
      damageType: toDamageType(oType),
    } satisfies ChampionAbility;
  };

  const out: ChampionAbility[] = [];

  // Passive (always show)
  const pDesc = String(passive?.description ?? "");
  out.push({
    key: "P",
    name: String(passive?.name ?? "Passive"),
    summary: pDesc ? shortSummaryFromText(pDesc) : undefined,
  });

  // QWER (always show, even if no overrides)
  out.push(mkSpell("Q", Q));
  out.push(mkSpell("W", W));
  out.push(mkSpell("E", E));
  out.push(mkSpell("R", R));

  return out;
}

/**
 * ✅ Dynamic metadata per champion page (SEO)
 * Patch label comes from Blob version.json so Google shows current patch.
 */
export async function generateMetadata({
  params,
}: {
  params: { slug?: string } | Promise<{ slug?: string }>;
}): Promise<Metadata> {
  const resolved = await unwrapParams(params);
  const slug = normalizeSlug(resolved?.slug);
  if (!slug) return { robots: { index: false, follow: false } };

  let file: ChampionsFullFile | null = null;
  try {
    file = await readChampionsFull();
  } catch {}

  const champions = file?.champions ?? [];
  const champ = findChampionBySlug(champions, slug);

  const patch = await readCurrentPatch(); // ✅ blob-only
  const safeName = champ?.name ?? slug;
  const safeTitle = champ?.title ? ` — ${champ.title}` : "";

  const title = `${safeName}${safeTitle} Stats by Level (Patch ${patch}) | GamerStation`;
  const description =
    `View ${safeName} stats by level (1–18), including base attack damage, armor, MR, HP, and attack speed scaling. ` +
    `Current patch ${patch}. Not affiliated with or endorsed by Riot Games.`;

  const canonical = `/calculators/lol/champions/${slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "GamerStation",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

/**
 * ✅ Prebuild all champion slug pages
 */
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  try {
    const file = await readChampionsFull();
    const champs = file.champions ?? [];
    return champs
      .map((c) => c.id)
      .filter(Boolean)
      .map((id) => ({ slug: String(id).toLowerCase() }));
  } catch {
    return [];
  }
}

export default async function LolChampionPage({
  params,
}: {
  params: { slug?: string } | Promise<{ slug?: string }>;
}) {
  const resolved = await unwrapParams(params);
  const slug = normalizeSlug(resolved?.slug);
  if (!slug) return notFound();

  const file = await readChampionsFull().catch(() => null);
  const champions = file?.champions ?? [];
  const champ = findChampionBySlug(champions, slug);
  if (!champ) return notFound();

  // ✅ Patch label from blob-only version.json
  const patch = await readCurrentPatch();

  const championId = champ.id;
  const championName = champ.name;
  const stats = toBaseStats(champ.stats);
  const calcHref = `/calculators/lol?champion=${encodeURIComponent(championId)}`;

  const overridesEntry = await findOverridesEntryByChampionId(championId).catch(() => null);
  const abilities = buildAbilitiesFromChampion(champ, overridesEntry);

  const safeName = championName || championId;
  const canonical = `/calculators/lol/champions/${slug}`;

  return (
    <main className="min-h-screen bg-transparent text-white px-6 py-12">
      <div className="mx-auto max-w-6xl">
        
        <StatsClient
          championId={championId}
          championName={championName}
          patch={patch}
          calcHref={calcHref}
          stats={stats}
          abilities={abilities}
          defaultLevel={1}
        />

        {/* ✅ SEO / About (SSR, collapsed) */}
       
      </div>
    </main>
  );
}
