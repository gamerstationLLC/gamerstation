"use client";

import { useMemo, useState } from "react";

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function toInt(v: string, min: number, max: number) {
  const t = v.trim();
  if (t === "") return NaN;
  const n = Math.floor(Number(t));
  if (!Number.isFinite(n)) return NaN;
  return Math.max(min, Math.min(max, n));
}

function toFloat(v: string) {
  const t = v.trim();
  if (t === "") return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

// ESTIMATE ONLY (until you add a real XP table)
function xpToNextLevelEstimate(level: number) {
  const L = Math.max(1, level);
  const base = 75;
  const linear = 22 * L;
  const quad = 0.65 * L * L;
  return Math.round(base + linear + quad);
}

function totalXpEstimate(current: number, target: number) {
  let total = 0;
  for (let lvl = current; lvl < target; lvl++) total += xpToNextLevelEstimate(lvl);
  return total;
}

type Mode = "manual" | "estimate";
type Tab = "inputs" | "results";

export default function BloxFruitsClient() {
  const [mode, setMode] = useState<Mode>("manual");
  const [tab, setTab] = useState<Tab>("inputs");

  // ✅ store as strings so user can clear inputs without snapping to 0
  const [currentLevel, setCurrentLevel] = useState("1");
  const [targetLevel, setTargetLevel] = useState("700");
  const [manualXpNeeded, setManualXpNeeded] = useState(""); // manual total XP needed

  const [xpPerQuest, setXpPerQuest] = useState("25000");
  const [questsPerMinute, setQuestsPerMinute] = useState("0.75");
  const [doubleXp, setDoubleXp] = useState(false);

  const xpNeeded = useMemo(() => {
    const cur = toInt(currentLevel, 1, 2550);
    const tar = toInt(targetLevel, 1, 2550);
    if (!Number.isFinite(cur) || !Number.isFinite(tar) || tar <= cur) return 0;

    if (mode === "manual") {
      const manual = toFloat(manualXpNeeded);
      return Number.isFinite(manual) ? Math.max(0, Math.floor(manual)) : 0;
    }

    return totalXpEstimate(cur, tar);
  }, [mode, currentLevel, targetLevel, manualXpNeeded]);

  const effectiveXpPerQuest = useMemo(() => {
    const base = toFloat(xpPerQuest);
    if (!Number.isFinite(base) || base <= 0) return 0;
    return doubleXp ? base * 2 : base;
  }, [xpPerQuest, doubleXp]);

  const qpm = useMemo(() => {
    const n = toFloat(questsPerMinute);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [questsPerMinute]);

  const xpPerMinute = useMemo(() => effectiveXpPerQuest * qpm, [effectiveXpPerQuest, qpm]);

  const minutesNeeded = useMemo(() => {
    if (xpNeeded <= 0 || xpPerMinute <= 0) return 0;
    return xpNeeded / xpPerMinute;
  }, [xpNeeded, xpPerMinute]);

  const questsNeeded = useMemo(() => {
    if (xpNeeded <= 0 || effectiveXpPerQuest <= 0) return 0;
    return xpNeeded / effectiveXpPerQuest;
  }, [xpNeeded, effectiveXpPerQuest]);

  const hoursNeeded = minutesNeeded / 60;

  function TabButton({ id, label }: { id: Tab; label: string }) {
    const active = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        className={[
          "flex-1 rounded-xl px-3 py-2 text-sm border transition",
          active
            ? "border-neutral-500 bg-neutral-900 text-white"
            : "border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-600",
        ].join(" ")}
      >
        {label}
      </button>
    );
  }

  const ControlsPanel = (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="text-sm font-semibold">Blox Fruits XP / Leveling</div>
      <div className="mt-2 text-sm text-neutral-400">
        Estimate time to reach a target level. Use Manual mode for exact XP totals.
      </div>

      {/* Mode */}
      <div className="mt-5 flex flex-wrap gap-2">
        {(["manual", "estimate"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={[
              "rounded-xl px-3 py-2 text-sm border transition",
              mode === m
                ? "border-neutral-500 bg-neutral-900 text-white"
                : "border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-600",
            ].join(" ")}
          >
            {m === "manual" ? "Manual XP" : "Estimate XP"}
          </button>
        ))}
      </div>

      {/* Levels */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm text-neutral-300">
          Current level
          <input
            type="number"
            inputMode="numeric"
            value={currentLevel}
            onChange={(e) => setCurrentLevel(e.target.value)}
            min={1}
            max={2550}
            className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
          />
        </label>

        <label className="text-sm text-neutral-300">
          Target level
          <input
            type="number"
            inputMode="numeric"
            value={targetLevel}
            onChange={(e) => setTargetLevel(e.target.value)}
            min={1}
            max={2550}
            className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
          />
        </label>
      </div>

      {/* Manual XP */}
      {mode === "manual" && (
        <label className="mt-4 block text-sm text-neutral-300">
          Total XP needed (current → target)
          <input
            type="number"
            inputMode="numeric"
            value={manualXpNeeded}
            onChange={(e) => setManualXpNeeded(e.target.value)}
            placeholder="Paste exact XP needed here"
            className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
          />
          <div className="mt-1 text-xs text-neutral-500">
            This gives the most accurate result. You can get the exact XP total from your own tracking or a trusted source.
          </div>
        </label>
      )}

      {/* Grind inputs */}
      <div className="mt-5 grid gap-3">
        <label className="text-sm text-neutral-300">
          XP per quest (average)
          <input
            type="number"
            inputMode="numeric"
            value={xpPerQuest}
            onChange={(e) => setXpPerQuest(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
          />
        </label>

        <label className="text-sm text-neutral-300">
          Quests per minute
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={questsPerMinute}
            onChange={(e) => setQuestsPerMinute(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
          />
          <div className="mt-1 text-xs text-neutral-500">Example: 0.75 = ~45 seconds per quest</div>
        </label>

        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" checked={doubleXp} onChange={(e) => setDoubleXp(e.target.checked)} />
          2× XP active
        </label>
      </div>
    </div>
  );

  const ResultsPanel = (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="text-sm font-semibold">Results</div>

      <div className="mt-5 grid gap-3">
        <div className="rounded-xl border border-neutral-800 bg-black p-4">
          <div className="text-xs text-neutral-500">XP needed</div>
          <div className="mt-1 text-2xl font-bold">{xpNeeded > 0 ? fmt(Math.round(xpNeeded)) : "—"}</div>
          {mode === "estimate" && (
            <div className="mt-1 text-xs text-neutral-500">Estimated curve (v1). Manual XP is more accurate.</div>
          )}
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black p-4">
          <div className="text-xs text-neutral-500">XP per minute</div>
          <div className="mt-1 text-2xl font-bold">{xpPerMinute > 0 ? fmt(Math.round(xpPerMinute)) : "—"}</div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black p-4">
          <div className="text-xs text-neutral-500">Time to target</div>
          <div className="mt-1 text-2xl font-bold">{minutesNeeded > 0 ? `${hoursNeeded.toFixed(1)}h` : "—"}</div>
          <div className="mt-1 text-xs text-neutral-500">
            {minutesNeeded > 0 ? `${fmt(Math.round(minutesNeeded))} minutes` : ""}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black p-4">
          <div className="text-xs text-neutral-500">Quests needed</div>
          <div className="mt-1 text-2xl font-bold">{questsNeeded > 0 ? fmt(Math.ceil(questsNeeded)) : "—"}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {/* Mobile tabs header (sticky top) */}
      <div className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur md:hidden">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex gap-2">
            <TabButton id="inputs" label="Inputs" />
            <TabButton id="results" label="Results" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 pb-24 md:pb-0">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Inputs */}
          <div className={["md:block", tab === "inputs" ? "block" : "hidden md:block"].join(" ")}>
            {ControlsPanel}
          </div>

          {/* Results */}
          <div className={["md:block", tab === "results" ? "block" : "hidden md:block"].join(" ")}>
            {ResultsPanel}
          </div>
        </div>
      </div>

      {/* Sticky results footer (mobile only) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur md:hidden">
        <button onClick={() => setTab("results")} className="w-full" aria-label="Open Results">
          <div className="mx-auto max-w-6xl px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-neutral-400">Quick Results</div>
                <div className="truncate text-sm font-semibold text-white">
                  {hoursNeeded > 0 ? `${hoursNeeded.toFixed(1)}h` : "—"} •{" "}
                  {questsNeeded > 0 ? `${fmt(Math.ceil(questsNeeded))} quests` : "—"}
                </div>
              </div>

              <div className="shrink-0 rounded-xl border border-neutral-800 bg-black px-3 py-2 text-xs text-neutral-300">
                View
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
