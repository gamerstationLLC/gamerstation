// app/calculators/lol/champions/page.tsx
import type { Metadata } from "next";
import ChampionPickerClient, { type ChampionRow } from "./client";

export const metadata: Metadata = {
  title: "LoL Champions – Search Champion Stats | GamerStation",
  description:
    "Search League of Legends champions and open a champion stats page instantly. Data from Riot Data Dragon.",
  alternates: { canonical: "/calculators/lol/champions" },
};

const DD_BASE = "https://ddragon.leagueoflegends.com";
const LOCALE = "en_US";

async function getLatestPatch(): Promise<string> {
  const res = await fetch(`${DD_BASE}/api/versions.json`, {
    next: { revalidate: 60 * 60 },
  });
  if (!res.ok) throw new Error(`versions.json failed: ${res.status}`);
  const versions = (await res.json()) as string[];
  if (!Array.isArray(versions) || !versions[0]) throw new Error("No versions found");
  return versions[0];
}

type ChampionIndexJson = {
  data: Record<
    string,
    {
      id: string; // "Lux"
      key: string; // "99"
      name: string; // "Lux"
      title: string;
      tags: string[];
      image: { full: string };
    }
  >;
  version: string;
};

async function getChampionIndex(version: string): Promise<ChampionRow[]> {
  const res = await fetch(`${DD_BASE}/cdn/${version}/data/${LOCALE}/champion.json`, {
    next: { revalidate: 60 * 60 },
  });
  if (!res.ok) throw new Error(`champion.json failed: ${res.status}`);

  const json = (await res.json()) as ChampionIndexJson;

  const rows: ChampionRow[] = Object.values(json.data).map((c) => ({
    id: c.id,
    name: c.name,
    title: c.title,
    tags: c.tags ?? [],
    icon: `${DD_BASE}/cdn/${version}/img/champion/${c.id}.png`,
  }));

  // nice default ordering
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

export default async function ChampionsPickerPage() {
  const patch = await getLatestPatch();
  const champions = await getChampionIndex(patch);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-white">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">LoL Champion Index</h1>
        <p className="mt-1 text-sm opacity-80">
          Search a champion to open their stats page. Patch:{" "}
          <span className="font-medium">{patch}</span>
        </p>
      </div>

      <ChampionPickerClient champions={champions} />
    </main>
  );
}
