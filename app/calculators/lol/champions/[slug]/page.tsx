// app/calculators/lol/champions/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import StatsClient, { type ChampionBaseStats } from "./StatsClient";

const DD_BASE = "https://ddragon.leagueoflegends.com";
const LOCALE = "en_US";

// ✅ CHANGE THIS to your actual LoL calculator route
const LOL_CALC_PATH = "/calculators/lol";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type ChampionIndexJson = {
  version: string;
  data: Record<
    string,
    {
      id: string;
      name: string;
      title: string;
      tags: string[];
    }
  >;
};

type ChampionFullJson = {
  version: string;
  data: Record<
    string,
    {
      id: string;
      name: string;
      title: string;
      tags: string[];
      lore: string;
      stats: ChampionBaseStats;
    }
  >;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getLatestPatch(): Promise<string> {
  const res = await fetch(`${DD_BASE}/api/versions.json`, { next: { revalidate: 60 * 60 } });
  if (!res.ok) throw new Error(`versions.json failed: ${res.status}`);
  const versions = (await res.json()) as string[];
  if (!Array.isArray(versions) || !versions[0]) throw new Error("No versions found");
  return versions[0];
}

async function getChampionIndex(version: string): Promise<ChampionIndexJson> {
  const res = await fetch(`${DD_BASE}/cdn/${version}/data/${LOCALE}/champion.json`, {
    next: { revalidate: 60 * 60 },
  });
  if (!res.ok) throw new Error(`champion.json failed: ${res.status}`);
  return (await res.json()) as ChampionIndexJson;
}

async function resolveChampionIdFromSlug(version: string, slug: string) {
  const idx = await getChampionIndex(version);
  const target = slugify(slug);

  for (const champ of Object.values(idx.data)) {
    if (slugify(champ.id) === target) return champ.id;
  }
  for (const champ of Object.values(idx.data)) {
    if (slugify(champ.name) === target) return champ.id;
  }
  const noDash = target.replace(/-/g, "");
  for (const champ of Object.values(idx.data)) {
    if (slugify(champ.id).replace(/-/g, "") === noDash) return champ.id;
  }

  return null;
}

async function getChampionFull(version: string, championId: string): Promise<ChampionFullJson> {
  const res = await fetch(
    `${DD_BASE}/cdn/${version}/data/${LOCALE}/champion/${championId}.json`,
    { next: { revalidate: 60 * 60 } }
  );
  if (!res.ok) throw new Error(`champion/${championId}.json failed: ${res.status}`);
  return (await res.json()) as ChampionFullJson;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const version = await getLatestPatch();
  const champId = await resolveChampionIdFromSlug(version, slug);

  return {
    title: champId
      ? `${champId} Stats by Level (Patch ${version}) | GamerStation`
      : "Champion not found | GamerStation",
    description: champId
      ? `View ${champId} base stats and scaling from level 1–18. Open the LoL damage calculator with ${champId} pre-selected.`
      : "Champion not found.",
    alternates: { canonical: `/calculators/lol/champions/${slug}` },
  };
}

export default async function ChampionSlugPage({ params }: PageProps) {
  const { slug } = await params;

  const patch = await getLatestPatch();
  const championId = await resolveChampionIdFromSlug(patch, slug);
  if (!championId) return notFound();

  const full = await getChampionFull(patch, championId);
  const champ = full.data[championId];
  if (!champ) return notFound();

  const calcHref = `${LOL_CALC_PATH}?champion=${encodeURIComponent(championId)}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-white">
      {/* Minimal title (no images) */}
      <h1 className="text-2xl font-semibold">
        {champ.name} <span className="opacity-70">— {champ.title}</span>
      </h1>

      {/* Put navigation + CTA + slider inside the client (as you wanted) */}
      <StatsClient
        championId={championId}
        championName={champ.name}
        patch={patch}
        calcHref={calcHref}
        stats={champ.stats}
        defaultLevel={1}
      />

      {/* Base + Growth reference stays server-rendered */}
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <div className="text-sm font-semibold">Base + Growth Reference</div>
        <div className="mt-1 text-xs text-neutral-400">
          Level 1 values and per-level growth.
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <KeyVal label="HP" value={`${champ.stats.hp} (+${champ.stats.hpperlevel}/lvl)`} />
          <KeyVal label="Mana/Energy" value={`${champ.stats.mp} (+${champ.stats.mpperlevel}/lvl)`} />
          <KeyVal label="HP Regen" value={`${champ.stats.hpregen} (+${champ.stats.hpregenperlevel}/lvl)`} />
          <KeyVal label="Mana Regen" value={`${champ.stats.mpregen} (+${champ.stats.mpregenperlevel}/lvl)`} />
          <KeyVal label="Armor" value={`${champ.stats.armor} (+${champ.stats.armorperlevel}/lvl)`} />
          <KeyVal label="MR" value={`${champ.stats.spellblock} (+${champ.stats.spellblockperlevel}/lvl)`} />
          <KeyVal label="AD" value={`${champ.stats.attackdamage} (+${champ.stats.attackdamageperlevel}/lvl)`} />
          <KeyVal label="Attack Speed" value={`${champ.stats.attackspeed} (+${champ.stats.attackspeedperlevel}%/lvl)`} />
          <KeyVal label="Move Speed" value={`${champ.stats.movespeed}`} />
          <KeyVal label="Range" value={`${champ.stats.attackrange}`} />
        </div>
      </section>

      <footer className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-neutral-500">
        Stats sourced from Riot Data Dragon. GamerStation is not affiliated with Riot Games.
      </footer>
    </main>
  );
}

function KeyVal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
      <div className="text-[11px] text-neutral-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-100">{value}</div>
    </div>
  );
}
