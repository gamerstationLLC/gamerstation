// app/calculators/lol/ap-ad/page.tsx
import Link from "next/link";
import { Suspense } from "react";
import ApAdClient, { type ChampionRow } from "./client";
import { blobUrl } from "@/lib/blob-client";

export type ItemRow = Record<string, any>;
export type SpellsOverrides = Record<string, any>;

/**
 * Keeping this page dynamic prevents build-time failures if data is temporarily missing
 * and avoids Next trying to prerender client-side search param usage.
 */
export const dynamic = "force-dynamic";

/**
 * Fetch JSON from either:
 * - Vercel Blob (when NEXT_PUBLIC_BLOB_BASE_URL is set)
 * - Local /public fallback (when it is not set)
 *
 * IMPORTANT:
 * This avoids fs/path and fixes Next file tracing issues entirely.
 */
async function fetchJson<T>(pathname: string): Promise<T | null> {
  try {
    const url = blobUrl(pathname); // returns "/data/..." locally or "https://.../data/..." in prod
    const res = await fetch(url, {
      // keep it fresh-ish; Blob CDN cache is controlled by upload script cacheControlMaxAge
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function normalizeChampionRows(data: any): ChampionRow[] {
  if (Array.isArray(data)) return data as ChampionRow[];
  if (data?.data && typeof data.data === "object") return Object.values(data.data) as ChampionRow[];
  if (Array.isArray(data?.champions)) return data.champions as ChampionRow[];
  return [];
}

function normalizeItemRows(data: any): ItemRow[] {
  if (Array.isArray(data)) return data as ItemRow[];
  if (data?.data && typeof data.data === "object") return Object.values(data.data) as ItemRow[];
  if (Array.isArray(data?.items)) return data.items as ItemRow[];
  return [];
}

async function loadPatch(): Promise<string> {
  // Your project has used a few different names historically — try them safely.
  const v =
    (await fetchJson<any>("data/lol/versions.json")) ??
    (await fetchJson<any>("data/lol/version.json")) ??
    null;

  if (Array.isArray(v) && v[0]) return String(v[0]);
  if (typeof v === "string") return v;
  if (v?.patch) return String(v.patch);
  if (v?.version) return String(v.version);

  return "latest";
}

export default async function Page() {
  const patch = await loadPatch();

  // Champions (try common filenames)
  const championsRaw =
    (await fetchJson<any>("data/lol/champions_index.json")) ??
    (await fetchJson<any>("data/lol/champions.json")) ??
    (await fetchJson<any>("data/lol/champions_full.json")) ??
    (await fetchJson<any>("data/lol/ddragon/championFull.json")) ??
    (await fetchJson<any>("data/lol/ddragon/champion.json")) ??
    null;

  const champions = normalizeChampionRows(championsRaw);

  // Items (try common filenames)
  const itemsRaw =
    (await fetchJson<any>("data/lol/items.json")) ??
    (await fetchJson<any>("data/lol/items_index.json")) ??
    (await fetchJson<any>("data/lol/items_full.json")) ??
    (await fetchJson<any>("data/lol/item.json")) ??
    (await fetchJson<any>("data/lol/ddragon/item.json")) ??
    (await fetchJson<any>("data/lol/ddragon/items.json")) ??
    null;

  const items = normalizeItemRows(itemsRaw);

  // Spell overrides (numeric truth for spell damage)
  const overrides =
    (await fetchJson<SpellsOverrides>("data/lol/spells_overrides.json")) ??
    (await fetchJson<SpellsOverrides>("data/lol/overrides/spells_overrides.json")) ??
    {};

  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  return (
    <main className="relative min-h-screen text-white">
      {/* Hub-style black background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_30%_20%,rgba(255,255,255,0.06),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_70%_10%,rgba(255,255,255,0.04),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_50%_60%,transparent_40%,rgba(0,0,0,0.8))]" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* ✅ Standard GS header: brand left + Calculators pill top-right */}
        <header className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90">
            <img
              src="/gs-logo-v2.png"
              alt="GamerStation"
              className="
                h-10 w-10 rounded-xl bg-black p-1
                shadow-[0_0_30px_rgba(0,255,255,0.35)]
              "
            />
            <span className="text-lg font-black tracking-tight">
              GamerStation<span className="align-super text-[0.6em]">™</span>
            </span>
          </Link>

          <div className="ml-auto">
            <Link href="/calculators/lol/hub" className={navBtn}>
              LoL Hub
            </Link>
          </div>
        </header>

        <h1 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight">
          League of Legends AP / AD Stat Impact
        </h1>

        <p className="mt-2 text-sm text-neutral-400 italic">
          Not affiliated with, endorsed by, or sponsored by Riot Games.
        </p>

        <p className="mt-3 max-w-3xl text-neutral-300">
          See exactly how much{" "}
          <span className="font-semibold text-white">+10 Ability Power</span> or{" "}
          <span className="font-semibold text-white">+10 Attack Damage</span> changes your{" "}
          <span className="font-semibold text-white">real damage after Armor &amp; Magic Resist</span>.
          Perfect for item decisions, build optimization, and breakpoint checks.
        </p>

        <div className="mt-10">
          <Suspense
            fallback={
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-sm text-neutral-300">
                Loading calculator…
              </div>
            }
          >
            <ApAdClient champions={champions} patch={patch} items={items} overrides={overrides} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
