// app/tools/dota/heroes/client.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type HeroCard = {
  id: number;
  name: string;
  slug: string;
  icon: string;
};

export default function DotaHeroesClient({
  heroes,
  initialQuery,
}: {
  heroes: HeroCard[];
  initialQuery: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [q, setQ] = useState(initialQuery ?? "");

  // live filtered list
  const filtered = useMemo(() => {
    const s = (q ?? "").trim().toLowerCase();
    if (!s) return heroes;
    return heroes.filter((h) => h.name.toLowerCase().includes(s));
  }, [heroes, q]);

  function syncUrl(nextQ: string) {
    const trimmed = nextQ.trim();
    if (!trimmed) {
      router.replace(pathname, { scroll: false });
      return;
    }
    const params = new URLSearchParams();
    params.set("q", trimmed);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="mt-8">
      {/* Search */}
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full items-center gap-2">
          <input
            value={q}
            onChange={(e) => {
              const next = e.target.value;
              setQ(next);
              syncUrl(next);
            }}
            placeholder="Search heroes…"
            className="h-10 w-full rounded-xl border border-neutral-800 bg-black/70 px-3 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-neutral-600 focus:shadow-[0_0_25px_rgba(0,255,255,0.18)] sm:w-[320px]"
          />

          {q.trim() ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                syncUrl("");
              }}
              className="h-10 shrink-0 rounded-xl border border-neutral-800 bg-black px-3 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white"
              title="Clear search"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="text-xs text-neutral-500 sm:text-right">
          {q.trim() ? (
            <>
              Showing <span className="text-neutral-200">{filtered.length}</span> results
            </>
          ) : (
            <>Tip: start typing to filter</>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((h) => (
          <Link
            key={h.id}
            href={`/tools/dota/heroes/${h.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-black/60 p-4 transition hover:border-neutral-600 hover:bg-black/75"
          >
            {h.icon ? (
              <img
                src={h.icon}
                alt=""
                className="h-9 w-9 rounded-xl border border-neutral-800 bg-black/40"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-9 w-9 rounded-xl border border-neutral-800 bg-black/40" />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-neutral-100">{h.name}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Empty state */}
      {q.trim() && filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-neutral-800 bg-black/60 p-6 text-sm text-neutral-300">
          No heroes found for <span className="text-white">“{q.trim()}”</span>.
          <div className="mt-2 text-xs text-neutral-500">
            Try a shorter name (e.g., “void”, “spirit”, “zeu”).
          </div>
        </div>
      ) : null}
    </div>
  );
}
