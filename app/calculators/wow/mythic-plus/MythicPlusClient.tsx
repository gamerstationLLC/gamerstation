"use client";

import { useMemo, useState } from "react";

function clampInt(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function formatMultiplier(value: number) {
  return `x${value.toFixed(2)}`;
}

function formatPercentFromBaseline(multiplier: number) {
  const pct = (multiplier - 1) * 100;
  return `+${pct >= 100 ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

// Default model: ~10% per keystone level (Blizzard-style approximation)
// Baseline: +2 => 1.0
function computeMultiplier(level: number) {
  const lvl = clampInt(level, 2, 30);
  let m = 1;
  for (let l = 3; l <= lvl; l++) m *= 1.1;
  return m;
}

type TabKey = "inputs" | "results";

export default function MythicPlusClient() {
  // Mobile: Inputs first, Results second
  const [tab, setTab] = useState<TabKey>("inputs");
  const [keyLevel, setKeyLevel] = useState<number>(10);
  const [compareKey, setCompareKey] = useState<number>(10);

  const result = useMemo(() => {
    const level = clampInt(keyLevel, 2, 30);
    const compare = clampInt(compareKey, 2, 30);

    const mult = computeMultiplier(level);
    const multCompare = computeMultiplier(compare);

    const relativeToCompare = multCompare === 0 ? 1 : mult / multCompare;
    const relativeTo10 = mult / computeMultiplier(10);

    return { level, compare, mult, relativeToCompare, relativeTo10 };
  }, [keyLevel, compareKey]);

  // Tabs: Inputs FIRST, Results SECOND
  const Tabs = (
    <div className="flex w-full rounded-2xl border border-neutral-800 bg-neutral-950 p-1">
      <button
        type="button"
        onClick={() => setTab("inputs")}
        className={[
          "flex-1 rounded-xl px-3 py-2 text-sm transition",
          tab === "inputs"
            ? "bg-black text-white"
            : "text-neutral-300 hover:text-white",
        ].join(" ")}
      >
        Inputs
      </button>
      <button
        type="button"
        onClick={() => setTab("results")}
        className={[
          "flex-1 rounded-xl px-3 py-2 text-sm transition",
          tab === "results"
            ? "bg-black text-white"
            : "text-neutral-300 hover:text-white",
        ].join(" ")}
      >
        Results
      </button>
    </div>
  );

  const InputsPanel = (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="text-sm font-semibold">Inputs</div>
      <p className="mt-2 text-sm text-neutral-400">
        Uses a simple <span className="text-white">~10% per keystone level</span>{" "}
        scaling model as a Blizzard-style approximation for quick comparisons.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Keystone */}
        <div>
          <label className="text-xs text-neutral-400">Keystone level</label>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min={2}
              max={30}
              value={result.level}
              onChange={(e) => setKeyLevel(Number(e.target.value))}
              className="w-full"
            />
            <input
              type="number"
              min={2}
              max={30}
              value={result.level}
              onChange={(e) =>
                setKeyLevel(clampInt(Number(e.target.value), 2, 30))
              }
              className="w-20 rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
            />
          </div>
          <p className="mt-2 text-xs text-neutral-500">Range: +2 to +30</p>
        </div>

        {/* Compare key */}
        <div>
          <label className="text-xs text-neutral-400">Compare to keystone</label>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min={2}
              max={30}
              value={result.compare}
              onChange={(e) => setCompareKey(Number(e.target.value))}
              className="w-full"
            />
            <input
              type="number"
              min={2}
              max={30}
              value={result.compare}
              onChange={(e) =>
                setCompareKey(clampInt(Number(e.target.value), 2, 30))
              }
              className="w-20 rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
            />
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Shows how much harder your selected key is than the comparison key.
          </p>
        </div>
      </div>
    </div>
  );

  // One “results bubble” for BOTH mobile + desktop
  const ResultsPanel = (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 space-y-6">
      <div>
        <div className="text-sm font-semibold">Mythic+ Scaling</div>
        <p className="mt-2 text-sm text-neutral-400">
          Enemy health and damage increase together at higher keystone levels.
          This uses a <span className="text-white">~10% per level</span> scaling
          model as a Blizzard-style approximation for quick comparisons.
        </p>
      </div>

      {/* Health row */}
      <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
        <div className="text-xs text-neutral-400">Enemy Health</div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <div className="text-2xl font-bold">{formatMultiplier(result.mult)}</div>
          <div className="text-xs text-neutral-400">
            {formatPercentFromBaseline(result.mult)} vs +2
          </div>
        </div>
        <div className="mt-1 text-xs text-neutral-500">
          {formatMultiplier(result.relativeToCompare)} vs +{result.compare}
        </div>
      </div>

      {/* Damage row */}
      <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
        <div className="text-xs text-neutral-400">Enemy Damage</div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <div className="text-2xl font-bold">{formatMultiplier(result.mult)}</div>
          <div className="text-xs text-neutral-400">
            {formatPercentFromBaseline(result.mult)} vs +2
          </div>
        </div>
        <div className="mt-1 text-xs text-neutral-500">
          {formatMultiplier(result.relativeToCompare)} vs +{result.compare}
        </div>
      </div>

      {/* Quick comparison */}
      <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
        <div className="text-sm font-semibold">Quick Comparison</div>

        <div className="mt-3 grid gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-xs text-neutral-400">vs +{result.compare}</div>
            <div className="text-lg font-bold">
              {formatMultiplier(result.relativeToCompare)}
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-3">
            <div className="text-xs text-neutral-400">vs +10</div>
            <div className="text-lg font-bold">
              {formatMultiplier(result.relativeTo10)}
            </div>
          </div>

          <p className="mt-1 text-xs text-neutral-500">
            Intended for fast comparisons. Seasonal tuning/affixes can shift real
            difficulty.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative space-y-6 pb-24">
      {/* Mobile tabs */}
      <div className="sm:hidden">{Tabs}</div>

      {/* Mobile: one tab at a time */}
      <div className="sm:hidden">{tab === "inputs" ? InputsPanel : ResultsPanel}</div>

      {/* Desktop: show Inputs + the single Results bubble */}
      <div className="hidden sm:block space-y-6">
        {InputsPanel}
        {ResultsPanel}
      </div>

      {/* Tiny sticky footer: multipliers only */}
      <div className="sticky bottom-3 z-20">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/90 backdrop-blur px-4 py-2">
          <div className="flex items-baseline gap-3">
  <span className="text-[11px] text-500">
    Enemy multipliers:
  </span>
</div>

            <div className="flex items-center justify-between gap-4">



              <div className="flex items-baseline gap-2">
                <span className="text-[11px] text-neutral-400">Health</span>
                <span className="text-sm font-semibold">
                  {formatMultiplier(result.mult)}
                </span>
              </div>

              <div className="h-4 w-px bg-neutral-800" />

              <div className="flex items-baseline gap-2">
                <span className="text-[11px] text-neutral-400">Damage</span>
                <span className="text-sm font-semibold">
                  {formatMultiplier(result.mult)}
                </span>
              </div>

              <div className="ml-auto text-[11px] text-neutral-500">
                +{result.level}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
