// app/tools/dota/meta/page.tsx
import Link from "next/link";
import fs from "node:fs/promises";
import path from "node:path";
import DotaMetaClient, { HeroStatsRow } from "./client";

export const metadata = {
  title: "Dota 2 Meta | GamerStation",
  description:
    "Dota 2 meta heroes by rank bracket and pro trends. Pick rate + win rate with frequent updates. Data via OpenDota.",
};

// ✅ IMPORTANT: don’t let this run in Edge + don’t bake a bad fetch into static HTML
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchEntry = {
  name?: string; // e.g. "7.40"
  date?: number; // unix seconds
  [key: string]: any;
};

type ImmortalJson = {
  generated_at?: string;
  window_days?: number;
  min_rank_tier?: number;
  rows?: Array<{
    hero_id: number;
    picks: number;
    wins: number;
    winrate?: number;
  }>;
};

async function getHeroStats(): Promise<HeroStatsRow[]> {
  const res = await fetch("https://api.opendota.com/api/heroStats", {
    next: { revalidate: 300 },
    headers: {
      Accept: "application/json",
      // Some CDNs behave better with an explicit UA
      "User-Agent": "GamerStation (https://gamerstation.gg)",
    },
  });
  if (!res.ok) return [];
  return res.json();
}

function extractLatestPatchName(data: any): string | null {
  const list: PatchEntry[] = Array.isArray(data)
    ? data
    : data && typeof data === "object"
    ? Object.values(data)
    : [];

  if (!list.length) return null;

  // safest: sort by date desc in case ordering changes
  const sorted = [...list].sort((a, b) => {
    const ad = Number(a.date ?? 0);
    const bd = Number(b.date ?? 0);
    return bd - ad;
  });

  const name = (sorted[0]?.name ?? "").toString().trim();
  return name || null;
}

async function getLatestPatch(): Promise<string> {
  try {
    const res = await fetch("https://api.opendota.com/api/patches", {
      next: { revalidate: 300 },
      headers: {
        Accept: "application/json",
        "User-Agent": "GamerStation (https://gamerstation.gg)",
      },
    });

    if (!res.ok) return "—";

    const data = await res.json();
    return extractLatestPatchName(data) ?? "—";
  } catch {
    return "—";
  }
}

async function readImmortalJson(): Promise<ImmortalJson | null> {
  try {
    const abs = path.join(process.cwd(), "public", "data", "dota", "immortal_hero_stats.json");
    const raw = await fs.readFile(abs, "utf-8");
    return JSON.parse(raw) as ImmortalJson;
  } catch {
    return null;
  }
}

export default async function DotaMetaPage() {
  const [rows, patch, immortal] = await Promise.all([getHeroStats(), getLatestPatch(), readImmortalJson()]);

  // Build map hero_id -> { picks, wins }
  const immByHero = new Map<number, { picks: number; wins: number }>();
  const immRows = Array.isArray(immortal?.rows) ? immortal!.rows! : [];
  for (const r of immRows) {
    const id = Number(r.hero_id);
    const picks = Number(r.picks);
    const wins = Number(r.wins);
    if (Number.isFinite(id) && id > 0 && Number.isFinite(picks) && Number.isFinite(wins)) {
      immByHero.set(id, {
        picks: Math.max(0, Math.trunc(picks)),
        wins: Math.max(0, Math.trunc(wins)),
      });
    }
  }

  // Inject Immortal bucket into the shape the client expects: 8_pick / 8_win
  const mergedRows: HeroStatsRow[] = (rows || []).map((h) => {
    const id = Number(h.id);
    const imm = immByHero.get(id);
    if (!imm) return h;

    return {
      ...h,
      ["8_pick"]: imm.picks,
      ["8_win"]: imm.wins,
    } as HeroStatsRow;
  });

  // Optional: nicer label; if you want to keep "~5 min" hardcoded, you can.
  const cacheLabel =
    immortal?.generated_at
      ? `Immortal updated ${new Date(immortal.generated_at).toLocaleString()}`
      : "~5 min";

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
            <DotaMetaClient initialRows={mergedRows} patch={patch} cacheLabel={cacheLabel} />
          </div>
        </div>
      </div>
    </main>
  );
}
