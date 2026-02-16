// app/tools/lol/items/client.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { EnrichedItemRow } from "./page";

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function fmtPct(x: number) {
  return `${(clamp01(x) * 100).toFixed(1)}%`;
}

function fmt(n: number) {
  return n.toLocaleString();
}

type Props = {
  patch: string;
  items: EnrichedItemRow[];
  generatedAt: string;
  source: string;
  totalItems: number;
};

const TAG_PRESETS: Array<{ label: string; value: string }> = [
  { label: "AD", value: "Damage" },
  { label: "AP", value: "SpellDamage" },
  { label: "Tank", value: "Health" },
  { label: "Armor", value: "Armor" },
  { label: "MR", value: "SpellBlock" },
  { label: "AS", value: "AttackSpeed" },
  { label: "Crit", value: "CriticalStrike" },
  { label: "Lethality", value: "ArmorPenetration" },
  { label: "Support", value: "GoldPer" },
  { label: "Boots", value: "Boots" },
];

export default function ItemsIndexClient({ items, totalItems, source, generatedAt }: Props) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string>("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      const matchesQ =
        !needle ||
        it.name.toLowerCase().includes(needle) ||
        String(it.itemId).includes(needle) ||
        it.tags.some((t) => t.toLowerCase().includes(needle));

      const matchesTag = !tag || it.tags.includes(tag);

      return matchesQ && matchesTag;
    });
  }, [items, q, tag]);

  return (
    <div className="w-full">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        

        <div className="flex w-full flex-col gap-2 md:w-[520px]">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search items (e.g., Infinity Edge, 3031, Crit, Boots)..."
              className="w-full rounded-2xl border border-neutral-800 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-neutral-500 shadow-sm outline-none backdrop-blur focus:border-neutral-600"
            />
            {q ? (
              <button
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-neutral-800 bg-black px-2 py-1 text-xs text-neutral-200 hover:border-neutral-600 hover:text-white"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTag("")}
              className={`rounded-full border px-3 py-1 text-xs ${
                !tag
                  ? "border-neutral-600 bg-white/10 text-white"
                  : "border-neutral-800 bg-black/40 text-neutral-200 hover:border-neutral-600 hover:text-white"
              }`}
            >
              All
            </button>

            {TAG_PRESETS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTag((prev) => (prev === t.value ? "" : t.value))}
                className={`rounded-full border px-3 py-1 text-xs ${
                  tag === t.value
                    ? "border-neutral-600 bg-white/10 text-white"
                    : "border-neutral-800 bg-black/40 text-neutral-200 hover:border-neutral-600 hover:text-white"
                }`}
                title={t.value}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-7 flex items-center justify-between">
        <p className="text-sm text-neutral-300">
          Showing <span className="font-semibold text-neutral-100">{fmt(filtered.length)}</span> results
        </p>
        <p className="text-xs text-neutral-500">Tip: search by item id too (e.g., 3031).</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((it) => (
          <Link
            key={it.itemId}
            href={`/tools/lol/items/${it.slug}`}
            className="group rounded-3xl border border-neutral-800 bg-black/40 p-4 shadow-sm transition hover:border-neutral-600 hover:bg-black/50"
          >
            <div className="flex items-start gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-neutral-800 bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.iconUrl} alt={it.name} className="h-full w-full object-cover" loading="lazy" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="truncate text-base font-black tracking-tight">{it.name}</h2>
                  <span className="rounded-full border border-neutral-800 bg-black px-2 py-0.5 text-[11px] text-neutral-200">
                    {it.costTotal ? `${fmt(it.costTotal)}g` : "—"}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-2 text-xs text-neutral-200">
                  <span className="rounded-full border border-neutral-800 bg-black px-2 py-0.5">
                    {fmtPct(it.winrate)} WR
                  </span>
                  <span className="rounded-full border border-neutral-800 bg-black px-2 py-0.5">
                    {fmt(it.games)} games
                  </span>
                </div>

                {!!it.tags?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {it.tags.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-neutral-800 bg-black/30 px-2 py-0.5 text-[11px] text-neutral-300"
                      >
                        {t}
                      </span>
                    ))}
                    {it.tags.length > 4 ? (
                      <span className="rounded-full border border-neutral-800 bg-black/30 px-2 py-0.5 text-[11px] text-neutral-500">
                        +{it.tags.length - 4}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {it.topChamps?.length ? (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {it.topChamps.slice(0, 6).map((c) => (
                        <div
                          key={c.champId}
                          className="h-7 w-7 overflow-hidden rounded-full border border-neutral-800 bg-black"
                          title={`${c.champName} · ${fmtPct(c.winrate)} WR · ${fmt(c.games)} games`}
                        >
                          {c.champIconUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.champIconUrl}
                              alt={c.champName}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">
                              {c.champId}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <span className="text-[11px] text-neutral-500 group-hover:text-neutral-300">
                      Top champs using it
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-neutral-800 bg-black/40 p-6 text-neutral-200">
          No items match that search.
        </div>
      ) : null}
    </div>
  );
}
