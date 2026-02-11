// app/tools/dota/heroes/page.tsx
import Link from "next/link";
import DotaHeroesClient from "./client";

export const metadata = {
  title: "Dota 2 Heroes | GamerStation",
  description:
    "Browse every Dota 2 hero with live meta context, pick rate, win rate, and pro trends. Data via OpenDota, updated frequently.",
};

// âœ… Daily full-page regeneration
export const revalidate = 86400; // 24 hours
export const dynamic = "force-static";




type HeroStatsRow = {
  id: number;
  name?: string;
  localized_name?: string;
  img?: string;
  icon?: string;
  pro_pick?: number;
  pro_win?: number;
  pro_ban?: number;
  [key: string]: any;
};

export type HeroCard = {
  id: number;
  name: string;
  slug: string;
  icon: string;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function iconUrl(r: HeroStatsRow) {
  const rel = (r.icon || r.img || "").toString();
  if (!rel) return "";
  return `https://cdn.cloudflare.steamstatic.com${rel}`;
}

async function getHeroStats(): Promise<HeroStatsRow[]> {
  const res = await fetch("https://api.opendota.com/api/heroStats", {
    next: { revalidate: 60 * 60 * 24 }, // âœ… daily
    headers: {
      Accept: "application/json",
      "User-Agent": "GamerStation (https://gamerstation.gg)",
    },
  });
  if (!res.ok) return [];
  return res.json();
}

// âœ… Patch check: more frequent than the hero list (so patch flips invalidate the page sooner)
async function getPatchFromSelf(): Promise<string> {
  try {
    const base =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL
        ? process.env.VERCEL_URL.startsWith("http")
          ? process.env.VERCEL_URL
          : `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    const res = await fetch(`${base}/api/dota/patch`, {
      next: { revalidate: 60 * 60 * 6 }, // âœ… every 6 hours
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return "â€”";
    const json = await res.json().catch(() => null);
    const patch = (json?.patch ?? "").toString().trim();
    return patch || "â€”";
  } catch {
    return "â€”";
  }
}

export default async function DotaHeroesIndexPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const [rows, patch] = await Promise.all([getHeroStats(), getPatchFromSelf()]);

  // ðŸ”¥ Cache bucket tied to patch â€” when patch changes, this page regenerates fresh
  const cacheTag = `dota-heroes-${patch}`;

  const heroes: HeroCard[] = rows
    .map((r) => {
      const name = (r.localized_name || r.name || `Hero ${r.id}`).toString();
      return {
        id: r.id,
        name,
        slug: slugify(name),
        icon: iconUrl(r),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const initialQuery = (searchParams?.q ?? "").toString();

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
                GamerStation<span className="align-super text-[0.6em]">TM</span>
              </span>
            </Link>

            <Link
              href="/tools"
              className="ml-auto rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]"
            >
              Tools
            </Link>
          </header>

          <h1 className="text-4xl font-bold tracking-tight">Dota 2 Heroes</h1>

          <p className="mt-3 text-neutral-300">
            Browse every Dota 2 hero with quick links to hero pages and meta context. Powered by OpenDota match data and
            refreshed often.
            <span className="text-neutral-500">
              {" "}
              (Daily refresh â€¢ Auto resets on patch change)
            </span>
          </p>

          {/* âœ… Client remounts when patch changes */}
          <DotaHeroesClient
            key={cacheTag}
            heroes={heroes}
            initialQuery={initialQuery}
            patch={patch}
            cacheLabel="Daily"
          />
        </div>
      </div>
    </main>
  );
}
