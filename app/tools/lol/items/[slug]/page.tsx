// app/tools/lol/items/[slug]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import ItemClient from "./client";

type Params = { slug: string };
type UsageSource = "ranked" | "casual" | "combined";

type ItemUsageRow = {
  itemId: number;
  games: number;
  wins: number;
  winrate: number; // 0..1
  topChamps: Array<{
    champId: number;
    games: number;
    wins: number;
    winrate: number; // 0..1
  }>;
};

type ItemsUsageFile = {
  generatedAt: string;
  source: UsageSource;
  items: ItemUsageRow[];
};

type LoLItemsJson = {
  version?: string;
  data: Record<
    string,
    {
      name?: string;
      description?: string;
      plaintext?: string;
      tags?: string[];
      gold?: { total?: number; sell?: number };
      image?: { full?: string };
      from?: string[];
      into?: string[];
      stats?: Record<string, number>;
    }
  >;
};

type DDragonChampionLite = {
  id: string; // "Aatrox"
  key: string; // "266"
  name: string; // "Aatrox"
};

type DDragonChampionJson = {
  version?: string;
  data: Record<string, DDragonChampionLite>;
};

export type BuildPathItem = {
  itemId: number;
  name: string;
  slug: string;
  iconUrl: string;
  costTotal: number | null;
};

export type EnrichedItem = {
  patch: string;
  generatedAt: string;
  source: UsageSource;

  itemId: number;
  name: string;
  slug: string;
  iconUrl: string;

  costTotal: number | null;
  costSell: number | null;
  tags: string[];

  descriptionHtml: string | null;
  plaintext: string | null;

  // ✅ NEW: base stats derived from items.json.stats
  baseStats: Array<{ label: string; value: string }>;

  buildsFrom: BuildPathItem[];
  buildsInto: BuildPathItem[];

  games: number;
  wins: number;
  winrate: number;

  topChamps: Array<{
    champId: number;
    champName: string;
    champSlug: string;
    champIconUrl: string | null;
    games: number;
    wins: number;
    winrate: number;
  }>;
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function niceFromSlug(slug: string) {
  const s = (slug || "").trim();
  if (!s) return "LoL Item";
  return s
    .split("-")
    .filter(Boolean)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function getBlobBase(): string {
  return (
    process.env.NEXT_PUBLIC_BLOB_BASE_URL ||
    process.env.BLOB_BASE_URL ||
    process.env.NEXT_PUBLIC_BLOB_BASE ||
    ""
  );
}

async function readJsonDiskFirst<T>(publicRelPath: string): Promise<T | null> {
  const rel = publicRelPath.startsWith("/") ? publicRelPath.slice(1) : publicRelPath;
  const diskPath = `${process.cwd()}/public/${rel}`;

  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(diskPath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    // ignore
  }

  const base = getBlobBase();
  if (!base) return null;

  try {
    const url = `${base.replace(/\/+$/, "")}/${rel}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ✅ Blob-first for items_usage files (fresh stats in prod)
async function readJsonBlobFirst<T>(publicRelPath: string): Promise<T | null> {
  const rel = publicRelPath.startsWith("/") ? publicRelPath.slice(1) : publicRelPath;
  const base = getBlobBase();

  if (base) {
    try {
      const url = `${base.replace(/\/+$/, "")}/${rel}`;
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (res.ok) return (await res.json()) as T;
    } catch {
      // ignore
    }
  }

  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(`${process.cwd()}/public/${rel}`, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ✅ Reliable champ map: always use Data Dragon champion.json
async function getDDragonChampMap(
  patch: string
): Promise<Map<number, { id: string; name: string }>> {
  try {
    const res = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${patch}/data/en_US/champion.json`,
      { next: { revalidate: 60 * 60 * 24 } }
    );
    if (!res.ok) return new Map();
    const json = (await res.json()) as DDragonChampionJson;

    const map = new Map<number, { id: string; name: string }>();
    for (const c of Object.values(json.data || {})) {
      const champId = Number(c.key);
      if (!Number.isFinite(champId) || champId <= 0) continue;
      map.set(champId, { id: c.id, name: c.name });
    }
    return map;
  } catch {
    return new Map();
  }
}

function buildPathItemFromId(
  patch: string,
  itemsJson: LoLItemsJson,
  id: number
): BuildPathItem | null {
  const d = itemsJson.data?.[String(id)];
  if (!d?.name) return null;

  const iconFile = d.image?.full || `${id}.png`;
  const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${patch}/img/item/${iconFile}`;

  const costTotal =
    typeof d.gold?.total === "number" && Number.isFinite(d.gold.total) ? d.gold.total : null;

  return {
    itemId: id,
    name: d.name,
    slug: slugify(d.name),
    iconUrl,
    costTotal,
  };
}

// ✅ Base stat key → human label (covers the common ones)
// Anything unknown falls back to raw key.
const STAT_LABELS: Record<string, string> = {
  FlatHPPoolMod: "Health",
  FlatMPPoolMod: "Mana",
  FlatPhysicalDamageMod: "Attack Damage",
  FlatMagicDamageMod: "Ability Power",
  FlatArmorMod: "Armor",
  FlatSpellBlockMod: "Magic Resist",
  FlatMovementSpeedMod: "Move Speed",
  FlatAttackSpeedMod: "Attack Speed",
  PercentAttackSpeedMod: "Attack Speed",
  PercentLifeStealMod: "Life Steal",
  PercentSpellVampMod: "Omnivamp",
  FlatCritChanceMod: "Crit Chance",
  PercentCritChanceMod: "Crit Chance",
  rFlatMagicPenetrationMod: "Magic Penetration",
  rFlatArmorPenetrationMod: "Lethality",
  rPercentArmorPenetrationMod: "Armor Penetration",
  rPercentCooldownMod: "Ability Haste",
  FlatHPRegenMod: "Health Regen",
  PercentHPRegenMod: "Base Health Regen",
  FlatMPRegenMod: "Mana Regen",
  PercentMPRegenMod: "Base Mana Regen",
  rFlatGoldPer10Mod: "Gold / 10",
};

function formatStatValue(key: string, value: number): string {
  if (!Number.isFinite(value) || value === 0) return "";

  // heuristics for percent-y keys
  const isPercent =
    key.startsWith("Percent") ||
    key.includes("Percent") ||
    key.endsWith("ChanceMod") ||
    key.endsWith("SpellVampMod") ||
    key.endsWith("LifeStealMod");

  if (isPercent) {
    // values often come as 0.15 for 15%
    const pct = Math.abs(value) <= 1.5 ? value * 100 : value;
    return `${pct.toFixed(0)}%`;
  }

  // attack speed sometimes is 0.15 (15%)
  if (key.toLowerCase().includes("attackspeed") && Math.abs(value) <= 1.5) {
    return `${(value * 100).toFixed(0)}%`;
  }

  // default: number (no decimals unless needed)
  const n = Math.abs(value) < 10 && value % 1 !== 0 ? value.toFixed(2) : String(Math.round(value * 100) / 100);
  return n;
}

function extractBaseStats(stats?: Record<string, number>): Array<{ label: string; value: string }> {
  if (!stats) return [];

  const rows: Array<{ label: string; value: string }> = [];

  for (const [k, v] of Object.entries(stats)) {
    if (!Number.isFinite(v) || v === 0) continue;
    const label = STAT_LABELS[k] || k;
    const value = formatStatValue(k, v);
    if (!value) continue;
    rows.push({ label, value });
  }

  // stable-ish ordering for the common stats
  const order = [
    "Attack Damage",
    "Ability Power",
    "Attack Speed",
    "Crit Chance",
    "Life Steal",
    "Omnivamp",
    "Health",
    "Armor",
    "Magic Resist",
    "Move Speed",
    "Mana",
    "Ability Haste",
    "Health Regen",
    "Mana Regen",
    "Gold / 10",
  ];
  rows.sort((a, b) => {
    const ai = order.indexOf(a.label);
    const bi = order.indexOf(b.label);
    if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return rows;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const nice = niceFromSlug(slug);

  return {
    title: `${nice} – LoL Item Stats | GamerStation`,
    description: `Win rate, popularity, build path, and top champions for ${nice} in League of Legends.`,
  };
}

export default async function ItemSlugPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;

  const sp = (await searchParams) || {};
  const sourceRaw = typeof sp.source === "string" ? sp.source : undefined;
  const source: UsageSource =
    sourceRaw === "ranked" || sourceRaw === "casual" || sourceRaw === "combined"
      ? sourceRaw
      : "combined";

  const [itemsJson, usage] = await Promise.all([
    readJsonDiskFirst<LoLItemsJson>("/data/lol/items.json"),
    readJsonBlobFirst<ItemsUsageFile>(`/data/lol/items_usage_${source}.json`),
  ]);

  const patch = (itemsJson?.version || "unknown").trim();
  const champMap = await getDDragonChampMap(patch);

  if (!itemsJson?.data || !patch || patch === "unknown" || !slug) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-transparent text-white">
        <div className="relative px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <header className="mb-6 flex items-center">
              <Link href="/" className="flex items-center gap-2 hover:opacity-90">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/gs-logo-v2.png"
                  alt="GamerStation"
                  className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_30px_rgba(0,255,255,0.12)]"
                />
                <span className="text-lg font-black tracking-tight">
                  GamerStation<span className="align-super text-[0.6em]">™</span>
                </span>
              </Link>

              <Link
                href="/tools"
                className="ml-auto rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white"
              >
                Tools
              </Link>
            </header>

            <h1 className="text-4xl font-bold tracking-tight">LoL Item</h1>
            <p className="mt-3 text-neutral-300">This item page is temporarily unavailable.</p>
          </div>
        </div>
      </main>
    );
  }

  // Find the item by slug (based on items.json names)
  let foundItemId: number | null = null;
  let foundName: string | null = null;

  for (const [idStr, d] of Object.entries(itemsJson.data || {})) {
    const s = slugify(d?.name || "");
    if (s && s === slug) {
      foundItemId = Number(idStr);
      foundName = d?.name || null;
      break;
    }
  }

  if (!foundItemId) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-transparent text-white">
        <div className="relative px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <header className="mb-6 flex items-center">
              <Link href="/" className="flex items-center gap-2 hover:opacity-90">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/gs-logo-v2.png"
                  alt="GamerStation"
                  className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_30px_rgba(0,255,255,0.12)]"
                />
                <span className="text-lg font-black tracking-tight">
                  GamerStation<span className="align-super text-[0.6em]">™</span>
                </span>
              </Link>

              <Link
                href="/tools"
                className="ml-auto rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white"
              >
                Tools
              </Link>
            </header>

            <h1 className="text-4xl font-bold tracking-tight">Item not found</h1>
            <p className="mt-3 text-neutral-300">
              We couldn&apos;t find an item for{" "}
              <span className="font-semibold text-white">{slug}</span>.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const d = itemsJson.data[String(foundItemId)];
  const usageRow = usage?.items?.find((x) => x.itemId === foundItemId);

  const iconFile = d?.image?.full || `${foundItemId}.png`;
  const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${patch}/img/item/${iconFile}`;

  const buildsFromIds = Array.isArray(d?.from)
    ? d.from.map((x) => Number(x)).filter((n) => Number.isFinite(n))
    : [];
  const buildsIntoIds = Array.isArray(d?.into)
    ? d.into.map((x) => Number(x)).filter((n) => Number.isFinite(n))
    : [];

  const buildsFrom = buildsFromIds
    .map((id) => buildPathItemFromId(patch, itemsJson, id))
    .filter(Boolean) as BuildPathItem[];

  const buildsInto = buildsIntoIds
    .map((id) => buildPathItemFromId(patch, itemsJson, id))
    .filter(Boolean) as BuildPathItem[];

  const topChamps = (usageRow?.topChamps || []).map((c) => {
    const meta = champMap.get(c.champId);
    const champName = meta?.name || `Champion ${c.champId}`;
    const champSlug = slugify(champName);
    const champIconUrl = meta?.id
      ? `https://ddragon.leagueoflegends.com/cdn/${patch}/img/champion/${meta.id}.png`
      : null;

    return {
      champId: c.champId,
      champName,
      champSlug,
      champIconUrl,
      games: c.games,
      wins: c.wins,
      winrate: clamp01(c.winrate),
    };
  });

  const enriched: EnrichedItem = {
    patch,
    generatedAt: usage?.generatedAt || new Date().toISOString(),
    source,

    itemId: foundItemId,
    name: d?.name || foundName || `Item ${foundItemId}`,
    slug,
    iconUrl,

    costTotal: typeof d?.gold?.total === "number" ? d.gold.total! : null,
    costSell: typeof d?.gold?.sell === "number" ? d.gold.sell! : null,
    tags: Array.isArray(d?.tags) ? d.tags : [],

    descriptionHtml: typeof d?.description === "string" ? d.description : null,
    plaintext: typeof d?.plaintext === "string" ? d.plaintext : null,

    // ✅ NEW: base stats from items.json.stats
    baseStats: extractBaseStats(d?.stats),

    buildsFrom,
    buildsInto,

    games: usageRow?.games ?? 0,
    wins: usageRow?.wins ?? 0,
    winrate: clamp01(usageRow?.winrate ?? 0),

    topChamps,
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent text-white">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-1/3 -left-32 h-[520px] w-[520px] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-[-220px] right-[-220px] h-[620px] w-[620px] rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <header className="mb-6 flex items-center">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/gs-logo-v2.png"
                alt="GamerStation"
                className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_30px_rgba(0,255,255,0.12)]"
              />
              <span className="text-lg font-black tracking-tight">
                GamerStation<span className="align-super text-[0.6em]">™</span>
              </span>
            </Link>

            <Link
              href="/tools/lol/items"
              className="ml-auto rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white"
            >
              Items Index
            </Link>
          </header>

          <h1 className="text-4xl font-bold tracking-tight">LoL Item</h1>
          <p className="mt-3 text-neutral-300">
            Patch {patch} · Usage <span className="font-semibold text-white">{source}</span>
          </p>

          <div className="mt-6">
            <ItemClient item={enriched} />
          </div>
        </div>
      </div>
    </main>
  );
}
