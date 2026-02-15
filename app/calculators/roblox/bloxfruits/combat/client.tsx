"use client";

import { useMemo, useState } from "react";

type Mode = "pve" | "pvp";
type Primary = "fruit" | "sword" | "gun" | "style";
type Tab = "inputs" | "results";

function fmt(n: number, digits = 1) {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function toNum(s: string) {
  const t = s.trim();
  if (t === "") return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const DEFAULT_STYLES = [
  "Godhuman",
  "Sharkman Karate",
  "Electric Claw",
  "Dragon Talon",
  "Death Step",
  "Superhuman",
  "Sanguine Art",
];

export default function BloxFruitsCombatClient() {
  // Tabs (mobile)
  const [tab, setTab] = useState<Tab>("inputs");

  // Core components
  const [mode, setMode] = useState<Mode>("pve");
  const [primary, setPrimary] = useState<Primary>("fruit");

  // Slot labels (manual, optional)
  const [fruitName, setFruitName] = useState("");
  const [swordName, setSwordName] = useState("");
  const [gunName, setGunName] = useState("");
  const [accessoryName, setAccessoryName] = useState("");

  // Fighting style
  const [styleName, setStyleName] = useState(DEFAULT_STYLES[0]);
  const [customStyle, setCustomStyle] = useState("");

  const activeStyle = (customStyle.trim() ? customStyle.trim() : styleName).slice(0, 40);

  // Stats distribution (strings so user can delete input)
  const [statMelee, setStatMelee] = useState("0");
  const [statSword, setStatSword] = useState("0");
  const [statGun, setStatGun] = useState("0");
  const [statFruit, setStatFruit] = useState("0");

  // Combat knobs (transparent v1)
  const [targetHp, setTargetHp] = useState("100000");
  const [baseDamagePerHit, setBaseDamagePerHit] = useState("5000");
  const [hitsPerSecond, setHitsPerSecond] = useState("2");

  // Accessory buffs (manual optional)
  const [accDamagePct, setAccDamagePct] = useState("0");
  const [accCooldownPct, setAccCooldownPct] = useState("0");
  const [accDefensePct, setAccDefensePct] = useState("0");
  const [accSpeedPct, setAccSpeedPct] = useState("0");
  const [accEnergyPct, setAccEnergyPct] = useState("0");
  const [accXpPct, setAccXpPct] = useState("0");

  // ✅ FIX: strongly type rows so TS doesn't infer setVal as a renderable union
  const accessoryRows: Array<
    [label: string, val: string, setVal: React.Dispatch<React.SetStateAction<string>>]
  > = [
    ["Damage %", accDamagePct, setAccDamagePct],
    ["Cooldown %", accCooldownPct, setAccCooldownPct],
    ["Defense %", accDefensePct, setAccDefensePct],
    ["Speed %", accSpeedPct, setAccSpeedPct],
    ["Energy %", accEnergyPct, setAccEnergyPct],
    ["XP %", accXpPct, setAccXpPct],
  ];

  // Relevant stat
  const relevantStat = useMemo(() => {
    const melee = toNum(statMelee);
    const sword = toNum(statSword);
    const gun = toNum(statGun);
    const fruit = toNum(statFruit);

    if (primary === "style") return Number.isFinite(melee) ? melee : 0;
    if (primary === "sword") return Number.isFinite(sword) ? sword : 0;
    if (primary === "gun") return Number.isFinite(gun) ? gun : 0;
    return Number.isFinite(fruit) ? fruit : 0;
  }, [primary, statMelee, statSword, statGun, statFruit]);

  // Parse accessory buffs (manual inputs)
  const acc = useMemo(() => {
    const damagePct = clamp(Number.isFinite(toNum(accDamagePct)) ? toNum(accDamagePct) : 0, 0, 999);
    const cooldownPct = clamp(Number.isFinite(toNum(accCooldownPct)) ? toNum(accCooldownPct) : 0, 0, 50);
    const defensePct = clamp(Number.isFinite(toNum(accDefensePct)) ? toNum(accDefensePct) : 0, 0, 999);
    const speedPct = clamp(Number.isFinite(toNum(accSpeedPct)) ? toNum(accSpeedPct) : 0, 0, 999);
    const energyPct = clamp(Number.isFinite(toNum(accEnergyPct)) ? toNum(accEnergyPct) : 0, 0, 999);
    const xpPct = clamp(Number.isFinite(toNum(accXpPct)) ? toNum(accXpPct) : 0, 0, 999);

    return { damagePct, cooldownPct, defensePct, speedPct, energyPct, xpPct };
  }, [accDamagePct, accCooldownPct, accDefensePct, accSpeedPct, accEnergyPct, accXpPct]);

  // conservative cooldown->rate multiplier
  const cooldownToRateMult = useMemo(() => {
    const c = acc.cooldownPct;
    const mult = 1 / (1 - clamp(c / 100, 0, 0.5));
    return Number.isFinite(mult) ? mult : 1;
  }, [acc.cooldownPct]);

  // Damage model
  const dmg = useMemo(() => {
    const base = toNum(baseDamagePerHit);
    if (!Number.isFinite(base) || base <= 0) return 0;

    const statMult = 1 + clamp(relevantStat / 5000, 0, 1.5);
    const accMult = 1 + (acc.damagePct || 0) / 100;

    return base * statMult * accMult;
  }, [baseDamagePerHit, relevantStat, acc.damagePct]);

  const rate = useMemo(() => {
    const hps = toNum(hitsPerSecond);
    if (!Number.isFinite(hps) || hps <= 0) return 0;
    return hps * cooldownToRateMult;
  }, [hitsPerSecond, cooldownToRateMult]);

  const dps = useMemo(() => {
    if (dmg <= 0 || rate <= 0) return 0;
    return dmg * rate;
  }, [dmg, rate]);

  const ttkSeconds = useMemo(() => {
    const hp = toNum(targetHp);
    if (!Number.isFinite(hp) || hp <= 0 || dps <= 0) return 0;
    return hp / dps;
  }, [targetHp, dps]);

  const primaryLabel = useMemo(() => {
    if (primary === "fruit") return fruitName.trim() || "—";
    if (primary === "sword") return swordName.trim() || "—";
    if (primary === "gun") return gunName.trim() || "—";
    return activeStyle || "—";
  }, [primary, fruitName, swordName, gunName, activeStyle]);

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

  const ResultsPanel = (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="text-sm font-semibold">Results</div>

      <div className="mt-5 grid gap-3">
        <div className="rounded-xl border border-neutral-800 bg-black p-4">
          <div className="text-xs text-neutral-500">Effective damage per hit</div>
          <div className="mt-1 text-2xl font-bold">{dmg > 0 ? fmt(dmg, 0) : "—"}</div>
          <div className="mt-1 text-xs text-neutral-500">
            Base × (1 + relevantStat/5000) × (1 + accessory damage%)
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black p-4">
          <div className="text-xs text-neutral-500">Effective hits per second</div>
          <div className="mt-1 text-2xl font-bold">{rate > 0 ? fmt(rate, 2) : "—"}</div>
          <div className="mt-1 text-xs text-neutral-500">Hits/sec × (cooldown effect, capped)</div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black p-4">
          <div className="text-xs text-neutral-500">DPS</div>
          <div className="mt-1 text-2xl font-bold">{dps > 0 ? fmt(dps, 0) : "—"}</div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black p-4">
          <div className="text-xs text-neutral-500">Time-to-kill</div>
          <div className="mt-1 text-2xl font-bold">{ttkSeconds > 0 ? `${fmt(ttkSeconds, 1)}s` : "—"}</div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black p-4">
          <div className="text-xs text-neutral-500">Accessory buffs (manual)</div>
          <ul className="mt-2 space-y-1 text-sm text-neutral-300">
            <li>
              <span className="text-neutral-400">damagePct:</span> {acc.damagePct}%
            </li>
            <li>
              <span className="text-neutral-400">cooldownPct:</span> {acc.cooldownPct}%
            </li>
            <li>
              <span className="text-neutral-400">defensePct:</span> {acc.defensePct}%
            </li>
            <li>
              <span className="text-neutral-400">speedPct:</span> {acc.speedPct}%
            </li>
            <li>
              <span className="text-neutral-400">energyPct:</span> {acc.energyPct}%
            </li>
            <li>
              <span className="text-neutral-400">xpPct:</span> {acc.xpPct}%
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-4 text-xs text-neutral-500">
        V1 is transparent: you enter base damage + hit rate. Items are labels for now; we can add real per-item defaults later.
      </div>
    </div>
  );

  const InputsPanel = (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="text-sm font-semibold">Inputs</div>
      <div className="mt-2 text-sm text-neutral-400">
        V1 uses transparent inputs (base damage + hit rate) and applies your selected stats + optional accessory buffs.
      </div>

      {/* Combat Inputs */}
      <div className="mt-6">
        <div className="text-sm font-semibold">Combat Inputs (v1)</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-neutral-300">
            Base damage per hit
            <input
              type="number"
              inputMode="numeric"
              value={baseDamagePerHit}
              onChange={(e) => setBaseDamagePerHit(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
            />
          </label>

          <label className="text-sm text-neutral-300">
            Hits per second
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={hitsPerSecond}
              onChange={(e) => setHitsPerSecond(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
            />
          </label>

          <label className="text-sm text-neutral-300 sm:col-span-2">
            Target HP
            <input
              type="number"
              inputMode="numeric"
              value={targetHp}
              onChange={(e) => setTargetHp(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
            />
          </label>
        </div>

        <div className="mt-2 text-xs text-neutral-500">
          Transparent + honest while we decide exact scaling rules for each weapon/style.
        </div>
      </div>

      {/* Accessory buffs manual */}
      <div className="mt-6">
        <div className="text-sm font-semibold">Accessory Buffs</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {accessoryRows.map(([label, val, setVal]) => (
            <label key={label} className="text-sm text-neutral-300">
              {label}
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
              />
            </label>
          ))}
        </div>

        <div className="mt-2 text-xs text-neutral-500">
          These don’t pretend to be authoritative — they let users model “I have X% damage accessory” cleanly.
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {/* Mobile tabs header */}
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
          <div className={["md:block", tab === "inputs" ? "block" : "hidden md:block"].join(" ")}>
            {InputsPanel}
          </div>
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
                  DPS: {dps > 0 ? fmt(dps, 0) : "—"} • TTK: {ttkSeconds > 0 ? `${fmt(ttkSeconds, 1)}s` : "—"}
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
