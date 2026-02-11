"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CATEGORIES,
  FORTNITE_WEAPONS,
  RARITIES,
  type Category,
  type FortniteWeapon,
  type Rarity,
} from "./weapons";

console.log("FORTNITE_WEAPONS:", FORTNITE_WEAPONS.length);
console.log("CATEGORIES:", CATEGORIES.map((c) => c.value));

const HP_PRESETS: { label: string; hp: number }[] = [
  { label: "No shield (100)", hp: 100 },
  { label: "50 shield (150)", hp: 150 },
  { label: "Full shield (200)", hp: 200 },
  { label: "Overshield-ish (250)", hp: 250 },
];

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function fmt(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export default function FortniteTTKClient() {
  // ✅ MOBILE ONLY tab state
  const [mobileTab, setMobileTab] = useState<"inputs" | "results">("inputs");

  // ✅ class selection
  const [weaponClass, setWeaponClass] = useState<Category>("assault_rifle");

  // ✅ rarity selection
  const [rarity, setRarity] = useState<Rarity>("rare");

  const weaponsForClass = useMemo(
    () => FORTNITE_WEAPONS.filter((w) => w.class === weaponClass),
    [weaponClass]
  );

  // ✅ weapon selection
  const [weaponId, setWeaponId] = useState<string>("");

  // ✅ initialize + keep weaponId valid when class changes
  useEffect(() => {
    if (weaponsForClass.length === 0) {
      setWeaponId("");
      return;
    }

    const stillValid = weaponId && weaponsForClass.some((w) => w.id === weaponId);
    if (!stillValid) {
      setWeaponId(weaponsForClass[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weaponClass, weaponsForClass.length]);

  const selectedWeapon: FortniteWeapon | undefined = useMemo(() => {
    return weaponsForClass.find((x) => x.id === weaponId) ?? weaponsForClass[0];
  }, [weaponId, weaponsForClass]);

  // Inputs
  const [targetHp, setTargetHp] = useState<number>(200);
  const [hsPct, setHsPct] = useState<number>(0); // 0-100

  // Weapon stats with rarity
  const bodyDmg = selectedWeapon ? selectedWeapon.damage[rarity] : 0;
  const hsMult = selectedWeapon ? selectedWeapon.headshotMultiplier : 1;
  const fireRate = selectedWeapon ? selectedWeapon.fireRate : 0;

  // Expected damage per shot given expected headshot %
  const hsFrac = clamp(hsPct, 0, 100) / 100;
  const expectedDamage = bodyDmg * (1 - hsFrac) + bodyDmg * hsMult * hsFrac;

  // Shots to kill + TTK
  const shotsToKill = expectedDamage > 0 ? Math.ceil(targetHp / expectedDamage) : NaN;

  // Fortnite timing model baseline: first shot at t=0, next at 1/fireRate, etc.
  const ttkSeconds =
    fireRate > 0 && Number.isFinite(shotsToKill) ? Math.max(0, shotsToKill - 1) / fireRate : NaN;

  const ttkLabel = Number.isFinite(ttkSeconds) ? `${fmt(ttkSeconds, 3)}s` : "—";

  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  return (
    <main
      className="
        min-h-screen bg-transparent text-white px-6
        pt-12 pb-[calc(92px+env(safe-area-inset-bottom))]
        lg:py-12
      "
    >
      <div className="mx-auto max-w-6xl">
        {/* ✅ Standard GS header (slightly larger like Calculators page) */}
        <header className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/gs-logo-v2.png"
              alt="GamerStation"
              className="
                h-10 w-10 rounded-xl bg-black p-1
                shadow-[0_0_30px_rgba(0,255,255,0.35)]
              "
            />
            <span className="text-lg font-black tracking-tight">
              GamerStation<span className="align-super text-[0.6em]">™</span>
            </span>
          </Link>

          <div className="ml-auto">
            <Link href="/calculators" className={navBtn}>
              Calculators
            </Link>
          </div>
        </header>

        <div className="flex items-start justify-between gap-6">
          {/* Left side text */}
          <div>
            <h1 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight">
              Fortnite TTK Calculator
            </h1>

            <p className="mt-2 text-sm text-neutral-400 italic">
              Not affiliated with, endorsed by, or sponsored by Epic Games.
            </p>

            <p className="mt-3 text-neutral-300 max-w-2xl">
              Choose a weapon class, weapon, and rarity, then calculate shots-to-kill and time-to-kill.
              (Body damage + headshot multiplier + fire rate.)
            </p>

            {/* ✅ Added small evergreen note (keeps UI same, just extra line) */}
            <p className="mt-2 text-xs text-neutral-500 max-w-2xl">
              Weapon stats are a representative baseline set. Seasonal loot pools and balance changes may vary.
            </p>
          </div>
        </div>

        {/* ✅ small disclaimer above tabs (mobile only) */}
        <div className="mt-4 italic text-[11px] text-neutral-400 lg:hidden">
          Some values are approximations based on patch notes and testing.
        </div>

        {/* ✅ MOBILE ONLY: sticky Inputs/Results tabs */}
        <div className="lg:hidden sticky top-0 z-40 -mx-6 mt-4 px-6">
          <div className="rounded-2xl border border-neutral-800 bg-black/70 backdrop-blur ios-glass">
            <div className="flex gap-2 p-2">
              <button
                type="button"
                onClick={() => setMobileTab("inputs")}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
                  mobileTab === "inputs"
                    ? "bg-white/10 text-white"
                    : "bg-transparent text-neutral-300 hover:bg-white/5"
                }`}
              >
                Inputs
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("results")}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
                  mobileTab === "results"
                    ? "bg-white/10 text-white"
                    : "bg-transparent text-neutral-300 hover:bg-white/5"
                }`}
              >
                Results
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:items-start">
          {/* Inputs */}
          <section
            className={`rounded-2xl border border-neutral-800 bg-neutral-950 p-6 ${
              mobileTab === "inputs" ? "block" : "hidden"
            } lg:block`}
          >
            <h2 className="text-lg font-semibold">Inputs</h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {/* Weapon class */}
              <div>
                <label className="text-sm text-neutral-300">Weapon class</label>
                <select
                  value={weaponClass}
                  onChange={(e) => setWeaponClass(e.target.value as Category)}
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Weapon */}
              <div>
                <label className="text-sm text-neutral-300">Weapon</label>
                <select
                  value={weaponId}
                  onChange={(e) => setWeaponId(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                >
                  {weaponsForClass.length === 0 ? (
                    <option value="">No weapons found</option>
                  ) : (
                    weaponsForClass.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Rarity */}
              <div>
                <label className="text-sm text-neutral-300">Rarity</label>
                <select
                  value={rarity}
                  onChange={(e) => setRarity(e.target.value as Rarity)}
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                >
                  {RARITIES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target HP */}
              <div>
                <label className="text-sm text-neutral-300">Target HP</label>
                <input
                  value={targetHp}
                  onChange={(e) => setTargetHp(clamp(Number(e.target.value || 0), 1, 9999))}
                  type="number"
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {HP_PRESETS.map((p) => (
                    <button
                      key={p.hp}
                      onClick={() => setTargetHp(p.hp)}
                      className={`rounded-xl border px-3 py-1.5 text-xs ${
                        targetHp === p.hp
                          ? "border-neutral-500 bg-neutral-900"
                          : "border-neutral-800 bg-black hover:border-neutral-600"
                      }`}
                      type="button"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Headshot % */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <label className="text-sm text-neutral-300">Headshot % (expected)</label>
                <span className="text-sm text-neutral-200">{hsPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={hsPct}
                onChange={(e) => setHsPct(Number(e.target.value))}
                className="mt-3 w-full"
              />
              <div className="mt-1 text-xs text-neutral-500">0–100%</div>
            </div>

            {/* Selected weapon stats */}
            <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
              <div className="text-sm font-semibold">Selected weapon stats</div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-neutral-400">Body dmg</div>
                  <div className="font-semibold">{selectedWeapon ? bodyDmg : "—"}</div>
                </div>
                <div>
                  <div className="text-neutral-400">HS multiplier</div>
                  <div className="font-semibold">{selectedWeapon ? fmt(hsMult, 2) : "—"}</div>
                </div>
                <div>
                  <div className="text-neutral-400">Fire rate</div>
                  <div className="font-semibold">{selectedWeapon ? fmt(fireRate, 2) : "—"}</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-neutral-500">
                Rarity affects body damage. Headshots use multiplier on top of the selected rarity&apos;s base damage.
              </div>
            </div>

            <div className="mt-6 text-xs text-neutral-500">Note: Effective hit % will be added in future updates.</div>
          </section>

          {/* Results */}
          <section
            className={`rounded-2xl border border-neutral-800 bg-neutral-950 p-6 h-fit self-start ${
              mobileTab === "results" ? "block" : "hidden"
            } lg:block`}
          >
            <h2 className="text-lg font-semibold">Results</h2>

            <div className="mt-6 space-y-3">
              <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-neutral-300">Expected damage / shot</span>
                <span className="font-semibold">{fmt(expectedDamage, 2)}</span>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-neutral-300">Shots to kill</span>
                <span className="font-semibold">{Number.isFinite(shotsToKill) ? shotsToKill : "—"}</span>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-neutral-300">Time to kill (TTK)</span>
                <span className="font-semibold">{ttkLabel}</span>
              </div>

              <div className="mt-4 text-xs text-neutral-500">
                Note: Real fights vary with bloom, recoil, movement, latency, reloads, and missed shots. This is a clean
                baseline estimate.
              </div>

              <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
                <div className="text-sm font-semibold">Formula</div>
                <div className="mt-2 text-xs text-neutral-300 leading-relaxed">
                  ExpectedDamage = BaseDamage(rarity) × (1 − HS%) + BaseDamage(rarity) × HSMultiplier × HS%
                  <br />
                  ShotsToKill = ceil(TargetHP / ExpectedDamage)
                  <br />
                  TTK = (ShotsToKill − 1) / FireRate
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ✅ MOBILE ONLY: sticky bottom TTK bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        <div className="border-t border-neutral-800 bg-black/80 backdrop-blur">
          <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between gap-4">
            <button type="button" onClick={() => setMobileTab("results")} className="min-w-0 text-left">
              <div className="text-[11px] text-neutral-400">
                {selectedWeapon?.name ?? "—"} • {RARITIES.find((r) => r.value === rarity)?.label ?? rarity} • {targetHp}{" "}
                HP
              </div>
              <div className="truncate text-sm font-semibold">TTK: {ttkLabel}</div>
            </button>

            <button
              type="button"
              onClick={() => setMobileTab(mobileTab === "inputs" ? "results" : "inputs")}
              className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-200 hover:bg-white/10"
            >
              {mobileTab === "inputs" ? "View results" : "Edit inputs"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
