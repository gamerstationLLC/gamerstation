"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

function num(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function DpsPage() {
  const [damagePerHit, setDamagePerHit] = useState("30");
  const [rpm, setRpm] = useState("600");
  const [accuracyPct, setAccuracyPct] = useState("100");
  const [critChancePct, setCritChancePct] = useState("0");
  const [critMultiplier, setCritMultiplier] = useState("2");

  const results = useMemo(() => {
    const dmg = Math.max(0, num(damagePerHit));
    const r = Math.max(0, num(rpm));
    const acc = clamp(num(accuracyPct) / 100, 0, 1);
    const crit = clamp(num(critChancePct) / 100, 0, 1);
    const critMult = Math.max(1, num(critMultiplier));

    const shotsPerSecond = r / 60;

    // Expected damage per hit (accounts for crits + accuracy)
    const expectedDamagePerHit = dmg * ((1 - crit) + crit * critMult) * acc;

    const dps = expectedDamagePerHit * shotsPerSecond;

    return { shotsPerSecond, expectedDamagePerHit, dps };
  }, [damagePerHit, rpm, accuracyPct, critChancePct, critMultiplier]);

  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  const backLink =
    "inline-flex w-fit items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 hover:underline underline-offset-4";

  return (
    <main className="min-h-screen bg-transparent text-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* âœ… Standard header: brand left, top-right pills = Tools + Calculators */}
        <header className="flex items-center gap-3">
  {/* Brand left */}
  <Link href="/" className="flex items-center gap-2 hover:opacity-90">
            <img
              src="/gs-logo-v2.png"
              alt="GamerStation"
              className="
                h-10 w-10 rounded-xl bg-black p-1
                shadow-[0_0_30px_rgba(0,255,255,0.35)]
              "
            />
            <span className="text-lg font-black tracking-tight">
              GamerStation<span className="align-super text-[0.6em]">TM</span>
            </span>
          </Link>


  {/* Top-right: ONLY Calculators */}
  <div className="ml-auto">
    <Link
      href="/calculators"
      className="
        rounded-xl border border-neutral-800
        bg-black px-4 py-2 text-sm text-neutral-200
        transition
        hover:border-neutral-600
        hover:text-white
        hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]
      "
    >
      Calculators
    </Link>
  </div>
</header>


        <div className="mt-2 text-sm text-neutral-500">Universal DPS</div>

        {/* Title + blurb */}
        <div className="mt-6">
          <h1 className="text-3xl font-bold">DPS Calculator</h1>

          <p className="mt-2 max-w-2xl text-neutral-300">
            Works for most games. Enter damage + RPM, optionally include accuracy and crits.
          </p>

          
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Inputs */}
          <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
            <h2 className="text-sm font-semibold">Inputs</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Damage per hit"
                value={damagePerHit}
                onChange={setDamagePerHit}
                hint="e.g. 30"
              />
              <Field
                label="Rate of fire (RPM)"
                value={rpm}
                onChange={setRpm}
                hint="e.g. 600"
              />
              <Field
                label="Accuracy (%)"
                value={accuracyPct}
                onChange={setAccuracyPct}
                hint="0â€“100"
              />
              <Field
                label="Crit chance (%)"
                value={critChancePct}
                onChange={setCritChancePct}
                hint="0â€“100"
              />
              <Field
                label="Crit multiplier"
                value={critMultiplier}
                onChange={setCritMultiplier}
                hint="2 = double dmg"
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <PresetButton
                onClick={() => {
                  setDamagePerHit("30");
                  setRpm("600");
                  setAccuracyPct("100");
                  setCritChancePct("0");
                  setCritMultiplier("2");
                }}
                label="FPS baseline"
              />
              <PresetButton
                onClick={() => {
                  setDamagePerHit("120");
                  setRpm("60");
                  setAccuracyPct("85");
                  setCritChancePct("15");
                  setCritMultiplier("2");
                }}
                label="RPG baseline"
              />
              <PresetButton
                onClick={() => {
                  setDamagePerHit("0");
                  setRpm("0");
                  setAccuracyPct("100");
                  setCritChancePct("0");
                  setCritMultiplier("2");
                }}
                label="Clear"
              />
            </div>

            <div className="mt-5 rounded-lg border border-neutral-800 bg-black/40 p-4 text-xs text-neutral-300">
              Formula: <b>DPS = (Damage Ã— CritFactor Ã— Accuracy) Ã— (RPM Ã· 60)</b>
            </div>
          </section>

          {/* Results */}
          <section className="h-fit self-start rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
            <h2 className="text-sm font-semibold">Results</h2>

            <div className="mt-4 grid gap-4">
              <ResultRow label="Shots per second" value={results.shotsPerSecond.toFixed(2)} />
              <ResultRow
                label="Expected damage per hit"
                value={results.expectedDamagePerHit.toFixed(2)}
              />
              <ResultRow label="Estimated DPS" value={results.dps.toFixed(2)} />
            </div>

            <p className="mt-6 text-xs text-neutral-500">
              Note: Real DPS depends on reloads, recoil, drop-off, armor, buffs, headshots, and hit
              registration.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-neutral-300">{label}</span>
      <input
        className="rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder={hint}
      />
      {hint ? <span className="text-[11px] text-neutral-500">{hint}</span> : null}
    </label>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-black/40 px-4 py-3">
      <div className="text-sm text-neutral-300">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-neutral-800 bg-black/40 px-3 py-2 text-xs text-neutral-200 hover:border-neutral-600"
    >
      {label}
    </button>
  );
}
