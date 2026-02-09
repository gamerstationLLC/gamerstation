"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * GamerStation WoW Quick Sim (SimC-lite)
 * Update:
 * ✅ Inputs now use the SAME "results-style" black cards for readability
 * ✅ Mobile remains compact + no overlap
 * ✅ Mobile tabs centered + sticky
 * ✅ Desktop columns independent (no deadspace stretching)
 *
 * Optional presets file (auto-load if present):
 * /public/data/wow/quick-sim-presets.json
 */

type DamageSchool = "PHYSICAL" | "MAGIC";
type Scaling = "AP_WDPS" | "SP" | "AP" | "SP_DOT";
type MasteryMode = "none" | "mult";

type AbilityPreset = {
  id: string;
  name: string;
  school: DamageSchool;
  scales: Scaling;
  base: number;
  apCoeff: number;
  spCoeff: number;
  wdpsCoeff: number;
  masteryMode: MasteryMode;
  baseUpm: number;
  hasteAffectsRate: boolean;
  tags?: Array<"burst">;
};

type SpecPreset = {
  id: string;
  name: string;
  className: string;
  abilities: AbilityPreset[];
};

type PresetsFile = {
  version: string;
  specs: SpecPreset[];
};

const BUILTIN_PRESETS: PresetsFile = {
  version: "quick-sim-v1",
  specs: [
    {
      id: "arms_warrior",
      className: "Warrior",
      name: "Arms",
      abilities: [
        {
          id: "mortal_strike",
          name: "Mortal Strike",
          school: "PHYSICAL",
          scales: "AP_WDPS",
          base: 0,
          apCoeff: 0.55,
          spCoeff: 0,
          wdpsCoeff: 1.6,
          masteryMode: "mult",
          baseUpm: 8,
          hasteAffectsRate: true,
        },
        {
          id: "overpower",
          name: "Overpower",
          school: "PHYSICAL",
          scales: "AP_WDPS",
          base: 0,
          apCoeff: 0.35,
          spCoeff: 0,
          wdpsCoeff: 1.0,
          masteryMode: "mult",
          baseUpm: 10,
          hasteAffectsRate: true,
        },
        {
          id: "execute",
          name: "Execute (burst window)",
          school: "PHYSICAL",
          scales: "AP_WDPS",
          base: 0,
          apCoeff: 0.95,
          spCoeff: 0,
          wdpsCoeff: 2.1,
          masteryMode: "mult",
          baseUpm: 6,
          hasteAffectsRate: true,
          tags: ["burst"],
        },
      ],
    },
    {
      id: "fire_mage",
      className: "Mage",
      name: "Fire",
      abilities: [
        {
          id: "fireball",
          name: "Fireball",
          school: "MAGIC",
          scales: "SP",
          base: 0,
          apCoeff: 0,
          spCoeff: 0.9,
          wdpsCoeff: 0,
          masteryMode: "mult",
          baseUpm: 10,
          hasteAffectsRate: true,
        },
        {
          id: "pyroblast",
          name: "Pyroblast (burst window)",
          school: "MAGIC",
          scales: "SP",
          base: 0,
          apCoeff: 0,
          spCoeff: 1.45,
          wdpsCoeff: 0,
          masteryMode: "mult",
          baseUpm: 5,
          hasteAffectsRate: true,
          tags: ["burst"],
        },
        {
          id: "ignite_tick",
          name: "Ignite (DoT tick)",
          school: "MAGIC",
          scales: "SP_DOT",
          base: 0,
          apCoeff: 0,
          spCoeff: 0.15,
          wdpsCoeff: 0,
          masteryMode: "mult",
          baseUpm: 60,
          hasteAffectsRate: false,
        },
      ],
    },
  ],
};

type TabKey = "inputs" | "results";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function fmt(n: number, digits = 0) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}
function pctToMult(pct: number) {
  return 1 + pct / 100;
}
function effectiveCritMultiplier(critDamageBonusPct: number) {
  return 2 * (1 + critDamageBonusPct / 100);
}
function expectedDamageMultiplierFromCrit(
  critChancePct: number,
  critMult: number
) {
  const c = clamp(critChancePct / 100, 0, 1);
  return (1 - c) * 1 + c * critMult;
}
function safeNum(n: number, fallback = 0) {
  return Number.isFinite(n) ? n : fallback;
}

type CalcInputs = {
  mainStat: number;
  apFromMain: number;
  spFromMain: number;
  weaponDps: number;

  critPct: number;
  hastePct: number;
  masteryPct: number;
  versPct: number;
  critDamageBonusPct: number;

  armorDrPct: number;
  magicDrPct: number;

  burstUptimePct: number;

  raidBuffPct: number;
  consumablePct: number;
  externalMultPct: number;

  upmOverrides: Record<string, number>;
};

function computeSpecDps(spec: SpecPreset, inp: CalcInputs) {
  const AP = safeNum(inp.mainStat) * safeNum(inp.apFromMain, 1);
  const SP = safeNum(inp.mainStat) * safeNum(inp.spFromMain, 1);

  const hasteMult = pctToMult(inp.hastePct);
  const versMult = pctToMult(inp.versPct);
  const masteryMult = pctToMult(inp.masteryPct);
  const critMult = effectiveCritMultiplier(inp.critDamageBonusPct);
  const expectedCritMult = expectedDamageMultiplierFromCrit(inp.critPct, critMult);

  const burstUptime = clamp(inp.burstUptimePct / 100, 0, 1);

  const globalDamageMult =
    pctToMult(inp.raidBuffPct) *
    pctToMult(inp.consumablePct) *
    pctToMult(inp.externalMultPct);

  const rows = spec.abilities.map((a) => {
    const upmBase = inp.upmOverrides[a.id] ?? a.baseUpm;
    const upmEff =
      (a.hasteAffectsRate ? upmBase * hasteMult : upmBase) *
      (a.tags?.includes("burst") ? burstUptime : 1);

    const ups = clamp(upmEff, 0, 99999) / 60;

    const raw =
      a.base +
      a.apCoeff * AP +
      a.spCoeff * SP +
      a.wdpsCoeff * safeNum(inp.weaponDps);

    const masteryApplied = a.masteryMode === "mult" ? masteryMult : 1;

    const baseHit = raw * masteryApplied * versMult * globalDamageMult;
    const expectedHit = baseHit * expectedCritMult;

    const dr =
      a.school === "PHYSICAL"
        ? clamp(inp.armorDrPct / 100, 0, 0.95)
        : clamp(inp.magicDrPct / 100, 0, 0.95);

    const expectedAfterMit = expectedHit * (1 - dr);
    const dps = expectedAfterMit * ups;

    return {
      ability: a,
      upmBase,
      upmEff,
      expectedAfterMit,
      dps,
    };
  });

  rows.sort((a, b) => b.dps - a.dps);
  const totalDps = rows.reduce(
    (sum, r) => sum + (Number.isFinite(r.dps) ? r.dps : 0),
    0
  );

  return { totalDps, rows, AP, SP };
}

/* =========================
   UI Helpers
========================= */

function SmallNumberInput(props: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  widthClass?: string;
  disabled?: boolean;
}) {
  const {
    value,
    onChange,
    min,
    max,
    step,
    suffix,
    widthClass = "w-24",
    disabled,
  } = props;

  return (
    <div className="flex items-center gap-2">
      <input
        className={[
          widthClass,
          "h-9 rounded-xl border border-neutral-800 bg-black px-3 text-sm text-neutral-100 outline-none transition",
          "focus:border-neutral-600",
          disabled ? "opacity-60" : "",
        ].join(" ")}
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        inputMode="decimal"
      />
      {suffix ? <span className="text-xs text-neutral-500">{suffix}</span> : null}
    </div>
  );
}

/**
 * Inputs card styled like results cards (black background + inner border)
 * ✅ FIX: include children in props to remove TS errors.
 */
function InputCard(props: {
  title: string;
  right?: ReactNode;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-black/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-200">{props.title}</div>
          {props.sub ? (
            <div className="mt-1 text-xs text-neutral-500 leading-snug">
              {props.sub}
            </div>
          ) : null}
        </div>
        {props.right ? <div className="shrink-0">{props.right}</div> : null}
      </div>

      {props.children ? <div className="mt-3">{props.children}</div> : null}
    </div>
  );
}

/**
 * Compact mobile-friendly row INSIDE an InputCard:
 * label on left, input on right, no overlap, tight spacing.
 */
function InputRow(props: { label: string; control: ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-black/30 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-neutral-200 leading-tight break-words">
            {props.label}
          </div>
          {props.sub ? (
            <div className="mt-1 text-[11px] text-neutral-500 leading-snug break-words">
              {props.sub}
            </div>
          ) : null}
        </div>
        <div className="shrink-0">{props.control}</div>
      </div>
    </div>
  );
}

/* =========================
   Component
========================= */

export default function WowDamageCalcClient() {
  const [tab, setTab] = useState<TabKey>("inputs");

  const [presets, setPresets] = useState<PresetsFile>(BUILTIN_PRESETS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/wow/quick-sim-presets.json", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as PresetsFile;
        if (!cancelled && json?.specs?.length) setPresets(json);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [specId, setSpecId] = useState<string>(
    presets.specs[0]?.id ?? "arms_warrior"
  );

  useEffect(() => {
    if (!presets.specs.some((s) => s.id === specId)) {
      setSpecId(presets.specs[0]?.id ?? "arms_warrior");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets]);

  const spec = useMemo(
    () => presets.specs.find((s) => s.id === specId) ?? presets.specs[0]!,
    [presets, specId]
  );

  // Inputs
  const [mainStat, setMainStat] = useState<number>(12000);
  const [weaponDps, setWeaponDps] = useState<number>(520);
  const [apFromMain, setApFromMain] = useState<number>(1.0);
  const [spFromMain, setSpFromMain] = useState<number>(1.0);

  const [critPct, setCritPct] = useState<number>(25);
  const [hastePct, setHastePct] = useState<number>(18);
  const [masteryPct, setMasteryPct] = useState<number>(18);
  const [versPct, setVersPct] = useState<number>(8);
  const [critDamageBonusPct, setCritDamageBonusPct] = useState<number>(0);

  const [armorDrPct, setArmorDrPct] = useState<number>(30);
  const [magicDrPct, setMagicDrPct] = useState<number>(0);

  const [burstUptimePct, setBurstUptimePct] = useState<number>(25);

  const [raidBuffPct, setRaidBuffPct] = useState<number>(0);
  const [consumablePct, setConsumablePct] = useState<number>(0);
  const [externalMultPct, setExternalMultPct] = useState<number>(0);

  const [upmOverrides, setUpmOverrides] = useState<Record<string, number>>({});

  useEffect(() => {
    setUpmOverrides((prev) => {
      const next: Record<string, number> = { ...prev };
      for (const a of spec.abilities) {
        if (next[a.id] == null) next[a.id] = a.baseUpm;
      }
      const allowed = new Set(spec.abilities.map((a) => a.id));
      for (const k of Object.keys(next)) if (!allowed.has(k)) delete next[k];
      return next;
    });
  }, [specId, spec.abilities]);

  const baseInputs: CalcInputs = {
    mainStat,
    apFromMain,
    spFromMain,
    weaponDps,

    critPct,
    hastePct,
    masteryPct,
    versPct,
    critDamageBonusPct,

    armorDrPct,
    magicDrPct,

    burstUptimePct,

    raidBuffPct,
    consumablePct,
    externalMultPct,

    upmOverrides,
  };

  const computed = useMemo(() => computeSpecDps(spec, baseInputs), [spec, baseInputs]);

  const card =
    "rounded-2xl border border-neutral-800 bg-neutral-950/60 shadow-[0_0_40px_rgba(0,0,0,0.35)]";

  const Tabs = (
    <div className="mx-auto w-full max-w-xl">
      <div className="flex w-full rounded-2xl border border-neutral-800 bg-neutral-950 p-1">
        <button
          type="button"
          onClick={() => setTab("inputs")}
          className={[
            "flex-1 rounded-xl px-3 py-2 text-sm transition",
            tab === "inputs" ? "bg-black text-white" : "text-neutral-300 hover:text-white",
          ].join(" ")}
        >
          Inputs
        </button>
        <button
          type="button"
          onClick={() => setTab("results")}
          className={[
            "flex-1 rounded-xl px-3 py-2 text-sm transition",
            tab === "results" ? "bg-black text-white" : "text-neutral-300 hover:text-white",
          ].join(" ")}
        >
          Results
        </button>
      </div>
    </div>
  );

  const InputsPanel = (
    <div className={`${card} p-3 sm:p-5`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-bold text-neutral-200">Quick Sim Inputs</div>
        <div className="hidden sm:block text-xs text-neutral-500">
          Stats + UPM → sim-like DPS breakdown.
        </div>
      </div>

      <div className="space-y-3">
        <InputCard
          title="Spec Preset"
          sub="Loads a curated ability list for sim-like DPS breakdown."
          right={
            <select
              className="h-9 w-44 max-w-[60vw] rounded-xl border border-neutral-800 bg-black px-3 text-sm text-neutral-100 outline-none focus:border-neutral-600"
              value={specId}
              onChange={(e) => setSpecId(e.target.value)}
            >
              {presets.specs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.className} — {s.name}
                </option>
              ))}
            </select>
          }
        />

        <InputCard title="Character Stats" sub="Quick inputs (fast sim feel).">
          <div className="grid gap-2 sm:grid-cols-2">
            <InputRow
              label="Main Stat"
              control={
                <SmallNumberInput
                  value={mainStat}
                  onChange={setMainStat}
                  step={50}
                  widthClass="w-24"
                />
              }
            />
            <InputRow
              label="Weapon DPS"
              sub="Only affects weapon-scaled abilities."
              control={
                <SmallNumberInput
                  value={weaponDps}
                  onChange={setWeaponDps}
                  step={5}
                  widthClass="w-24"
                />
              }
            />

            <InputRow
              label="Crit %"
              control={
                <SmallNumberInput
                  value={critPct}
                  onChange={setCritPct}
                  step={0.5}
                  widthClass="w-20"
                  suffix="%"
                />
              }
            />
            <InputRow
              label="Haste %"
              sub="Scales UPM for haste→rate abilities."
              control={
                <SmallNumberInput
                  value={hastePct}
                  onChange={setHastePct}
                  step={0.5}
                  widthClass="w-20"
                  suffix="%"
                />
              }
            />

            <InputRow
              label="Mastery %"
              control={
                <SmallNumberInput
                  value={masteryPct}
                  onChange={setMasteryPct}
                  step={0.5}
                  widthClass="w-20"
                  suffix="%"
                />
              }
            />
            <InputRow
              label="Vers %"
              control={
                <SmallNumberInput
                  value={versPct}
                  onChange={setVersPct}
                  step={0.5}
                  widthClass="w-20"
                  suffix="%"
                />
              }
            />

            <InputRow
              label="Crit Bonus %"
              sub="Optional. Base crit 2.0×."
              control={
                <SmallNumberInput
                  value={critDamageBonusPct}
                  onChange={setCritDamageBonusPct}
                  step={0.5}
                  widthClass="w-20"
                  suffix="%"
                />
              }
            />
            <InputRow
              label="Burst Uptime %"
              sub="Applies to burst-tagged abilities."
              control={
                <SmallNumberInput
                  value={burstUptimePct}
                  onChange={setBurstUptimePct}
                  step={1}
                  widthClass="w-20"
                  suffix="%"
                />
              }
            />
          </div>

          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-neutral-300">
              Advanced (AP/SP multipliers)
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <InputRow
                label="AP per Main"
                control={
                  <SmallNumberInput
                    value={apFromMain}
                    onChange={setApFromMain}
                    step={0.05}
                    widthClass="w-20"
                  />
                }
              />
              <InputRow
                label="SP per Main"
                control={
                  <SmallNumberInput
                    value={spFromMain}
                    onChange={setSpFromMain}
                    step={0.05}
                    widthClass="w-20"
                  />
                }
              />
            </div>
          </details>
        </InputCard>

        <InputCard title="Target Reduction" sub="Set DR for what you’re testing.">
          <div className="grid gap-2 sm:grid-cols-2">
            <InputRow
              label="Armor DR %"
              sub="PHYSICAL only."
              control={
                <SmallNumberInput
                  value={armorDrPct}
                  onChange={setArmorDrPct}
                  step={0.5}
                  widthClass="w-20"
                  suffix="%"
                />
              }
            />
            <InputRow
              label="Magic DR %"
              sub="MAGIC only."
              control={
                <SmallNumberInput
                  value={magicDrPct}
                  onChange={setMagicDrPct}
                  step={0.5}
                  widthClass="w-20"
                  suffix="%"
                />
              }
            />
          </div>
        </InputCard>

        <InputCard title="Buffs / Multipliers" sub="Optional external amps (kept explainable).">
          <div className="grid gap-2 sm:grid-cols-2">
            <InputRow
              label="Raid Buff %"
              control={
                <SmallNumberInput
                  value={raidBuffPct}
                  onChange={setRaidBuffPct}
                  step={0.5}
                  widthClass="w-20"
                  suffix="%"
                />
              }
            />
            <InputRow
              label="Consumables %"
              control={
                <SmallNumberInput
                  value={consumablePct}
                  onChange={setConsumablePct}
                  step={0.5}
                  widthClass="w-20"
                  suffix="%"
                />
              }
            />
            <div className="sm:col-span-2">
              <InputRow
                label="Custom Mult %"
                sub="Any external damage amp/boss debuff."
                control={
                  <SmallNumberInput
                    value={externalMultPct}
                    onChange={setExternalMultPct}
                    step={0.5}
                    widthClass="w-24"
                    suffix="%"
                  />
                }
              />
            </div>
          </div>
        </InputCard>

        <InputCard
          title="Rotation (UPM)"
          sub="Effective UPM includes haste + burst uptime (for burst-tagged abilities)."
        >
          <div className="space-y-2">
            {spec.abilities.map((a) => {
              const upmVal = upmOverrides[a.id] ?? a.baseUpm;
              const hasteMult = pctToMult(hastePct);
              const upmEff =
                (a.hasteAffectsRate ? upmVal * hasteMult : upmVal) *
                (a.tags?.includes("burst") ? clamp(burstUptimePct / 100, 0, 1) : 1);

              return (
                <div
                  key={a.id}
                  className="rounded-xl border border-neutral-800 bg-black/30 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {a.name}
                      </div>
                      <div className="mt-1 text-[11px] text-neutral-400">
                        {a.school}
                        {a.hasteAffectsRate ? " • haste→rate" : ""}
                        {a.tags?.includes("burst") ? " • burst" : ""}
                      </div>
                    </div>

                    <SmallNumberInput
                      value={upmVal}
                      onChange={(v) =>
                        setUpmOverrides((prev) => ({
                          ...prev,
                          [a.id]: v,
                        }))
                      }
                      step={1}
                      widthClass="w-20"
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
                    <span>Eff UPM</span>
                    <span className="font-semibold text-neutral-200">{fmt(upmEff, 2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </InputCard>
      </div>
    </div>
  );

  const ResultsPanel = (
    <div className={`${card} p-3 sm:p-5`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-bold text-neutral-200">Results</div>
        <div className="hidden sm:block text-xs text-neutral-500">
          {spec.className} — {spec.name}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-black p-4">
        <div className="text-xs text-neutral-400">Total DPS (Quick Sim)</div>
        <div className="mt-1 text-3xl font-black">{fmt(computed.totalDps, 1)}</div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-neutral-800 bg-black/40 p-3">
            <div className="text-xs text-neutral-500">Derived AP</div>
            <div className="font-bold">{fmt(computed.AP, 0)}</div>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-black/40 p-3">
            <div className="text-xs text-neutral-500">Derived SP</div>
            <div className="font-bold">{fmt(computed.SP, 0)}</div>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-neutral-500">
          Fast sim vibe: expected hit × rate. Not a full rotation/resource sim.
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-800 bg-black/40 p-4">
        <div className="text-sm font-semibold text-neutral-200">DPS Breakdown</div>
        <div className="mt-2 text-xs text-neutral-500">
          Sorted by contribution (UPM already includes haste + burst uptime).
        </div>

        <div className="mt-3 space-y-2">
          {computed.rows.map((r) => {
            const pct = computed.totalDps > 0 ? (r.dps / computed.totalDps) * 100 : 0;

            return (
              <div
                key={r.ability.id}
                className="rounded-xl border border-neutral-800 bg-black/30 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {r.ability.name}
                    </div>
                    <div className="mt-1 text-[11px] text-neutral-400">
                      {r.ability.school}
                      {r.ability.hasteAffectsRate ? " • haste→rate" : ""}
                      {r.ability.tags?.includes("burst") ? " • burst" : ""}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] text-neutral-400">DPS</div>
                    <div className="text-lg font-black">{fmt(r.dps, 1)}</div>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border border-neutral-800 bg-black/40 p-2">
                    <div className="text-[11px] text-neutral-500">Expected Hit</div>
                    <div className="font-semibold text-neutral-200">
                      {fmt(r.expectedAfterMit, 0)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-neutral-800 bg-black/40 p-2">
                    <div className="text-[11px] text-neutral-500">Eff UPM</div>
                    <div className="font-semibold text-neutral-200">{fmt(r.upmEff, 2)}</div>
                  </div>
                  <div className="rounded-lg border border-neutral-800 bg-black/40 p-2">
                    <div className="text-[11px] text-neutral-500">Share</div>
                    <div className="font-semibold text-neutral-200">{fmt(pct, 1)}%</div>
                  </div>
                </div>

                <div className="mt-2 h-2 w-full overflow-hidden rounded-full border border-neutral-800 bg-black/40">
                  <div
                    className="h-full bg-white/20"
                    style={{ width: `${clamp(pct, 0, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 text-xs text-neutral-500">
        Disclaimer: Approximation. Real WoW damage depends on talents, spec mechanics, buffs/debuffs, target scaling,
        procs, and encounter effects.
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Mobile sticky tabs */}
      <div className="sm:hidden sticky top-3 z-30">
        <div className="mx-auto w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-950/90 backdrop-blur p-2">
          {Tabs}
        </div>
      </div>

      {/* Mobile tab content */}
      <div className="sm:hidden space-y-4">{tab === "inputs" ? InputsPanel : ResultsPanel}</div>

      {/* Desktop: independent columns */}
      <div className="hidden sm:grid gap-4 items-start lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="self-start">{InputsPanel}</div>
        <div className="self-start">{ResultsPanel}</div>
      </div>
    </div>
  );
}
