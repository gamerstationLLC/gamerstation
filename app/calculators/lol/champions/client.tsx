// app/calculators/lol/champions/client.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type ChampionRow = {
  id: string; // "Lux" (Data Dragon id)
  name: string; // "Lux"
  title: string; // "the Lady of Luminosity"
  tags: string[];
};

function slugifyChampion(input: string) {
  return input
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ChampionPickerClient({
  champions,
}: {
  champions: ChampionRow[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return champions;

    return champions.filter((c) => {
      const hay = `${c.name} ${c.id} ${c.title} ${(c.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(query);
    });
  }, [q, champions]);

  function goToChampion(c: ChampionRow) {
    const slug = slugifyChampion(c.id);
    router.push(`/calculators/lol/champions/${slug}`);
  }

  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  const topLink =
    "inline-flex w-fit items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 hover:underline underline-offset-4";

  return (
    <section className="mt-3">
      {/* ✅ Top row: ONLY Tools (top-right) and Calculators (top-right if you add later).
          This client component doesn't own the global header, so we provide the same behavior locally:
          - Tools stays on the right
          - Any other page-specific nav goes below (left-aligned)
      */}
      

      {/* ✅ Below description zone (for this component, we place it right after the top row):
          Non-top-right nav goes left-aligned here */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href="/calculators/lol/hub" className={navBtn}>
          LoL Hub
        </Link>
      </div>

      {/* Search */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a champion (e.g., Lux, Katarina, Jinx)…"
            className="w-full rounded-2xl border border-neutral-800 bg-black/70 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-neutral-600"
          />

          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                inputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-neutral-800 bg-black/70 px-3 py-1 text-sm text-neutral-200 transition hover:border-neutral-600 hover:bg-black/90"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 text-sm text-neutral-400">
        Showing{" "}
        <span className="font-medium text-neutral-200">{filtered.length}</span>{" "}
        champion{filtered.length === 1 ? "" : "s"}
      </div>

      {/* Results */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => goToChampion(c)}
            className="group rounded-2xl border border-neutral-800 bg-black/60 p-4 text-left transition hover:border-neutral-600 hover:bg-black/75"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{c.name}</div>
                <div className="truncate text-xs text-neutral-400">{c.title}</div>

                {!!c.tags?.length && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {c.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-neutral-800 bg-black/50 px-2 py-0.5 text-[11px] text-neutral-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-sm text-neutral-500 transition group-hover:text-neutral-200">→</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
