// app/tools/lol/items/[slug]/client.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { EnrichedItem, BuildPathItem } from "./page";

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function fmt(n: number) {
  return n.toLocaleString();
}

function fmtPct(x: number) {
  return `${(clamp01(x) * 100).toFixed(1)}%`;
}

function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 🔧 If your champ route differs, change it here.
function champHref(champSlugOrName: string) {
  const slug = slugify(champSlugOrName);
  return `/calculators/lol/champions/${slug}`;
}

// DDragon description includes HTML. Cheap safety: strip any <script>.
function sanitizeDdragonHtml(html: string) {
  return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

function BuildPathTile({ it }: { it: BuildPathItem }) {
  return (
    <Link
      href={`/tools/lol/items/${it.slug}`}
      className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 hover:bg-black/35"
      title={`${it.name}${it.costTotal ? ` · ${fmt(it.costTotal)}g` : ""}`}
    >
      <div className="h-10 w-10 overflow-hidden rounded-2xl border border-white/10 bg-black/50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={it.iconUrl} alt={it.name} className="h-full w-full object-cover" />
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white/90 group-hover:text-white">
          {it.name}
        </div>
        <div className="text-xs text-white/55">
          {it.costTotal ? `${fmt(it.costTotal)}g` : "—"} · ID {it.itemId}
        </div>
      </div>
    </Link>
  );
}

function BaseStatsCard({
  stats,
}: {
  stats: Array<{ label: string; value: string }> | undefined;
}) {
  if (!stats?.length) return null;

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-sm font-semibold text-white/80">Base stats</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {stats.map((s) => (
          <span
            key={`${s.label}:${s.value}`}
            className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] text-white/70"
            title={`${s.label}: ${s.value}`}
          >
            <span className="text-white/60">{s.label}:</span> {s.value}
          </span>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-white/45">
        Pulled from your <span className="font-mono text-white/55">items.json</span> stats (updates on patch/base stat
        changes).
      </div>
    </div>
  );
}

export default function ItemClient({ item }: { item: EnrichedItem }) {
  const safeHtml = useMemo(() => {
    if (!item.descriptionHtml) return null;
    return sanitizeDdragonHtml(item.descriptionHtml);
  }, [item.descriptionHtml]);

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      

      <div className="mt-6 rounded-3xl border border-white/10 bg-black/35 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-3xl border border-white/10 bg-black/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.iconUrl} alt={item.name} className="h-full w-full object-cover" />
            </div>

            <div className="min-w-0">
              <h2 className="text-2xl font-black tracking-tight">{item.name}</h2>
              <p className="mt-1 text-sm text-white/70">
                Patch <span className="font-semibold text-white">{item.patch}</span> · Usage{" "}
                <span className="font-semibold text-white">{item.source}</span>
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                  {fmtPct(item.winrate)} WR
                </span>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                  {fmt(item.games)} games
                </span>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                  ID: {item.itemId}
                </span>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                  Cost: {item.costTotal ? `${fmt(item.costTotal)}g` : "—"}
                </span>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                  Sell: {item.costSell ? `${fmt(item.costSell)}g` : "—"}
                </span>
              </div>

              {item.tags?.length ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {item.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] text-white/60"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="text-xs text-white/50 sm:text-right">
            <div>Generated: {new Date(item.generatedAt).toLocaleString()}</div>
          </div>
        </div>

        {item.plaintext ? <p className="mt-4 text-sm text-white/70">{item.plaintext}</p> : null}

        {/* ✅ NEW: base stats from items.json */}
        <BaseStatsCard stats={item.baseStats} />

        {safeHtml ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold text-white/80">Description</div>
            <div
              className="prose prose-invert mt-2 max-w-none text-sm prose-p:my-2 prose-li:my-1 prose-strong:text-white"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-black/35 p-5 shadow-sm backdrop-blur">
          <h3 className="text-lg font-black tracking-tight">Build path</h3>
          <p className="mt-1 text-sm text-white/60">From / Into comes from your items.json.</p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm font-semibold text-white/80">Builds from</div>
              {item.buildsFrom.length ? (
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {item.buildsFrom.map((it) => (
                    <BuildPathTile key={it.itemId} it={it} />
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-white/50">No components listed.</p>
              )}
            </div>

            <div>
              <div className="text-sm font-semibold text-white/80">Builds into</div>
              {item.buildsInto.length ? (
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {item.buildsInto.map((it) => (
                    <BuildPathTile key={it.itemId} it={it} />
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-white/50">No upgrades listed.</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/35 p-5 shadow-sm backdrop-blur">
          <h3 className="text-lg font-black tracking-tight">Top champions using this item</h3>
          <p className="mt-1 text-sm text-white/60">From your items_usage data (weighted by games).</p>

          {item.topChamps?.length ? (
            <div className="mt-4 space-y-2">
              {item.topChamps.slice(0, 12).map((c, idx) => (
                <Link
                  key={c.champId}
                  href={champHref(c.champSlug || c.champName)}
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 transition hover:border-white/20 hover:bg-black/40"
                  title={`Open ${c.champName}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/50">
                      {c.champIconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.champIconUrl} alt={c.champName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-white/50">
                          {c.champId}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">
                        #{idx + 1} {c.champName}
                      </div>
                      <div className="text-xs text-white/50 group-hover:text-white/60">
                        {fmt(c.games)} games · {fmtPct(c.winrate)} WR
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 text-xs text-white/70">
                    <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5">
                      {fmtPct(c.winrate)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5">
                      {fmt(c.games)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/50">No usage data for this item yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
