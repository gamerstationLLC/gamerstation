// app/calculators/lol/champions/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
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
  }));

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

export default async function ChampionsPickerPage() {
  const patch = await getLatestPatch();
  const champions = await getChampionIndex(patch);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
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
        <div className="absolute top-1/3 -left-32 h-[420px] w-[420px] rounded-full bg-white/8 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-[520px] w-[520px] rounded-full bg-white/8 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black" />
      </div>

      <div className="relative px-6 py-16">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <header className="mb-8 flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90">
              <img
                src="/gs-logo-v2.png"
                alt="GamerStation"
                className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_30px_rgba(0,255,255,0.12)]"
              />
              <span className="text-lg font-black tracking-tight">
                GamerStation<span className="align-super text-[0.6em]">™</span>
              </span>
            </Link>

            
          </header>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            LoL Champion Index
          </h1>
          <p className="mt-3 text-neutral-300">
            Search a champion to open their stats page. Patch:{" "}
            <span className="font-medium text-white">{patch}</span>
          </p>

          <div className="mt-10">
            <ChampionPickerClient champions={champions} />
          </div>
        </div>
      </div>
    </main>
  );
}
