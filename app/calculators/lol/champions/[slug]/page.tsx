// app/calculators/lol/champions/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import fs from "node:fs/promises";
import path from "node:path";

import StatsClient, { type ChampionBaseStats } from "./StatsClient";

type ChampionRow = {
  id: string; // Data Dragon champion id (e.g. "Aatrox")
  name: string;
  title?: string;
  stats?: Record<string, number>;
};

type ChampionsFullFile = {
  version?: string;
  champions?: ChampionRow[];
};

async function readChampionsFull(): Promise<ChampionsFullFile> {
  const p = path.join(process.cwd(), "public", "data", "lol", "champions_full.json");
  const raw = await fs.readFile(p, "utf-8");
  return JSON.parse(raw) as ChampionsFullFile;
}

async function readPatchFallback(): Promise<string | undefined> {
  try {
    const p = path.join(process.cwd(), "public", "data", "lol", "version.json");
    const raw = await fs.readFile(p, "utf-8");
    const json = JSON.parse(raw) as { version?: string };
    return json.version;
  } catch {
    return undefined;
  }
}

function normalizeSlug(s: string) {
  return s.trim().toLowerCase();
}

function findChampionBySlug(champions: ChampionRow[], slug: string): ChampionRow | null {
  const wanted = normalizeSlug(slug);

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

/**
 * ✅ Dynamic metadata per champion page (SEO)
 * Example: /calculators/lol/champions/aatrox
 */
export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  let file: ChampionsFullFile | null = null;
  try {
    file = await readChampionsFull();
  } catch {}

  const champions = file?.champions ?? [];
  const champ = findChampionBySlug(champions, params.slug);

  const patch = file?.version ?? (await readPatchFallback()) ?? "latest";
  const safeName = champ?.name ?? params.slug;
  const safeTitle = champ?.title ? ` — ${champ.title}` : "";

  const title = `${safeName}${safeTitle} Stats by Level (Patch ${patch}) | GamerStation`;
  const description =
    `View ${safeName} base stats and per-level scaling for HP, armor, MR, AD, and attack speed. ` +
    `Patch ${patch}. Not affiliated with or endorsed by Riot Games.`;

  const canonical = `/calculators/lol/champions/${normalizeSlug(params.slug)}`;

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
 * ✅ Prebuild all champion slug pages from champions_full.json
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

export const revalidate = 60 * 60 * 6; // 6 hours

export default async function LolChampionPage(
  { params }: { params: { slug: string } }
) {
  const file = await readChampionsFull().catch(() => null);
  const champions = file?.champions ?? [];
  const champ = findChampionBySlug(champions, params.slug);

  if (!champ) return notFound();

  const patch = file?.version ?? (await readPatchFallback()) ?? "latest";

  const championId = champ.id; // "Aatrox"
  const championName = champ.name; // "Aatrox"
  const stats = toBaseStats(champ.stats);
  const calcHref = `/calculators/lol?champion=${encodeURIComponent(championId)}`;

  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <StatsClient
          championId={championId}
          championName={championName}
          patch={patch}
          calcHref={calcHref}
          stats={stats}
          defaultLevel={1}
        />
      </div>
    </main>
  );
}
