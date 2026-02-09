"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type ItemIndexRow = {
  id: number;
  name: any;
  slot?: any;
  ilvl?: any;
};

type StatEntry = { type: string; value: any };

export type FullItem = {
  id: number;
  name: any;
  slot?: any;
  ilvl?: any;
  quality?: any;
  item_class?: any;
  item_subclass?: any;
  required_level?: any;
  stats?: StatEntry[] | Record<string, any>;
  description?: any;
};

type ContentFocus = "mplus" | "raid";
type DamageProfile = "st" | "aoe";

export type SpecKey =
  | "havoc_dh"
  | "vengeance_dh"
  | "fire_mage"
  | "frost_mage"
  | "arcane_mage"
  | "ret_paladin"
  | "prot_paladin"
  | "holy_paladin"
  | "arms_warrior"
  | "fury_warrior"
  | "prot_warrior";

const SPECS: Array<{ key: SpecKey; label: string }> = [
  { key: "havoc_dh", label: "Demon Hunter — Havoc" },
  { key: "vengeance_dh", label: "Demon Hunter — Vengeance" },
  { key: "fire_mage", label: "Mage — Fire" },
  { key: "frost_mage", label: "Mage — Frost" },
  { key: "arcane_mage", label: "Mage — Arcane" },
  { key: "ret_paladin", label: "Paladin — Retribution" },
  { key: "prot_paladin", label: "Paladin — Protection" },
  { key: "holy_paladin", label: "Paladin — Holy" },
  { key: "arms_warrior", label: "Warrior — Arms" },
  { key: "fury_warrior", label: "Warrior — Fury" },
  { key: "prot_warrior", label: "Warrior — Protection" },
];

const pill =
  "rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white";
const input =
  "w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-neutral-200 outline-none transition focus:border-neutral-600";
const card =
  "rounded-2xl border border-neutral-800 bg-black p-4 sm:p-6 transition hover:border-neutral-600";

function Toggle({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: any) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={[
              pill,
              active
                ? "border-neutral-600 text-white shadow-[0_0_25px_rgba(0,255,255,0.25)]"
                : "",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** React-safe text normalizer */
function toText(x: any): string {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (typeof x === "number" || typeof x === "boolean") return String(x);
  if (Array.isArray(x)) return x.map(toText).filter(Boolean).join(" ");
  if (typeof x === "object") {
    if ("value" in x) return toText((x as any).value);
    try {
      return JSON.stringify(x);
    } catch {
      return String(x);
    }
  }
  return String(x);
}

function toNumber(x: any): number | null {
  if (x == null) return null;
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

function getStatNumber(v: any): number {
  const n = toNumber(v);
  if (n != null) return n;
  const t = toText(v);
  const n2 = Number(t.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n2) ? n2 : 0;
}

function fmtStatValue(v: any): string {
  if (v == null) return "—";
  if (typeof v === "number") return v.toLocaleString();
  const t = toText(v);
  return t || "—";
}

/** Pretty labels */
const STAT_LABELS: Record<string, string> = {
  STRENGTH: "Strength",
  AGILITY: "Agility",
  INTELLECT: "Intellect",
  STAMINA: "Stamina",

  CRIT_RATING: "Crit Rating",
  HASTE_RATING: "Haste Rating",
  MASTERY_RATING: "Mastery Rating",
  VERSATILITY: "Versatility",
  VERSATILITY_RATING: "Versatility Rating",

  LEECH: "Leech",
  AVOIDANCE: "Avoidance",
  SPEED: "Speed",
};

function labelForStatType(t: string): string {
  if (!t) return "Unknown Stat";
  return (
    STAT_LABELS[t] ??
    t
      .toLowerCase()
      .split("_")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ")
  );
}

/** Weights JSON type */
export type WowStatWeightsJson = {
  version?: number;
  notes?: string;
  specs?: Partial<
    Record<
      SpecKey,
      Partial<
        Record<
          ContentFocus,
          Partial<Record<DamageProfile, Record<string, number>>>
        >
      >
    >
  >;
};

function normalizeStats(stats: FullItem["stats"]): Record<string, number> {
  const out: Record<string, number> = {};
  if (!stats) return out;

  // array: [{type,value}]
  if (Array.isArray(stats)) {
    for (const s of stats) {
      if (!s) continue;
      const type =
        typeof s.type === "string" ? s.type : toText((s as any).type);
      const value = getStatNumber((s as any).value);
      if (!type) continue;
      out[type] = (out[type] ?? 0) + value;
    }
    return out;
  }

  // object: {KEY: value}
  if (typeof stats === "object") {
    for (const [k, v] of Object.entries(stats)) {
      out[k] = (out[k] ?? 0) + getStatNumber(v);
    }
  }

  return out;
}

function diffLabel(n: number): { text: string; cls: string } {
  if (n > 0) return { text: `+${n}`, cls: "text-green-400 font-semibold" };
  if (n < 0) return { text: `${n}`, cls: "text-red-400 font-semibold" };
  return { text: "0", cls: "text-neutral-400" };
}

function impactLabel(n: number): { text: string; cls: string } {
  if (n > 0)
    return { text: `+${n.toFixed(1)}`, cls: "text-emerald-300 font-semibold" };
  if (n < 0)
    return { text: `${n.toFixed(1)}`, cls: "text-rose-300 font-semibold" };
  return { text: "0.0", cls: "text-neutral-400" };
}

function Badge({ label }: { label: string }) {
  const base =
    "inline-flex items-center rounded-xl border px-3 py-2 text-sm font-semibold";

  if (label === "Upgrade")
    return (
      <span
        className={`${base} border-neutral-600 text-white shadow-[0_0_25px_rgba(0,255,255,0.25)]`}
      >
        Upgrade
      </span>
    );

  return (
    <span className={`${base} border-neutral-800 text-neutral-200`}>
      {label}
    </span>
  );
}

function ItemPicker({
  title,
  itemsIndex,
  itemsById,
  picked,
  onPick,
  isLoading,
}: {
  title: string;
  itemsIndex: ItemIndexRow[];
  itemsById: Record<number, FullItem>;
  picked: ItemIndexRow | null;
  onPick: (item: ItemIndexRow | null) => void;
  isLoading: boolean;
}) {
  const [q, setQ] = useState("");

  const suggestions = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return [];
    return itemsIndex
      .filter((r) => toText(r.name).toLowerCase().includes(qq))
      .slice(0, 10);
  }, [q, itemsIndex]);

  const full = picked ? itemsById[picked.id] : null;

  const pickedName = picked ? toText(picked.name) : "";
  const pickedSlot = picked?.slot ? toText(picked.slot) : "";
  const pickedIlvl = toNumber(picked?.ilvl);

  return (
    <div className={card}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{title}</div>
        {picked ? (
          <button
            type="button"
            onClick={() => onPick(null)}
            className="text-sm text-neutral-300 hover:text-white transition"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="mt-4 relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            isLoading
              ? "Loading items…"
              : itemsIndex.length
              ? "Search item name…"
              : "No items…"
          }
          className={input}
          autoComplete="off"
          disabled={isLoading || !itemsIndex.length}
        />

        {q.trim() && !isLoading && (
          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-neutral-800 bg-black">
            {suggestions.length ? (
              suggestions.map((s) => {
                const sName = toText(s.name);
                const sIlvl = toNumber(s.ilvl);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onPick(s);
                      setQ("");
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-900 transition"
                  >
                    <span className="truncate font-semibold">{sName}</span>
                    <span className="shrink-0 text-xs text-neutral-400">
                      {sIlvl != null ? `ilvl ${sIlvl}` : "—"}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2 text-sm text-neutral-500">
                No results.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-neutral-800 bg-black p-4">
        {isLoading ? (
          <div className="text-sm text-neutral-400">Loading item data…</div>
        ) : picked ? (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-white">{pickedName}</div>

            <div className="text-xs text-neutral-400">
              ID: {picked.id}
              {pickedSlot ? ` • Slot: ${pickedSlot}` : ""}
              {pickedIlvl != null ? ` • ilvl: ${pickedIlvl}` : ""}
              {full?.required_level != null
                ? ` • Req lvl: ${full.required_level}`
                : ""}
            </div>
          </div>
        ) : (
          <div className="text-sm text-neutral-400">
            Pick an item to compare.
          </div>
        )}
      </div>
    </div>
  );
}

function computeWeightedScore(
  stats: Record<string, number>,
  weights: Record<string, number>
) {
  let score = 0;
  for (const [k, v] of Object.entries(stats)) {
    const w = weights[k] ?? 0;
    if (!w) continue;
    score += v * w;
  }
  return score;
}

function pickWeights(
  weightsJson: WowStatWeightsJson | null | undefined,
  spec: SpecKey,
  focus: ContentFocus,
  profile: DamageProfile
): Record<string, number> {
  const w =
    weightsJson?.specs?.[spec]?.[focus]?.[profile] ??
    weightsJson?.specs?.[spec]?.[focus]?.st ??
    weightsJson?.specs?.[spec]?.mplus?.[profile] ??
    weightsJson?.specs?.[spec]?.mplus?.st ??
    null;

  return w && typeof w === "object" ? w : {};
}

function computeComparison(
  aFull: FullItem | null,
  bFull: FullItem | null,
  weightsJson: WowStatWeightsJson | null | undefined,
  spec: SpecKey,
  focus: ContentFocus,
  profile: DamageProfile
) {
  const hasBoth = Boolean(aFull && bFull);

  const ilvlA = aFull ? toNumber(aFull.ilvl) : null;
  const ilvlB = bFull ? toNumber(bFull.ilvl) : null;

  const aStats = normalizeStats(aFull?.stats);
  const bStats = normalizeStats(bFull?.stats);

  const weights = pickWeights(weightsJson, spec, focus, profile);

  const aScore = computeWeightedScore(aStats, weights);
  const bScore = computeWeightedScore(bStats, weights);
  const scoreDelta = bScore - aScore;

  const keys = new Set<string>([...Object.keys(aStats), ...Object.keys(bStats)]);

  const rows = Array.from(keys)
    .map((key) => {
      const aVal = aStats[key] ?? 0;
      const bVal = bStats[key] ?? 0;
      const delta = bVal - aVal;
      const w = weights[key] ?? 0;
      return {
        key,
        label: labelForStatType(key),
        a: aVal,
        b: bVal,
        delta,
        weight: w,
        weightedDelta: delta * w,
      };
    })
    .filter((r) => !(r.a === 0 && r.b === 0 && r.delta === 0))
    .sort((r1, r2) => {
      const wd = Math.abs(r2.weightedDelta) - Math.abs(r1.weightedDelta);
      if (wd !== 0) return wd;
      const ad = Math.abs(r2.delta) - Math.abs(r1.delta);
      if (ad !== 0) return ad;
      return r1.label.localeCompare(r2.label);
    });

  let verdict: {
    label: "Ready" | "Upgrade" | "Downgrade" | "Sidegrade";
    sub: string;
  } = {
    label: "Ready",
    sub: "Select two items to compare.",
  };

  if (hasBoth) {
    if (!Object.keys(weights).length) {
      verdict = {
        label: "Sidegrade",
        sub: "No weights found for this spec (check JSON)",
      };
    } else if (scoreDelta > 0.5) {
      verdict = { label: "Upgrade", sub: `+${scoreDelta.toFixed(1)} score` };
    } else if (scoreDelta < -0.5) {
      verdict = { label: "Downgrade", sub: `${scoreDelta.toFixed(1)} score` };
    } else {
      verdict = { label: "Sidegrade", sub: `${scoreDelta.toFixed(1)} score` };
    }
  }

  return {
    hasBoth,
    ilvlA,
    ilvlB,
    verdict,
    rows,
    aScore,
    bScore,
    scoreDelta,
    weights,
  };
}

function ComparisonPanel({
  a,
  b,
  itemsById,
  weightsJson,
  spec,
  focus,
  profile,
}: {
  a: ItemIndexRow | null;
  b: ItemIndexRow | null;
  itemsById: Record<number, FullItem>;
  weightsJson: WowStatWeightsJson | null | undefined;
  spec: SpecKey;
  focus: ContentFocus;
  profile: DamageProfile;
}) {
  const aFull = a ? itemsById[a.id] : null;
  const bFull = b ? itemsById[b.id] : null;

  const data = useMemo(
    () => computeComparison(aFull, bFull, weightsJson, spec, focus, profile),
    [aFull, bFull, weightsJson, spec, focus, profile]
  );

  const aName = a ? toText(a.name) : "Current item";
  const bName = b ? toText(b.name) : "New item";

  const ilvlDelta =
    data.ilvlA != null && data.ilvlB != null ? data.ilvlB - data.ilvlA : null;

  const topRows = data.rows.slice(0, 18);

  return (
    <div className={card}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold">Comparison</div>
          <div className="mt-2 text-sm text-neutral-400">
            <span className="text-neutral-200 font-semibold">{aName}</span>{" "}
            <span className="text-neutral-600">→</span>{" "}
            <span className="text-neutral-200 font-semibold">{bName}</span>
          </div>

          <div className="mt-2 text-xs text-neutral-500">
            {SPECS.find((s) => s.key === spec)?.label ?? spec} •{" "}
            {focus === "mplus" ? "Mythic+" : "Raid"} •{" "}
            {profile === "aoe" ? "AoE" : "Single Target"}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge label={data.verdict.label} />
          <div className="text-sm text-neutral-400">{data.verdict.sub}</div>
        </div>
      </div>

      {/* ✅ Desktop layout: fixed left panel + fluid right panel */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-xl border border-neutral-800 bg-black p-4">
          <div className="text-xs text-neutral-500">Upgrade score</div>

          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-lg font-semibold text-neutral-200">
              {data.hasBoth ? data.aScore.toFixed(1) : "—"}
            </div>

            <div className="text-sm text-neutral-500">→</div>

            <div className="text-lg font-semibold text-neutral-200">
              {data.hasBoth ? data.bScore.toFixed(1) : "—"}
            </div>

            {data.hasBoth ? (
              <div
                className={`ml-2 text-sm font-semibold ${
                  data.scoreDelta > 0
                    ? "text-green-400"
                    : data.scoreDelta < 0
                    ? "text-red-400"
                    : "text-neutral-400"
                }`}
              >
                ({data.scoreDelta > 0 ? "+" : ""}
                {data.scoreDelta.toFixed(1)})
              </div>
            ) : null}
          </div>

          <div className="mt-4 border-t border-neutral-900 pt-3">
            <div className="text-xs text-neutral-500">Item level</div>

            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-base font-semibold text-neutral-200">
                {data.ilvlA != null ? data.ilvlA : "—"}
              </div>

              <div className="text-sm text-neutral-500">→</div>

              <div className="text-base font-semibold text-neutral-200">
                {data.ilvlB != null ? data.ilvlB : "—"}
              </div>

              {ilvlDelta != null ? (
                <div
                  className={`ml-2 text-xs font-semibold ${
                    ilvlDelta > 0
                      ? "text-green-400"
                      : ilvlDelta < 0
                      ? "text-red-400"
                      : "text-neutral-400"
                  }`}
                >
                  ({ilvlDelta > 0 ? "+" : ""}
                  {ilvlDelta})
                </div>
              ) : null}
            </div>
          </div>

          {!Object.keys(data.weights).length ? (
            <div className="mt-3 text-xs text-rose-300">
              No weights found for this spec/profile in{" "}
              <span className="text-rose-200">stats_weights.json</span>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black p-4 w-full">
          <div className="text-xs text-neutral-500">
            Stat deltas (New − Current)
          </div>

          {!data.hasBoth ? (
            <div className="mt-2 text-sm text-neutral-400">
              Select two items to see a stat breakdown.
            </div>
          ) : !topRows.length ? (
            <div className="mt-2 text-sm text-neutral-400">
              No stats found on one or both items.
            </div>
          ) : (
            <>
              {/* ✅ Desktop: use grid-cols-12 (NO arbitrary grid templates) so Tailwind can't "drop" the class */}
              <div className="mt-3 hidden sm:block">
                <div className="mx-auto w-full max-w-[900px]">
                  {/* Header */}
                  <div className="grid grid-cols-12 items-center gap-2 text-[11px] text-neutral-500">
                    <div className="col-span-6">Stat</div>
                    <div className="col-span-2 text-right whitespace-nowrap">
                      Cur
                    </div>
                    <div className="col-span-2 text-right whitespace-nowrap">
                      New
                    </div>
                    <div className="col-span-1 text-right whitespace-nowrap">
                      Δ
                    </div>
                    <div className="col-span-1 text-right whitespace-nowrap">
                      Imp
                    </div>
                  </div>

                  {/* Rows */}
                  <div className="mt-2 divide-y divide-neutral-900">
                    {topRows.map((r) => {
                      const d = diffLabel(r.delta);
                      const impact = impactLabel(r.weightedDelta);

                      return (
                        <div
                          key={r.key}
                          className="grid grid-cols-12 items-center gap-2 py-1"
                        >
                          <div className="col-span-6 text-sm text-neutral-200 font-medium leading-tight">
                            {r.label}
                          </div>

                          <div className="col-span-2 text-right text-neutral-400 tabular-nums text-[13px] leading-tight whitespace-nowrap">
                            {fmtStatValue(r.a)}
                          </div>

                          <div className="col-span-2 text-right text-neutral-400 tabular-nums text-[13px] leading-tight whitespace-nowrap">
                            {fmtStatValue(r.b)}
                          </div>

                          <div
                            className={`col-span-1 text-right tabular-nums text-[13px] leading-tight whitespace-nowrap ${d.cls}`}
                          >
                            {d.text}
                          </div>

                          <div
                            className={`col-span-1 text-right tabular-nums text-[13px] leading-tight whitespace-nowrap ${impact.cls}`}
                            title={
                              r.weight
                                ? `Δ ${r.delta} × weight ${r.weight} = ${r.weightedDelta.toFixed(
                                    2
                                  )}`
                                : "No weight for this stat"
                            }
                          >
                            {impact.text}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Mobile: unchanged */}
              <div className="mt-3 sm:hidden">
                <div className="overflow-hidden rounded-xl border border-neutral-800 bg-black">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] text-neutral-500 border-b border-neutral-900">
                    <div className="col-span-4">Stat</div>
                    <div className="col-span-2 text-right">Cur</div>
                    <div className="col-span-2 text-right">New</div>
                    <div className="col-span-2 text-right">Δ</div>
                    <div className="col-span-2 text-right">Imp</div>
                  </div>

                  <div className="max-h-[360px] overflow-y-auto">
                    {topRows.map((r) => {
                      const d =
                        r.delta > 0
                          ? {
                              text: `+${r.delta}`,
                              cls: "text-green-400 font-semibold",
                            }
                          : r.delta < 0
                          ? {
                              text: `${r.delta}`,
                              cls: "text-red-400 font-semibold",
                            }
                          : { text: "0", cls: "text-neutral-400" };

                      const impact =
                        r.weightedDelta > 0
                          ? {
                              text: `+${r.weightedDelta.toFixed(1)}`,
                              cls: "text-emerald-300 font-semibold",
                            }
                          : r.weightedDelta < 0
                          ? {
                              text: `${r.weightedDelta.toFixed(1)}`,
                              cls: "text-rose-300 font-semibold",
                            }
                          : { text: "0.0", cls: "text-neutral-400" };

                      return (
                        <div
                          key={r.key}
                          className="grid grid-cols-12 items-center gap-2 px-3 py-2 text-xs border-b border-neutral-900 last:border-b-0"
                        >
                          <div className="col-span-4 text-neutral-200 font-medium leading-snug break-words">
                            {r.label}
                          </div>

                          <div className="col-span-2 text-right text-neutral-400">
                            {fmtStatValue(r.a)}
                          </div>

                          <div className="col-span-2 text-right text-neutral-400">
                            {fmtStatValue(r.b)}
                          </div>

                          <div className={`col-span-2 text-right ${d.cls}`}>
                            {d.text}
                          </div>

                          <div
                            className={`col-span-2 text-right ${impact.cls}`}
                            title={
                              r.weight
                                ? `Δ ${r.delta} × weight ${r.weight} = ${r.weightedDelta.toFixed(
                                    2
                                  )}`
                                : "No weight for this stat"
                            }
                          >
                            {impact.text}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {data.rows.length > topRows.length ? (
                  <div className="pt-2 text-xs text-neutral-600">
                    Showing top {topRows.length} changes (of{" "}
                    {data.rows.length.toLocaleString()} stats).
                  </div>
                ) : null}
              </div>

              <div className="hidden sm:block">
                {data.rows.length > topRows.length ? (
                  <div className="pt-3 text-xs text-neutral-600">
                    Showing top {topRows.length} changes (of{" "}
                    {data.rows.length.toLocaleString()} stats).
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ✅ NEW BEHAVIOR:
 * - No longer receives huge JSON via props (which bloats initial RSC payload)
 * - Instead fetches from /public after first paint (perceived faster initial load)
 *
 * Expected files in /public:
 *  - /data/wow/items_index.json
 *  - /data/wow/items_by_id.json
 *  - /data/wow/stats_weights.json
 */
export default function UpgradeCheckerClient() {
  const [spec, setSpec] = useState<SpecKey>("arms_warrior");
  const [focus, setFocus] = useState<ContentFocus>("mplus");
  const [profile, setProfile] = useState<DamageProfile>("aoe");

  const [itemA, setItemA] = useState<ItemIndexRow | null>(null);
  const [itemB, setItemB] = useState<ItemIndexRow | null>(null);

  const [itemsIndex, setItemsIndex] = useState<ItemIndexRow[]>([]);
  const [itemsById, setItemsById] = useState<Record<number, FullItem>>({});
  const [statWeights, setStatWeights] = useState<WowStatWeightsJson | null>(
    null
  );

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const didStartRef = useRef(false);

  useEffect(() => {
    if (didStartRef.current) return;
    didStartRef.current = true;

    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [idxRes, byIdRes, wRes] = await Promise.all([
          fetch("/data/wow/items_index.json", {
            signal: controller.signal,
            cache: "force-cache",
          }),
          fetch("/data/wow/items_by_id.json", {
            signal: controller.signal,
            cache: "force-cache",
          }),
          fetch("/data/wow/stats_weights.json", {
            signal: controller.signal,
            cache: "force-cache",
          }),
        ]);

        if (!idxRes.ok)
          throw new Error(
            `items_index.json failed (${idxRes.status} ${idxRes.statusText})`
          );
        if (!byIdRes.ok)
          throw new Error(
            `items_by_id.json failed (${byIdRes.status} ${byIdRes.statusText})`
          );
        if (!wRes.ok)
          throw new Error(
            `stats_weights.json failed (${wRes.status} ${wRes.statusText})`
          );

        const [idx, byId, weights] = await Promise.all([
          idxRes.json(),
          byIdRes.json(),
          wRes.json(),
        ]);

        // Basic shape sanity (avoid runtime nukes if file is wrong)
        setItemsIndex(Array.isArray(idx) ? (idx as ItemIndexRow[]) : []);
        setItemsById(
          byId && typeof byId === "object" ? (byId as Record<number, FullItem>) : {}
        );
        setStatWeights(
          weights && typeof weights === "object"
            ? (weights as WowStatWeightsJson)
            : null
        );

        setIsLoading(false);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setIsLoading(false);
        setLoadError(e?.message ? String(e.message) : "Failed to load data.");
      }
    }

    load();
    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-6">
      <div className={card}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <div className="text-sm font-semibold">Spec</div>
            <select
              value={spec}
              onChange={(e) => setSpec(e.target.value as SpecKey)}
              className={`${input} mt-3`}
              disabled={isLoading}
            >
              {SPECS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-sm font-semibold">Content</div>
            <div className="mt-3">
              <Toggle
                value={focus}
                onChange={setFocus}
                options={[
                  { value: "mplus", label: "Mythic+" },
                  { value: "raid", label: "Raid" },
                ]}
              />
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold">Profile</div>
            <div className="mt-3">
              <Toggle
                value={profile}
                onChange={setProfile}
                options={[
                  { value: "st", label: "Single Target" },
                  { value: "aoe", label: "AoE" },
                ]}
              />
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-neutral-500">
          {isLoading ? (
            <>Loading data from public JSON…</>
          ) : loadError ? (
            <>
              <span className="text-rose-300 font-semibold">
                Data load error:
              </span>{" "}
              <span className="text-rose-200">{loadError}</span>
            </>
          ) : (
            <>
              Weights loaded from{" "}
              <span className="text-neutral-300">stats_weights.json</span>.
              {statWeights?.version ? ` v${statWeights.version}.` : ""}
            </>
          )}
        </p>

        {!isLoading && !loadError && !itemsIndex.length ? (
          <div className="mt-3 text-xs text-rose-300">
            items_index.json loaded but contained 0 items (check file path / JSON
            shape).
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ItemPicker
          title="Current Item"
          itemsIndex={itemsIndex}
          itemsById={itemsById}
          picked={itemA}
          onPick={setItemA}
          isLoading={isLoading || !!loadError}
        />
        <ItemPicker
          title="New Item"
          itemsIndex={itemsIndex}
          itemsById={itemsById}
          picked={itemB}
          onPick={setItemB}
          isLoading={isLoading || !!loadError}
        />
      </div>

      <ComparisonPanel
        a={itemA}
        b={itemB}
        itemsById={itemsById}
        weightsJson={statWeights}
        spec={spec}
        focus={focus}
        profile={profile}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="text-xs text-neutral-600">
          {isLoading
            ? "Loading…"
            : loadError
            ? "0 items loaded"
            : itemsIndex.length
            ? `${itemsIndex.length.toLocaleString()} items loaded`
            : "0 items loaded"}
        </div>

        <button
          type="button"
          onClick={() => {
            setItemA(null);
            setItemB(null);
          }}
          className="text-xs text-neutral-400 hover:text-white transition"
          disabled={isLoading}
        >
          Clear both
        </button>
      </div>
    </div>
  );
}
