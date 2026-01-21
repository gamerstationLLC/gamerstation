// app/calculators/lol/champions/client.tsx
"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type ChampionRow = {
  id: string; // "Lux" (Data Dragon id)
  name: string; // "Lux"
  title: string; // "the Lady of Luminosity"
  tags: string[];
  // icon intentionally omitted
};

function slugifyChampion(input: string) {
  return input
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ChampionPickerClient({ champions }: { champions: ChampionRow[] }) {
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

  return (
    <section className="space-y-4">
      {/* Left-aligned back link */}
      <div className="flex items-center justify-between">
        <Link
          href="/calculators/lol/hub"
          className="inline-flex items-center gap-2 text-sm text-neutral-300 hover:text-white hover:underline"
        >
          <span aria-hidden>←</span> Back to Hub
        </Link>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a champion (e.g., Lux, Katarina, Jinx)…"
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 outline-none placeholder:text-white/40 focus:border-white/25"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                inputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-white/15 bg-white/5 px-3 py-1 text-sm hover:bg-white/10"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="text-sm opacity-80">
        Showing <span className="font-medium">{filtered.length}</span> champion
        {filtered.length === 1 ? "" : "s"}
      </div>

      {/* Results (no images) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => goToChampion(c)}
            className="group rounded-2xl border border-white/15 bg-white/5 p-3 text-left hover:bg-white/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{c.name}</div>
                <div className="truncate text-xs opacity-70">{c.title}</div>

                {!!c.tags?.length && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] opacity-80"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-sm opacity-60 group-hover:opacity-90">→</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
