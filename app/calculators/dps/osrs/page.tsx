"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  clamp,
  computeOsrsDps,
  type Inputs,
  type Style,
  type MeleePrayer,
  type RangedPrayer,
  type MagicPrayer,
  type Potion,
} from "./osrs-math";

function fmt(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function fmtPct(n: number, digits = 1) {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

function fmtTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds === Infinity) return "∞";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}m ${s.toFixed(0)}s`;
}

export default function OsrsDpsPage() {
  const [style, setStyle] = useState<Style>("melee");

  const [atkLevel, setAtkLevel] = useState(75);
  const [strLevel, setStrLevel] = useState(75);
  const [rngLevel, setRngLevel] = useState(75);
  const [magLevel, setMagLevel] = useState(75);

  const [attackBonus, setAttackBonus] = useState(100);
  const [strengthBonus, setStrengthBonus] = useState(80);
  const [rangedStrength, setRangedStrength] = useState(80);
  const [magicDamagePct, setMagicDamagePct] = useState(0);

  const [speedTicks, setSpeedTicks] = useState(4);

  const [meleePrayer, setMeleePrayer] = useState<MeleePrayer>("none");
  const [rangedPrayer, setRangedPrayer] = useState<RangedPrayer>("none");
  const [magicPrayer, setMagicPrayer] = useState<MagicPrayer>("none");
  const [potion, setPotion] = useState<Potion>("none");

  const [targetHp, setTargetHp] = useState(150);
  const [targetDefLevel, setTargetDefLevel] = useState(100);
  const [targetDefBonus, setTargetDefBonus] = useState(100);

  const inputs: Inputs = useMemo(
    () => ({
      style,
      atkLevel: clamp(atkLevel, 1, 120),
      strLevel: clamp(strLevel, 1, 120),
      rngLevel: clamp(rngLevel, 1, 120),
      magLevel: clamp(magLevel, 1, 120),
      attackBonus: clamp(attackBonus, -200, 400),
      strengthBonus: clamp(strengthBonus, -200, 400),
      rangedStrength: clamp(rangedStrength, -200, 400),
      magicDamagePct: clamp(magicDamagePct, 0, 200),
      speedTicks: clamp(speedTicks, 2, 7),
      meleePrayer,
      rangedPrayer,
      magicPrayer,
      potion,
      targetHp: clamp(targetHp, 1, 5000),
      targetDefLevel: clamp(targetDefLevel, 1, 400),
      targetDefBonus: clamp(targetDefBonus, -200, 400),
    }),
    [
      style,
      atkLevel,
      strLevel,
      rngLevel,
      magLevel,
      attackBonus,
      strengthBonus,
      rangedStrength,
      magicDamagePct,
      speedTicks,
      meleePrayer,
      rangedPrayer,
      magicPrayer,
      potion,
      targetHp,
      targetDefLevel,
      targetDefBonus,
    ]
  );

  const result = useMemo(() => computeOsrsDps(inputs), [inputs]);

  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <Link href="/calculators" className="text-sm text-neutral-300 hover:text-white">
            ← Back to calculators
          </Link>
          <div className="text-sm text-neutral-400">OSRS • DPS</div>
        </header>

        <div className="mt-8">
          <h1 className="text-4xl font-bold tracking-tight">OSRS DPS Calculator (v1)</h1>
          <p className="mt-3 text-neutral-300 max-w-2xl">
            Baseline expected DPS using hit chance + average hit + attack speed. Great for quick comparisons.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* INPUTS */}
          <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <div className="text-sm font-semibold">Inputs</div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <div className="text-xs text-neutral-400">Style</div>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value as Style)}
                  className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                >
                  <option value="melee">Melee</option>
                  <option value="ranged">Ranged</option>
                  <option value="magic">Magic (powered staff baseline)</option>
                </select>
              </label>

              <label className="block">
                <div className="text-xs text-neutral-400">Attack speed (ticks)</div>
                <select
                  value={speedTicks}
                  onChange={(e) => setSpeedTicks(Number(e.target.value))}
                  className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                >
                  {[2, 3, 4, 5, 6, 7].map((t) => (
                    <option key={t} value={t}>
                      {t} ticks ({(t * 0.6).toFixed(1)}s)
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* LEVELS */}
            <div className="mt-6 rounded-2xl border border-neutral-800 bg-black/40 p-4">
              <div className="text-sm font-semibold">Player levels</div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <div className="text-xs text-neutral-400">Attack (melee)</div>
                  <input
                    type="number"
                    value={atkLevel}
                    onChange={(e) => setAtkLevel(Number(e.target.value))}
                    className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                  />
                </label>

                <label className="block">
                  <div className="text-xs text-neutral-400">Strength (melee)</div>
                  <input
                    type="number"
                    value={strLevel}
                    onChange={(e) => setStrLevel(Number(e.target.value))}
                    className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                  />
                </label>

                <label className="block">
                  <div className="text-xs text-neutral-400">Ranged</div>
                  <input
                    type="number"
                    value={rngLevel}
                    onChange={(e) => setRngLevel(Number(e.target.value))}
                    className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                  />
                </label>

                <label className="block">
                  <div className="text-xs text-neutral-400">Magic</div>
                  <input
                    type="number"
                    value={magLevel}
                    onChange={(e) => setMagLevel(Number(e.target.value))}
                    className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                  />
                </label>
              </div>
            </div>

            {/* GEAR */}
            <div className="mt-6 rounded-2xl border border-neutral-800 bg-black/40 p-4">
              <div className="text-sm font-semibold">Gear bonuses</div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <div className="text-xs text-neutral-400">Attack bonus (relevant)</div>
                  <input
                    type="number"
                    value={attackBonus}
                    onChange={(e) => setAttackBonus(Number(e.target.value))}
                    className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                  />
                </label>

                {style === "melee" && (
                  <label className="block">
                    <div className="text-xs text-neutral-400">Strength bonus</div>
                    <input
                      type="number"
                      value={strengthBonus}
                      onChange={(e) => setStrengthBonus(Number(e.target.value))}
                      className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                    />
                  </label>
                )}

                {style === "ranged" && (
                  <label className="block">
                    <div className="text-xs text-neutral-400">Ranged strength</div>
                    <input
                      type="number"
                      value={rangedStrength}
                      onChange={(e) => setRangedStrength(Number(e.target.value))}
                      className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                    />
                  </label>
                )}

                {style === "magic" && (
                  <label className="block">
                    <div className="text-xs text-neutral-400">Magic dmg %</div>
                    <input
                      type="number"
                      value={magicDamagePct}
                      onChange={(e) => setMagicDamagePct(Number(e.target.value))}
                      className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* BUFFS */}
            <div className="mt-6 rounded-2xl border border-neutral-800 bg-black/40 p-4">
              <div className="text-sm font-semibold">Buffs</div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <div className="text-xs text-neutral-400">Potion</div>
                  <select
                    value={potion}
                    onChange={(e) => setPotion(e.target.value as Potion)}
                    className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                  >
                    <option value="none">None</option>
                    <option value="super_combat">Super combat</option>
                    <option value="divine_super_combat">Divine super combat</option>
                    <option value="ranging">Ranging</option>
                    <option value="divine_ranging">Divine ranging</option>
                    <option value="magic">Magic</option>
                    <option value="divine_magic">Divine magic</option>
                  </select>
                </label>

                {style === "melee" && (
                  <label className="block">
                    <div className="text-xs text-neutral-400">Melee prayer</div>
                    <select
                      value={inputs.meleePrayer}
                      onChange={(e) => setMeleePrayer(e.target.value as MeleePrayer)}
                      className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                    >
                      <option value="none">None</option>
                      <option value="burst_of_strength">Burst of Strength</option>
                      <option value="superhuman_strength">Superhuman Strength</option>
                      <option value="ultimate_strength">Ultimate Strength</option>
                      <option value="chivalry">Chivalry</option>
                      <option value="piety">Piety</option>
                    </select>
                  </label>
                )}

                {style === "ranged" && (
                  <label className="block">
                    <div className="text-xs text-neutral-400">Ranged prayer</div>
                    <select
                      value={inputs.rangedPrayer}
                      onChange={(e) => setRangedPrayer(e.target.value as RangedPrayer)}
                      className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                    >
                      <option value="none">None</option>
                      <option value="sharp_eye">Sharp Eye</option>
                      <option value="hawk_eye">Hawk Eye</option>
                      <option value="eagle_eye">Eagle Eye</option>
                      <option value="rigour">Rigour</option>
                    </select>
                  </label>
                )}

                {style === "magic" && (
                  <label className="block">
                    <div className="text-xs text-neutral-400">Magic prayer</div>
                    <select
                      value={inputs.magicPrayer}
                      onChange={(e) => setMagicPrayer(e.target.value as MagicPrayer)}
                      className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                    >
                      <option value="none">None</option>
                      <option value="mystic_will">Mystic Will</option>
                      <option value="mystic_lore">Mystic Lore</option>
                      <option value="mystic_might">Mystic Might</option>
                      <option value="augury">Augury</option>
                    </select>
                  </label>
                )}
              </div>
            </div>

            {/* TARGET */}
            <div className="mt-6 rounded-2xl border border-neutral-800 bg-black/40 p-4">
              <div className="text-sm font-semibold">Target</div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <div className="text-xs text-neutral-400">Target HP</div>
                  <input
                    type="number"
                    value={targetHp}
                    onChange={(e) => setTargetHp(Number(e.target.value))}
                    className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                  />
                </label>

                <label className="block">
                  <div className="text-xs text-neutral-400">Target Def level</div>
                  <input
                    type="number"
                    value={targetDefLevel}
                    onChange={(e) => setTargetDefLevel(Number(e.target.value))}
                    className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                  />
                </label>

                <label className="block">
                  <div className="text-xs text-neutral-400">Target Def bonus (relevant)</div>
                  <input
                    type="number"
                    value={targetDefBonus}
                    onChange={(e) => setTargetDefBonus(Number(e.target.value))}
                    className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                  />
                </label>
              </div>
            </div>
          </section>

          {/* RESULTS */}
          <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <div className="text-sm font-semibold">Results</div>

            <div className="mt-5 grid gap-3">
              <Row label="Max hit" value={String(result.maxHit)} />
              <Row label="Hit chance" value={fmtPct(result.pHit)} />
              <Row label="Avg hit (on successful hit)" value={fmt(result.avgHitOnSuccess)} />
              <Row label="Expected dmg / attack" value={fmt(result.expectedPerSwing)} />
              <Row label="Attack interval" value={`${fmt(result.secondsPerAttack)}s`} />
              <Row label="DPS" value={fmt(result.dps)} />
              <Row label="Time to kill" value={fmtTime(result.ttkSeconds)} />
            </div>

            <div className="mt-6 rounded-2xl border border-neutral-800 bg-black/40 p-4">
              <div className="text-xs text-neutral-400">Debug (optional)</div>
              <div className="mt-2 text-xs text-neutral-300">
                Attack roll: {fmt(result.attackRoll, 0)} • Defense roll: {fmt(result.defenseRoll, 0)}
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                v1 baseline model. Later you can add: prayers by exact style, enemy presets, Slayer/Salve/Void,
                spec cycles, bolt procs, poison/venom, multi-hit weapons, and real powered-staff formulas.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-black/40 px-4 py-3">
      <div className="text-sm text-neutral-300">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
