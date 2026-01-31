// app/tools/dota/heroes/client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { HeroCard } from "./page";

type Props = {
  heroes: HeroCard[];
  initialQuery: string;

  // optional props (server can pass initial values)
  patch?: string;
  cacheLabel?: string;
};

// ✅ Fetch patch from your OWN API route (no CORS, consistent, cached by your route)
async function fetchLatestPatchClient(): Promise<string | null> {
  try {
    const res = await fetch("/api/dota/patch", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const name = (json?.patch ?? "").toString().trim();
    return name && name !== "—" ? name : null;
  } catch {
    return null;
  }
}

export default function DotaHeroesClient({
  heroes,
  initialQuery,
  patch = "—",
  cacheLabel = "~5 min",
}: Props) {
  const [q, setQ] = useState(initialQuery ?? "");

  // ✅ live patch (starts from server prop, then refreshes client-side)
  const [patchLive, setPatchLive] = useState<string>(patch || "—");

  // keep in sync during dev/HMR
  useEffect(() => {
    setPatchLive(patch || "—");
  }, [patch]);

  // refresh patch on mount + every ~5 minutes
  useEffect(() => {
    let alive = true;

    async function refresh() {
      const latest = await fetchLatestPatchClient();
      if (!alive) return;
      if (latest) setPatchLive(latest);
    }

    refresh();
    const id = window.setInterval(refresh, 5 * 60 * 1000);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const filtered = useMemo(() => {
    const query = (q || "").trim().toLowerCase();
    if (!query) return heroes;
    return heroes.filter((h) => h.name.toLowerCase().includes(query));
  }, [q, heroes]);

  return (
    <section className="mt-8">
      {/* Search row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <label className="sr-only" htmlFor="hero-search">
            Search heroes
          </label>
          <input
            id="hero-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search heroes…"
            className="w-full rounded-2xl border border-neutral-800 bg-black/60 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-neutral-600 focus:ring-2 focus:ring-white/10"
          />

          <div className="mt-2 text-xs text-neutral-500">
            Showing <span className="text-neutral-300">{filtered.length}</span> of{" "}
            <span className="text-neutral-300">{heroes.length}</span>
            {" • "}
            Patch <span className="text-neutral-300">{patchLive}</span>
            {" • "}
            Cache <span className="text-neutral-300">{cacheLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQ("")}
            className="rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.25)]"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {filtered.map((h) => (
          <Link
            key={h.id}
            href={`/tools/dota/heroes/${h.slug}`}
            className="group flex items-center gap-3 rounded-2xl border border-neutral-800 bg-black/40 p-3 transition hover:border-neutral-600 hover:bg-black/55 hover:shadow-[0_0_28px_rgba(0,255,255,0.18)]"
          >
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-neutral-800 bg-black">
              {h.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={h.icon}
                  alt={h.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                  —
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white group-hover:text-white">
                {h.name}
              </div>
              <div className="truncate text-xs text-neutral-500">/{h.slug}</div>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-neutral-800 bg-black/40 p-6 text-sm text-neutral-300">
          No heroes match <span className="font-semibold text-white">{q}</span>. Try a different
          search.
        </div>
      ) : null}
    </section>
  );
}
