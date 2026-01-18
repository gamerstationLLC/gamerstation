// app/calculators/lol/champions/[slug]/StatsClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type ChampionBaseStats = {
  hp: number;
  hpperlevel: number;
  mp: number;
  mpperlevel: number;
  hpregen: number;
  hpregenperlevel: number;
  mpregen: number;
  mpregenperlevel: number;
  armor: number;
  armorperlevel: number;
  spellblock: number;
  spellblockperlevel: number;
  attackdamage: number;
  attackdamageperlevel: number;
  attackspeed: number; // base AS
  attackspeedperlevel: number; // AS growth in %
  movespeed: number;
  attackrange: number;
  crit: number;
  critperlevel: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function fmt(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  const s = n.toFixed(digits);
  return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function statAtLevel(base: number, perLevel: number, level: number) {
  return base + perLevel * (level - 1);
}

/**
 * LoL Attack Speed scaling:
 * AS(L) = baseAS * (1 + (asPerLevel/100) * (L-1))
 */
function attackSpeedAtLevel(baseAS: number, asPerLevelPct: number, level: number) {
  return baseAS * (1 + (asPerLevelPct / 100) * (level - 1));
}

export default function StatsClient({
  championId,
  championName,
  patch,
  calcHref,
  stats,
  defaultLevel = 1,
}: {
  championId: string;
  championName: string;
  patch: string;
  calcHref: string;
  stats: ChampionBaseStats;
  defaultLevel?: number;
}) {
  const [level, setLevel] = useState(() => clamp(defaultLevel, 1, 18));

  const computed = useMemo(() => {
    const L = level;
    return {
      hp: statAtLevel(stats.hp, stats.hpperlevel, L),
      mp: statAtLevel(stats.mp, stats.mpperlevel, L),
      hpregen: statAtLevel(stats.hpregen, stats.hpregenperlevel, L),
      mpregen: statAtLevel(stats.mpregen, stats.mpregenperlevel, L),
      armor: statAtLevel(stats.armor, stats.armorperlevel, L),
      mr: statAtLevel(stats.spellblock, stats.spellblockperlevel, L),
      ad: statAtLevel(stats.attackdamage, stats.attackdamageperlevel, L),
      as: attackSpeedAtLevel(stats.attackspeed, stats.attackspeedperlevel, L),
      crit: statAtLevel(stats.crit, stats.critperlevel, L),
      ms: stats.movespeed,
      range: stats.attackrange,
    };
  }, [level, stats]);

  return (
    <section className="mt-6 space-y-4">
      {/* Top bar: Back link LEFT (requested) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/calculators/lol/champions"
            className="inline-flex items-center gap-2 text-sm text-neutral-300 hover:text-white hover:underline"
          >
            <span aria-hidden>←</span> Back to Champion Index
          </Link>

          <span className="hidden sm:inline text-neutral-600">•</span>

          <div className="text-sm text-neutral-300">
            <span className="font-semibold text-white">{championName}</span>
            <span className="opacity-70"> ({championId})</span>
            <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-neutral-300">
              Patch {patch}
            </span>
          </div>
        </div>

        <div className="sm:text-right">
          <Link
            href={calcHref}
            className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-neutral-200"
          >
            Open LoL Damage Calc (import {championId})
          </Link>
        </div>
      </div>

      {/* “not a wiki” short intro */}
      <p className="max-w-3xl text-sm text-neutral-300">
        Base stats and per-level scaling. For real fight math (items, resists, combos), use the
        calculator.
      </p>

      {/* Slider card */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Stats at Level</div>
            <div className="mt-1 text-xs text-neutral-400">
              Slide to see scaling from level 1 to 18.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLevel(6)}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-neutral-200 hover:bg-white/10"
            >
              Lv 6
            </button>
            <button
              type="button"
              onClick={() => setLevel(11)}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-neutral-200 hover:bg-white/10"
            >
              Lv 11
            </button>
            <button
              type="button"
              onClick={() => setLevel(16)}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-neutral-200 hover:bg-white/10"
            >
              Lv 16
            </button>

            <div className="ml-1 rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-neutral-200">
              Level <span className="font-semibold">{level}</span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <input
            type="range"
            min={1}
            max={18}
            value={level}
            onChange={(e) => setLevel(clamp(Number(e.target.value), 1, 18))}
            className="w-full"
          />
          <div className="mt-2 flex justify-between text-[11px] text-neutral-500">
            <span>1</span>
            <span>18</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="HP" value={fmt(computed.hp)} />
          <Stat label="Mana/Energy" value={fmt(computed.mp)} />
          <Stat label="HP Regen" value={fmt(computed.hpregen)} />
          <Stat label="Mana Regen" value={fmt(computed.mpregen)} />
          <Stat label="Armor" value={fmt(computed.armor)} />
          <Stat label="MR" value={fmt(computed.mr)} />
          <Stat label="AD" value={fmt(computed.ad)} />
          <Stat label="Attack Speed" value={fmt(computed.as, 3)} />
          <Stat label="Move Speed" value={fmt(computed.ms)} />
          <Stat label="Range" value={fmt(computed.range)} />
          <Stat label="Crit" value={fmt(computed.crit)} />
        </div>

        <div className="mt-5 text-xs text-neutral-500">
          Note: Attack speed uses base AS × (1 + growth% × (level−1)).
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
      <div className="text-[11px] text-neutral-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-100">{value}</div>
    </div>
  );
}
