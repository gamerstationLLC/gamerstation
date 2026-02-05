// app/calculators/lol/champions/[slug]/StatsClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

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

type AbilityKey = "P" | "Q" | "W" | "E" | "R";

export type ChampionAbility = {
  key: AbilityKey;
  name: string;
  summary?: string;

  scalars?: Array<{
    label: string;
    values: number[];
    suffix?: string;
    precision?: number;
  }>;

  cooldown?: number[];
  cost?: number[];
  scalingText?: string[];
  damageType?: "physical" | "magic" | "true" | "mixed";
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

function isNumericAbility(ab: ChampionAbility) {
  return !!ab.scalars?.some((s) => Array.isArray(s.values) && s.values.length > 0);
}

function getAtRank(arr: number[] | undefined, rank: number) {
  if (!arr?.length) return null;
  return arr[Math.min(rank - 1, arr.length - 1)] ?? null;
}

function GSBrand() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <img
        src="/gs-logo-v2.png"
        alt="GamerStation"
        className="h-10 w-10 rounded-xl bg-black p-1 shadow"
      />
      <span className="text-lg font-black text-white">
        GamerStation<span className="align-super text-[0.6em]">™</span>
      </span>
    </Link>
  );
}

export default function StatsClient({
  championId,
  championName,
  patch,
  calcHref,
  stats,
  abilities,
  defaultLevel = 1,
}: {
  championId: string;
  championName: string;
  patch: string;
  calcHref: string;
  stats: ChampionBaseStats;
  abilities: ChampionAbility[];
  defaultLevel?: number;
}) {
  const [level, setLevel] = useState(() => clamp(defaultLevel, 1, 18));

  // ✅ START COLLAPSED: everything closed by default
  const [open, setOpen] = useState<Record<AbilityKey, boolean>>({
    P: false,
    Q: false,
    W: false,
    E: false,
    R: false,
  });

  const [abilityRanks, setAbilityRanks] = useState<Record<AbilityKey, number>>(() => ({
    P: 1,
    Q: 1,
    W: 1,
    E: 1,
    R: 1,
  }));

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

  // Order defensively: P Q W E R
  const abilityList = useMemo(() => {
    const order: AbilityKey[] = ["P", "Q", "W", "E", "R"];
    const map = new Map(abilities.map((a) => [a.key, a]));
    return order.map((k) => map.get(k)).filter(Boolean) as ChampionAbility[];
  }, [abilities]);

  const coveredCount = useMemo(() => {
    return abilityList.filter((ab) => ab.key !== "P" && isNumericAbility(ab)).length;
  }, [abilityList]);

  const champImg = useMemo(
    () => `https://ddragon.leagueoflegends.com/cdn/${patch}/img/champion/${championId}.png`,
    [patch, championId]
  );

  return (
    // ✅ Mobile edge-to-edge: remove the big side gutters on small screens
    <main className="mx-auto w-full max-w-6xl px-2 py-6 sm:px-4">
      {/* ===== Header (matches your other pages) ===== */}
      <div className="mb-4">
        {/* Row 1 */}
        <div className="flex items-center justify-between gap-3">
          <GSBrand />

          <Link
            href="/tools"
            className="rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600 hover:text-white"
          >
            Tools
          </Link>
        </div>

        {/* Row 2 */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={champImg}
              alt={championName}
              className="h-10 w-10 shrink-0 rounded-xl bg-black p-0.5 shadow ring-1 ring-white/10"
              loading="lazy"
            />
            <h1 className="truncate text-xl font-black text-white">{championName}</h1>
          </div>

          <div className="shrink-0">
            <span className="rounded-full border border-neutral-800 bg-black/40 px-2 py-1 text-xs text-neutral-400">
              Patch {patch}
            </span>
          </div>
        </div>

        {/* Row 3 */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/calculators/lol"
            className="rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600 hover:text-white"
          >
            LoL Hub
          </Link>

          <Link
            href="/calculators/lol/meta"
            className="rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600 hover:text-white"
          >
            Meta
          </Link>

          <Link
            href="/calculators/lol/champions"
            className="rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600 hover:text-white"
          >
            Champion Index
          </Link>

          <Link
            href={calcHref}
            className="rounded-xl border border-neutral-800 bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-neutral-200"
          >
            Open Damage Calc (import {championId})
          </Link>
        </div>
      </div>

      <p className="max-w-3xl text-sm text-neutral-300">
        Base stats and per-level scaling. For real fight math (items, resists, combos), use the
        calculator.
      </p>

      {/* Stats card */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 sm:rounded-3xl sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Stats at Level</div>
            <div className="mt-1 text-xs text-neutral-400">Slide to see scaling from level 1 to 18.</div>
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

      {/* Abilities */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 sm:rounded-3xl sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-white">Abilities</div>
              <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[11px] text-neutral-400">
                {coveredCount}/4 damage mapped
              </span>
            </div>
            <div className="mt-1 text-xs text-neutral-400">
              Descriptions from Data Dragon. Damage numbers from your overrides when available.
            </div>
          </div>

          <div className="text-xs text-neutral-400">
            Use ranks while testing combos in the{" "}
            <Link href={calcHref} className="text-neutral-200 hover:text-white hover:underline">
              damage calculator
            </Link>
            .
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {abilityList.map((ab) => {
            const maxR = ab.key === "R" ? 3 : ab.key === "P" ? 1 : 5;
            const rank = ab.key === "P" ? 1 : clamp(abilityRanks[ab.key] ?? 1, 1, maxR);
            const isOpen = open[ab.key] ?? false;

            const cdVal = getAtRank(ab.cooldown, rank);
            const costVal = getAtRank(ab.cost, rank);

            const hasNumbers = isNumericAbility(ab);

            return (
              <div
                key={ab.key}
                className="overflow-hidden rounded-2xl border border-white/10 bg-black/30"
              >
                {/* Clickable header */}
                <button
                  type="button"
                  onClick={() => setOpen((prev) => ({ ...prev, [ab.key]: !isOpen }))}
                  className="w-full min-w-0 p-4 text-left"
                  aria-expanded={isOpen}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-start gap-2">
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-neutral-100">
                          {ab.key}
                        </span>

                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-semibold text-neutral-100">
                              {ab.name}
                            </div>

                            {ab.key !== "P" ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-neutral-300">
                                Rank {rank}/{maxR}
                              </span>
                            ) : (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-neutral-300">
                                Passive
                              </span>
                            )}

                            {hasNumbers ? (
                              <span className="rounded-full border border-white/10 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                                numbers
                              </span>
                            ) : (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-neutral-400">
                                utility / not mapped
                              </span>
                            )}
                          </div>

                          {ab.summary ? (
                            // ✅ Prevent weird tokens ({{ ... }}) from forcing overflow on mobile
                            <div className="mt-1 line-clamp-2 break-words text-xs text-neutral-300">
                              {ab.summary}
                            </div>
                          ) : (
                            <div className="mt-1 text-xs text-neutral-500">—</div>
                          )}

                          {(cdVal !== null || costVal !== null || ab.damageType) && (
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-neutral-300">
                              {cdVal !== null ? (
                                <Pill>
                                  CD:{" "}
                                  <span className="font-semibold text-white">{fmt(cdVal, 1)}s</span>
                                </Pill>
                              ) : null}
                              {costVal !== null ? (
                                <Pill>
                                  Cost:{" "}
                                  <span className="font-semibold text-white">{fmt(costVal, 0)}</span>
                                </Pill>
                              ) : null}
                              {ab.damageType ? <Pill>{ab.damageType}</Pill> : null}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-1 shrink-0 text-neutral-400">
                      <span className="inline-flex items-center gap-2 text-[11px]">
                        <span className="hidden sm:inline">{isOpen ? "Collapse" : "Expand"}</span>
                        <span aria-hidden className="text-lg leading-none">
                          {isOpen ? "▾" : "▸"}
                        </span>
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expandable body */}
                {isOpen ? (
                  <div className="border-t border-white/10 px-4 pb-4 pt-3">
                    {ab.key !== "P" ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div className="mr-2 text-[11px] text-neutral-400">Rank</div>
                        {Array.from({ length: maxR }, (_, i) => i + 1).map((r) => {
                          const active = r === rank;
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAbilityRanks((prev) => ({ ...prev, [ab.key]: r }));
                              }}
                              className={
                                active
                                  ? "rounded-xl border border-white/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-black"
                                  : "rounded-xl border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-neutral-200 hover:bg-white/10"
                              }
                            >
                              {r}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}

                    {ab.scalars?.length ? (
                      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {ab.scalars.map((s) => {
                          const idx = Math.min(rank - 1, s.values.length - 1);
                          const val = s.values.length ? s.values[idx] : NaN;
                          const precision = s.precision ?? 0;
                          const suffix = s.suffix ?? "";

                          return (
                            <div
                              key={s.label}
                              className="rounded-2xl border border-white/10 bg-black/30 p-3"
                            >
                              <div className="text-[11px] text-neutral-400">{s.label}</div>
                              <div className="mt-1 text-sm font-semibold text-neutral-100">
                                {Number.isFinite(val) ? `${fmt(val, precision)}${suffix}` : "—"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-3 text-xs text-neutral-500">
                        No damage numbers tracked for this ability yet (utility / not overridden).
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </main>
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

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
      {children}
    </span>
  );
}
