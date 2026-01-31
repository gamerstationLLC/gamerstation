// app/tools/dota/meta/page.tsx
import Link from "next/link";
import DotaMetaClient, { HeroStatsRow } from "./client";

export const metadata = {
  title: "Dota 2 Meta | GamerStation",
  description:
    "Dota 2 meta heroes by rank bracket and pro trends. Pick rate + win rate with frequent updates. Data via OpenDota.",
};

type PatchEntry = {
  name?: string; // e.g. "7.40"
  patch?: string; // sometimes present
  id?: number | string;
  date?: number; // unix seconds (common)
  timestamp?: number; // fallback
  [key: string]: any;
};

async function getHeroStats(): Promise<HeroStatsRow[]> {
  const res = await fetch("https://api.opendota.com/api/heroStats", {
    next: { revalidate: 300 }, // ~5 minutes
  });
  if (!res.ok) return [];
  return res.json();
}

function extractLatestPatchName(data: any): string | null {
  // OpenDota constants/patch sometimes returns an array, sometimes an object.
  const list: PatchEntry[] = Array.isArray(data)
    ? data
    : data && typeof data === "object"
    ? Object.values(data)
    : [];

  if (!list.length) return null;

  // Sort by most recent date-ish field
  const sorted = [...list].sort((a, b) => {
    const ad = Number(a.date ?? a.timestamp ?? 0);
    const bd = Number(b.date ?? b.timestamp ?? 0);
    return bd - ad;
  });

  const top = sorted[0] ?? {};
  const name = (top.name || top.patch || "").toString().trim();
  return name || null;
}

async function getLatestPatch(): Promise<string> {
  try {
    const res = await fetch("https://api.opendota.com/api/constants/patch", {
      next: { revalidate: 300 }, // keep in sync with the rest
    });
    if (!res.ok) return "—";
    const data = await res.json();
    return extractLatestPatchName(data) ?? "—";
  } catch {
    return "—";
  }
}

export default async function DotaMetaPage() {
  const [rows, patch] = await Promise.all([getHeroStats(), getLatestPatch()]);

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
          <header className="mb-6 flex items-center">
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

            <Link
              href="/tools"
              className="ml-auto rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]"
            >
              Tools
            </Link>
          </header>

          <h1 className="text-4xl font-bold tracking-tight">Dota 2 Meta</h1>
          <p className="mt-3 text-neutral-300">
            Highest pick rate + best win rate by rank bracket, plus pro trends. Data from OpenDota.
            <span className="text-neutral-500"> (Cached ~5 minutes)</span>
          </p>

          <div className="mt-6">
            <DotaMetaClient initialRows={rows} patch={patch} cacheLabel="~5 min" />
          </div>
        </div>
      </div>
    </main>
  );
}
