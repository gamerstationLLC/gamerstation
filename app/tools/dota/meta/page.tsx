import Link from "next/link";
import DotaMetaClient, { HeroStatsRow } from "./client";
import { readPublicJson } from "@/lib/blob";


export const dynamic = "force-static";

// âœ… Daily full-page regeneration
export const revalidate = 60 * 60 * 24; // 24 hours

type PatchEntry = {
  name?: string;
  date?: number;
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
  }>;
};

async function getHeroStats(): Promise<HeroStatsRow[]> {
  const res = await fetch("https://api.opendota.com/api/heroStats", {
    next: { revalidate: 60 * 60 * 24 }, // daily
    headers: {
      Accept: "application/json",
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

  const sorted = [...list].sort((a, b) => {
    const ad = Number(a.date ?? 0);
    const bd = Number(b.date ?? 0);
    return bd - ad;
  });

  return (sorted[0]?.name ?? "").toString().trim() || null;
}

async function getLatestPatch(): Promise<string> {
  try {
    const res = await fetch("https://api.opendota.com/api/patches", {
      next: { revalidate: 60 * 60 * 6 }, // check patch every 6h
      headers: {
        Accept: "application/json",
        "User-Agent": "GamerStation (https://gamerstation.gg)",
      },
    });

    if (!res.ok) return "â€”";

    const data = await res.json();
    return extractLatestPatchName(data) ?? "â€”";
  } catch {
    return "â€”";
  }
}

// âœ… Blob immortal stats
async function readImmortalJson(): Promise<ImmortalJson | null> {
  try {
    return await readPublicJson<ImmortalJson>(
      "data/dota/immortal_hero_stats.json"
    );
  } catch {
    return null;
  }
}

export default async function DotaMetaPage() {
  const patch = await getLatestPatch();

  // ðŸ”¥ CRITICAL:
  // This makes cache version depend on patch
  const cacheTag = `dota-meta-${patch}`;

  const [rows, immortal] = await Promise.all([
    getHeroStats(),
    readImmortalJson(),
  ]);

  const immByHero = new Map<number, { picks: number; wins: number }>();
  const immRows = Array.isArray(immortal?.rows) ? immortal!.rows! : [];

  for (const r of immRows) {
    const id = Number(r.hero_id);
    const picks = Number(r.picks);
    const wins = Number(r.wins);

    if (Number.isFinite(id) && id > 0) {
      immByHero.set(id, {
        picks: Math.max(0, Math.trunc(picks)),
        wins: Math.max(0, Math.trunc(wins)),
      });
    }
  }

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

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent text-white">
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
                GamerStation
                <span className="align-super text-[0.6em]">TM</span>
              </span>
            </Link>

            <Link
              href="/tools"
              className="ml-auto rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white"
            >
              Tools
            </Link>
          </header>

          <h1 className="text-4xl font-bold tracking-tight">
            Dota 2 Meta
          </h1>

          <p className="mt-3 text-neutral-300">
            Highest pick rate + best win rate by rank bracket, plus pro trends.
            Data from OpenDota.
            <span className="text-neutral-500">
              {" "}
              (Daily refresh â€¢ Auto resets on patch change)
            </span>
          </p>

          <div className="mt-6">
            <DotaMetaClient
              key={cacheTag} // ðŸ”¥ forces reset when patch changes
              initialRows={mergedRows}
              patch={patch}
            />
          </div>

        </div>
      </div>
    </main>
  );
}
