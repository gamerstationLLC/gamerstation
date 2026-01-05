"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChampionIndexRow, ItemRow } from "./page";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function fmt(n: number, digits = 1) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

/** ✅ Allow blank inputs that behave like 0 in math */
type Num = number | "";
const num0 = (v: Num) => (v === "" ? 0 : v);
const setNum =
  (setter: (v: Num) => void, min: number, max: number) =>
  (raw: string) => {
    if (raw === "") return setter("");
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    setter(clamp(n, min, max));
  };

type TargetPreset = {
  key: "squishy" | "bruiser" | "tank";
  label: string;
  hp: number;
  armor: number;
  mr: number;
};

const TARGET_PRESETS: TargetPreset[] = [
  { key: "squishy", label: "Squishy", hp: 1600, armor: 55, mr: 40 },
  { key: "bruiser", label: "Bruiser", hp: 2400, armor: 95, mr: 70 },
  { key: "tank", label: "Tank", hp: 3600, armor: 170, mr: 120 },
];

// Standard LoL damage multiplier for resists
function damageMultiplierFromResist(resist: number) {
  if (!Number.isFinite(resist)) return NaN;
  if (resist >= 0) return 100 / (100 + resist);
  return 2 - 100 / (100 - resist);
}

function effectiveHp(hp: number, resist: number) {
  const mult = damageMultiplierFromResist(resist);
  if (!Number.isFinite(mult) || mult <= 0) return NaN;
  return hp / mult;
}

// ✅ Parse Data Dragon stats (and apply the ones we can compute)
function itemTotals(selectedItems: ItemRow[]) {
  let hp = 0;
  let ad = 0;
  let ap = 0;
  let armor = 0;
  let mr = 0;
  let msFlat = 0;

  // attack speed is percent
  let asPct = 0;

  // crit
  let critChancePct = 0;

  // penetration
  let lethality = 0; // flat armor pen
  let armorPenPct = 0; // percent armor pen (0-100)
  let magicPenFlat = 0; // flat magic pen
  let magicPenPct = 0; // percent magic pen (0-100)

  // misc
  let abilityHaste = 0;
  let lifestealPct = 0;
  let omnivampPct = 0;

  for (const it of selectedItems) {
    const s = it.stats || {};

    hp += s.FlatHPPoolMod ?? 0;
    ad += s.FlatPhysicalDamageMod ?? 0;
    ap += s.FlatMagicDamageMod ?? 0;
    armor += s.FlatArmorMod ?? 0;
    mr += s.FlatSpellBlockMod ?? 0;
    msFlat += s.FlatMovementSpeedMod ?? 0;

    // Attack Speed is stored as a decimal (0.35 = 35%)
    asPct += (s.PercentAttackSpeedMod ?? 0) * 100;

    // Crit chance is usually a decimal
    critChancePct += (s.FlatCritChanceMod ?? 0) * 100;

    // Pen
    lethality += s.FlatArmorPenetrationMod ?? 0;
    armorPenPct += (s.PercentArmorPenetrationMod ?? 0) * 100;

    magicPenFlat += s.FlatMagicPenetrationMod ?? 0;
    magicPenPct += (s.PercentMagicPenetrationMod ?? 0) * 100;

    abilityHaste += s.FlatHasteMod ?? 0;

    lifestealPct += (s.PercentLifeStealMod ?? 0) * 100;
    omnivampPct += (s.PercentOmnivampMod ?? 0) * 100;
  }

  // Clamp sensible ranges
  critChancePct = clamp(critChancePct, 0, 100);
  armorPenPct = clamp(armorPenPct, 0, 100);
  magicPenPct = clamp(magicPenPct, 0, 100);

  return {
    hp,
    ad,
    ap,
    armor,
    mr,
    msFlat,
    asPct,

    critChancePct,
    lethality,
    armorPenPct,
    magicPenFlat,
    magicPenPct,

    abilityHaste,
    lifestealPct,
    omnivampPct,
  };
}

type Mode = "burst" | "dps";
type UiMode = "simple" | "advanced";

export default function LolClient({
  champions,
  patch,
  items,
}: {
  champions: ChampionIndexRow[];
  patch: string;
  items: ItemRow[];
}) {
  // ✅ Simple vs Advanced toggle
  const [uiMode, setUiMode] = useState<UiMode>("simple");
  const toggleUiMode = () =>
    setUiMode((prev) => (prev === "simple" ? "advanced" : "simple"));

  // Champion picker
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(champions[0]?.id ?? "");

  // Level
  const [level, setLevel] = useState<number>(1);

  // ✅ Target inputs allow blank
  const [targetHp, setTargetHp] = useState<Num>(2000);
  const [targetArmor, setTargetArmor] = useState<Num>(80);
  const [targetMr, setTargetMr] = useState<Num>(60);
  const [activePreset, setActivePreset] = useState<TargetPreset["key"] | null>(
    null
  );

  // ✅ Target champion + target level
  const [targetChampionId, setTargetChampionId] = useState<string>(""); // "" = custom/preset
  const [targetLevel, setTargetLevel] = useState<number>(1);
  const [targetLevelTouched, setTargetLevelTouched] = useState(false);

  // Items
  const [itemQuery, setItemQuery] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);

  // Advanced mode selection
  const [mode, setMode] = useState<Mode>("burst");

  // ✅ Advanced raw inputs allow blank
  const [burstPhysRaw, setBurstPhysRaw] = useState<Num>(300);
  const [burstMagicRaw, setBurstMagicRaw] = useState<Num>(200);
  const [burstTrueRaw, setBurstTrueRaw] = useState<Num>(0);

  const [dpsPhysRaw, setDpsPhysRaw] = useState<Num>(200);
  const [dpsMagicRaw, setDpsMagicRaw] = useState<Num>(0);
  const [dpsTrueRaw, setDpsTrueRaw] = useState<Num>(0);
  const [windowSec, setWindowSec] = useState<Num>(6);

  // ✅ Passive knobs allow blank
  const [onHitFlatMagic, setOnHitFlatMagic] = useState<Num>(0);
  const [onHitPctTargetMaxHpPhys, setOnHitPctTargetMaxHpPhys] =
    useState<Num>(0);
  const [critDamageMult, setCritDamageMult] = useState<Num>(2.0);

  // ✅ Simple controls allow blank
  const [simpleType, setSimpleType] = useState<Mode>("burst");
  const [simpleWindow, setSimpleWindow] = useState<Num>(6);
  const [simpleAAs, setSimpleAAs] = useState<Num>(6);

  const selected = useMemo(
    () => champions.find((c) => c.id === selectedId),
    [champions, selectedId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return champions.slice(0, 60);
    return champions
      .filter((c) => {
        const hay = `${c.name} ${c.title ?? ""} ${(c.tags ?? []).join(
          " "
        )}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 60);
  }, [champions, query]);

  // ✅ Auto-select first match if user types something that excludes current selection
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    if (filtered.some((c) => c.id === selectedId)) return;
    if (filtered[0]?.id) setSelectedId(filtered[0].id);
  }, [query, filtered, selectedId]);

  const lvl = clamp(level, 1, 18);

  // ✅ Keep target level synced to attacker level unless user manually changes it
  useEffect(() => {
    if (!targetLevelTouched) setTargetLevel(lvl);
  }, [lvl, targetLevelTouched]);

  const tLvl = clamp(targetLevel, 1, 18);

  // Base champ stats
  const champHp =
    selected ? selected.stats.hp + selected.stats.hpperlevel * (lvl - 1) : NaN;
  const champArmor =
    selected
      ? selected.stats.armor + selected.stats.armorperlevel * (lvl - 1)
      : NaN;
  const champMr =
    selected
      ? selected.stats.spellblock +
        selected.stats.spellblockperlevel * (lvl - 1)
      : NaN;

  // AD / AS (assumes your ChampionIndexRow.stats includes these fields in runtime data)
  const champBaseAd = selected ? (selected.stats as any).attackdamage : NaN;
  const champAdPer = selected
    ? (selected.stats as any).attackdamageperlevel
    : 0;

  const champBaseAs = selected ? (selected.stats as any).attackspeed : NaN;
  const champAsPer = selected ? (selected.stats as any).attackspeedperlevel : 0;

  const champAd =
    Number.isFinite(champBaseAd) && Number.isFinite(champAdPer)
      ? champBaseAd + champAdPer * (lvl - 1)
      : NaN;

  const champAs =
    Number.isFinite(champBaseAs) && Number.isFinite(champAsPer)
      ? champBaseAs * (1 + (champAsPer * (lvl - 1)) / 100)
      : NaN;

  // ✅ Target champion computed stats (optional)
  const targetChampion = useMemo(
    () => champions.find((c) => c.id === targetChampionId),
    [champions, targetChampionId]
  );

  const targetChampHp =
    targetChampion
      ? targetChampion.stats.hp + targetChampion.stats.hpperlevel * (tLvl - 1)
      : NaN;

  const targetChampArmor =
    targetChampion
      ? targetChampion.stats.armor +
        targetChampion.stats.armorperlevel * (tLvl - 1)
      : NaN;

  const targetChampMr =
    targetChampion
      ? targetChampion.stats.spellblock +
        targetChampion.stats.spellblockperlevel * (tLvl - 1)
      : NaN;

  // ✅ Auto-fill target stats when target champ/level changes
  useEffect(() => {
    if (!targetChampionId) return;
    setActivePreset(null);
    setTargetHp(Number.isFinite(targetChampHp) ? Math.round(targetChampHp) : "");
    setTargetArmor(
      Number.isFinite(targetChampArmor) ? Math.round(targetChampArmor) : ""
    );
    setTargetMr(Number.isFinite(targetChampMr) ? Math.round(targetChampMr) : "");
  }, [targetChampionId, tLvl, targetChampHp, targetChampArmor, targetChampMr]);

  // Target presets
  function applyPreset(p: TargetPreset) {
    setTargetChampionId(""); // presets imply custom target values
    setActivePreset(p.key);
    setTargetHp(p.hp);
    setTargetArmor(p.armor);
    setTargetMr(p.mr);
  }
  function onTargetManualChange() {
    if (activePreset !== null) setActivePreset(null);
    if (targetChampionId) setTargetChampionId(""); // switch back to custom
  }

  // Items
  const selectedItems = useMemo(() => {
    return selectedItemIds
      .map((id) => items.find((x) => x.id === id))
      .filter(Boolean) as ItemRow[];
  }, [selectedItemIds, items]);

  const totals = useMemo(() => itemTotals(selectedItems), [selectedItems]);

  const itemResults = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return items
      .filter((it) => !selectedItemIds.includes(it.id))
      .filter((it) => it.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [itemQuery, items, selectedItemIds]);

  function addItem(id: string) {
    setSelectedItemIds((prev) => {
      if (prev.includes(id)) return prev;
      if (prev.length >= 6) return prev;
      return [...prev, id];
    });
    setItemQuery("");
    setItemDropdownOpen(false);
  }
  function removeItem(id: string) {
    setSelectedItemIds((prev) => prev.filter((x) => x !== id));
  }

  const tHP = num0(targetHp);
  const tArmor = num0(targetArmor);
  const tMr = num0(targetMr);

  const ohMagic = num0(onHitFlatMagic);
  const ohPct = num0(onHitPctTargetMaxHpPhys);
  const critMult = num0(critDamageMult);

  const advBurstPhys = num0(burstPhysRaw);
  const advBurstMagic = num0(burstMagicRaw);
  const advBurstTrue = num0(burstTrueRaw);

  const advDpsPhys = num0(dpsPhysRaw);
  const advDpsMagic = num0(dpsMagicRaw);
  const advDpsTrue = num0(dpsTrueRaw);
  const advWindow = num0(windowSec);

  const sAAs = num0(simpleAAs);
  const sWindow = num0(simpleWindow);

  // Effective stats (champ + item stats)
  const effHp = Number.isFinite(champHp) ? champHp + totals.hp : NaN;
  const effArmor = Number.isFinite(champArmor) ? champArmor + totals.armor : NaN;
  const effMr = Number.isFinite(champMr) ? champMr + totals.mr : NaN;
  const effAd = Number.isFinite(champAd) ? champAd + totals.ad : NaN;
  const effAp = totals.ap; // items-only for now
  const effAs =
    Number.isFinite(champAs) ? champAs * (1 + totals.asPct / 100) : NaN;

  // ✅ Apply penetration to target defenses
  const targetArmorAfterPen = useMemo(() => {
    const afterPct = tArmor * (1 - totals.armorPenPct / 100);
    const afterFlat = afterPct - totals.lethality;
    return afterFlat;
  }, [tArmor, totals.armorPenPct, totals.lethality]);

  const targetMrAfterPen = useMemo(() => {
    const afterPct = tMr * (1 - totals.magicPenPct / 100);
    const afterFlat = afterPct - totals.magicPenFlat;
    return afterFlat;
  }, [tMr, totals.magicPenPct, totals.magicPenFlat]);

  const physMult = useMemo(
    () => damageMultiplierFromResist(targetArmorAfterPen),
    [targetArmorAfterPen]
  );
  const magicMult = useMemo(
    () => damageMultiplierFromResist(targetMrAfterPen),
    [targetMrAfterPen]
  );

  const ehpPhys = effectiveHp(tHP, targetArmorAfterPen);
  const ehpMagic = effectiveHp(tHP, targetMrAfterPen);

  // ✅ Expected AA damage multiplier from crit chance
  const expectedCritMult = useMemo(() => {
    const c = clamp(totals.critChancePct / 100, 0, 1);
    const cd = clamp(critMult, 1.0, 5.0);
    return (1 - c) * 1 + c * cd;
  }, [totals.critChancePct, critMult]);

  // Rough AA DPS (expected crit) BEFORE resists:
  const inferredAaDps = useMemo(() => {
    if (!Number.isFinite(effAd) || !Number.isFinite(effAs)) return NaN;
    if (effAd <= 0 || effAs <= 0) return NaN;
    return effAd * effAs * expectedCritMult;
  }, [effAd, effAs, expectedCritMult]);

  // One auto attack (raw) and post-mitigation (with on-hit knobs)
  const oneAutoRaw = useMemo(() => {
    if (!Number.isFinite(effAd)) return NaN;
    const base = effAd * expectedCritMult;
    const onHitPhysFromPct =
      (clamp(ohPct, 0, 50) / 100) * clamp(tHP, 0, 999999);
    return base + onHitPhysFromPct;
  }, [effAd, expectedCritMult, ohPct, tHP]);

  const oneAutoPost = useMemo(() => {
    const physPart = Number.isFinite(physMult) ? oneAutoRaw * physMult : NaN;
    const magicPart =
      Number.isFinite(magicMult) && Number.isFinite(ohMagic)
        ? ohMagic * magicMult
        : 0;
    return physPart + magicPart;
  }, [oneAutoRaw, physMult, ohMagic, magicMult]);

  // ---------- Advanced math (post-mitigation) ----------
  const burstPost =
    (Number.isFinite(physMult) ? advBurstPhys * physMult : NaN) +
    (Number.isFinite(magicMult) ? advBurstMagic * magicMult : NaN) +
    advBurstTrue;

  const burstPct =
    Number.isFinite(burstPost) && tHP > 0 ? (burstPost / tHP) * 100 : NaN;

  const dpsPost =
    (Number.isFinite(physMult) ? advDpsPhys * physMult : NaN) +
    (Number.isFinite(magicMult) ? advDpsMagic * magicMult : NaN) +
    advDpsTrue;

  const timeToKill =
    Number.isFinite(dpsPost) && dpsPost > 0 ? tHP / dpsPost : NaN;

  const windowDamage =
    Number.isFinite(dpsPost) && Number.isFinite(advWindow) && advWindow > 0
      ? dpsPost * advWindow
      : NaN;

  function useAaDpsAsPhys() {
    if (!Number.isFinite(inferredAaDps)) return;
    setDpsPhysRaw(Math.round(inferredAaDps));
    setDpsMagicRaw(0);
    setDpsTrueRaw(0);
  }

  function addOneAutoToBurst() {
    if (!Number.isFinite(oneAutoRaw)) return;
    setBurstPhysRaw((prev) => Math.round(num0(prev) + oneAutoRaw));
    if (ohMagic > 0)
      setBurstMagicRaw((prev) => Math.round(num0(prev) + ohMagic));
  }

  // ---------- Simple estimates (autos-based) ----------
  const simpleBurstPost = Number.isFinite(oneAutoPost)
    ? oneAutoPost * clamp(sAAs, 0, 50)
    : NaN;

  const simpleBurstPct =
    Number.isFinite(simpleBurstPost) && tHP > 0
      ? (simpleBurstPost / tHP) * 100
      : NaN;

  const simpleDpsPost =
    (Number.isFinite(inferredAaDps) && Number.isFinite(physMult)
      ? inferredAaDps * physMult
      : NaN) +
    (Number.isFinite(magicMult)
      ? ohMagic * magicMult * (Number.isFinite(effAs) ? effAs : 0)
      : 0);

  const simpleTimeToKill =
    Number.isFinite(simpleDpsPost) && simpleDpsPost > 0
      ? tHP / simpleDpsPost
      : NaN;

  const simpleWindowDamage =
    Number.isFinite(simpleDpsPost) && sWindow > 0
      ? simpleDpsPost * sWindow
      : NaN;

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:items-start">
      {/* Inputs */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Inputs</h2>

          <button
            type="button"
            onClick={toggleUiMode}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${
              uiMode === "advanced"
                ? "border-neutral-500 bg-neutral-900 text-white"
                : "border-neutral-800 bg-black text-neutral-200 hover:border-neutral-600"
            }`}
            title="Toggle Simple/Advanced"
          >
            {uiMode === "simple" ? "Advanced" : "Simple"}
          </button>
        </div>

        {/* Champion picker */}
        <div className="mt-6">
          <label className="text-sm text-neutral-300">Champion</label>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search champion (e.g., Ahri, Yasuo, Mage)..."
            className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
          />

          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="mt-3 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
          >
            {filtered.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.title ? ` — ${c.title}` : ""}
              </option>
            ))}
          </select>

          <div className="mt-2 text-xs text-neutral-500">
            Loaded{" "}
            <span className="text-neutral-300 font-semibold">
              {champions.length}
            </span>{" "}
            champions • Data Dragon patch{" "}
            <span className="text-neutral-300 font-semibold">{patch}</span>
          </div>

          <div className="mt-2 text-xs text-neutral-500">
            Showing {filtered.length} results (type to filter). Selected:{" "}
            <span className="text-neutral-300 font-semibold">
              {selected?.name ?? "—"}
            </span>
          </div>
        </div>

        {/* Level */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <label className="text-sm text-neutral-300">Level</label>
            <span className="text-sm text-neutral-200">{lvl}</span>
          </div>

          <input
            type="range"
            min={1}
            max={18}
            value={lvl}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="mt-3 w-full"
          />

          <div className="mt-2 grid grid-cols-3 gap-2">
            {[1, 9, 18].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setLevel(v)}
                className={`rounded-xl border px-3 py-1.5 text-xs ${
                  lvl === v
                    ? "border-neutral-500 bg-neutral-900"
                    : "border-neutral-800 bg-black hover:border-neutral-600"
                }`}
              >
                Level {v}
              </button>
            ))}
          </div>
        </div>

        {/* Target */}
        <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Target</div>
            <div className="text-xs text-neutral-500">
              Presets are quick approximations.
            </div>
          </div>

          {/* ✅ Target Champion + Target Level (minimal layout change) */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-neutral-300">
                Champion: 
              </label>
              <select
                value={targetChampionId}
                onChange={(e) => {
                  const id = e.target.value;
                  setTargetChampionId(id);
                  setActivePreset(null);
                  // If user never touched target level, keep it synced
                  if (!targetLevelTouched) setTargetLevel(lvl);
                }}
                className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
              >
                <option value="">Custom / Preset</option>
                {champions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {targetChampionId && (
                <div className="mt-1 text-xs text-neutral-500">
                  Using{" "}
                  <span className="text-neutral-300 font-semibold">
                    {targetChampion?.name ?? "—"}
                  </span>{" "}
                  stats.
                </div>
              )}
            </div>

            <div>
              <label className="text-sm text-neutral-300">Target Level</label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={18}
                  value={tLvl}
                  onChange={(e) => {
                    setTargetLevelTouched(true);
                    setTargetLevel(Number(e.target.value));
                  }}
                  className="w-full"
                />
                <div className="min-w-[2.5rem] text-right text-sm text-neutral-200 font-semibold">
                  {tLvl}
                </div>
              </div>

              {!targetLevelTouched ? (
                <div className="mt-1 text-xs text-neutral-500">
                  Auto-synced to your level.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTargetLevelTouched(false);
                    setTargetLevel(lvl);
                  }}
                  className="mt-2 rounded-xl border border-neutral-800 bg-black px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-600"
                >
                  Sync to my level
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {TARGET_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p)}
                className={`rounded-xl border px-3 py-1.5 text-xs ${
                  activePreset === p.key
                    ? "border-neutral-500 bg-neutral-900"
                    : "border-neutral-800 bg-black hover:border-neutral-600"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2 sm:col-span-1">
              <label className="text-sm text-neutral-300">Target HP</label>
              <input
                type="number"
                value={targetHp}
                onChange={(e) => {
                  onTargetManualChange();
                  setNum(setTargetHp, 1, 99999)(e.target.value);
                }}
                className="w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
              />
            </div>

            <div>
              <label className="text-sm text-neutral-300">Armor</label>
              <input
                type="number"
                value={targetArmor}
                onChange={(e) => {
                  onTargetManualChange();
                  setNum(setTargetArmor, -999, 9999)(e.target.value);
                }}
                className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
              />
              <div className="mt-1 text-xs text-neutral-500">
                After pen:{" "}
                <span className="text-neutral-300 font-semibold">
                  {fmt(targetArmorAfterPen, 1)}
                </span>{" "}
                • mult: {Number.isFinite(physMult) ? fmt(physMult, 3) : "—"}
              </div>
            </div>

            <div>
              <label className="text-sm text-neutral-300">MR</label>
              <input
                type="number"
                value={targetMr}
                onChange={(e) => {
                  onTargetManualChange();
                  setNum(setTargetMr, -999, 9999)(e.target.value);
                }}
                className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
              />
              <div className="mt-1 text-xs text-neutral-500">
                After pen:{" "}
                <span className="text-neutral-300 font-semibold">
                  {fmt(targetMrAfterPen, 1)}
                </span>{" "}
                • mult: {Number.isFinite(magicMult) ? fmt(magicMult, 3) : "—"}
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-neutral-500">
            Effective HP preview:{" "}
            <span className="text-neutral-300 font-semibold">
              vs Physical {fmt(ehpPhys, 0)}
            </span>{" "}
            •{" "}
            <span className="text-neutral-300 font-semibold">
              vs Magic {fmt(ehpMagic, 0)}
            </span>
          </div>
        </div>

        {/* Items */}
        <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Items</div>
            <div className="text-xs text-neutral-500">
              {selectedItems.length}/6
            </div>
          </div>

          <div className="relative mt-3">
            <input
              value={itemQuery}
              onChange={(e) => {
                setItemQuery(e.target.value);
                setItemDropdownOpen(true);
              }}
              onFocus={() => setItemDropdownOpen(true)}
              onBlur={() => setTimeout(() => setItemDropdownOpen(false), 120)}
              placeholder="Search items (type 2+ letters)..."
              className="w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
            />

            {itemDropdownOpen && itemQuery.trim().length >= 2 && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-xl">
                <div className="max-h-64 overflow-auto">
                  {itemResults.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-neutral-500">
                      No matches. Try a different search.
                    </div>
                  ) : (
                    itemResults.map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addItem(it.id)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-900"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-200">{it.name}</span>
                          <span className="text-xs text-neutral-500">
                            {it.gold ? `${it.gold}g` : ""}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {selectedItems.length > 0 && (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedItems.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => removeItem(it.id)}
                    className="rounded-xl border border-neutral-800 bg-black px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-600"
                    title="Click to remove"
                  >
                    {it.name} ✕
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-800 bg-black p-4">
                <div className="text-sm font-semibold">Item totals (stats)</div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">HP</span>
                    <span className="text-neutral-200 font-semibold">
                      +{totals.hp}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">AD</span>
                    <span className="text-neutral-200 font-semibold">
                      +{totals.ad}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">AP</span>
                    <span className="text-neutral-200 font-semibold">
                      +{totals.ap}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Armor</span>
                    <span className="text-neutral-200 font-semibold">
                      +{totals.armor}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">MR</span>
                    <span className="text-neutral-200 font-semibold">
                      +{totals.mr}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">AS</span>
                    <span className="text-neutral-200 font-semibold">
                      +{fmt(totals.asPct, 0)}%
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-neutral-400">Crit</span>
                    <span className="text-neutral-200 font-semibold">
                      +{fmt(totals.critChancePct, 0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Lethality</span>
                    <span className="text-neutral-200 font-semibold">
                      +{fmt(totals.lethality, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">% Armor Pen</span>
                    <span className="text-neutral-200 font-semibold">
                      +{fmt(totals.armorPenPct, 0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Magic Pen</span>
                    <span className="text-neutral-200 font-semibold">
                      +{fmt(totals.magicPenFlat, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">% Magic Pen</span>
                    <span className="text-neutral-200 font-semibold">
                      +{fmt(totals.magicPenPct, 0)}%
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-xs text-neutral-500">
                  Stats are applied. True “unique passives” require the knobs
                  below (we’ll expand later).
                </div>
              </div>
            </>
          )}
        </div>

        {/* ✅ Advanced-only passives */}
        {uiMode === "advanced" && (
          <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Item passives & on-hit</div>
              <div className="text-xs text-neutral-500">Advanced</div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-sm text-neutral-300">
                  On-hit Magic (flat)
                </label>
                <input
                  type="number"
                  value={onHitFlatMagic}
                  onChange={(e) =>
                    setNum(setOnHitFlatMagic, 0, 9999)(e.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                />
                <div className="mt-1 text-xs text-neutral-500">
                  Applied per auto (mitigated by MR).
                </div>
              </div>

              <div>
                <label className="text-sm text-neutral-300">
                  % Target HP On-hit (phys)
                </label>
                <input
                  type="number"
                  value={onHitPctTargetMaxHpPhys}
                  onChange={(e) =>
                    setNum(setOnHitPctTargetMaxHpPhys, 0, 50)(e.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                />
                <div className="mt-1 text-xs text-neutral-500">
                  Example: 3 = 3% max HP per hit (mitigated by armor).
                </div>
              </div>

              <div>
                <label className="text-sm text-neutral-300">
                  Crit Damage Mult
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={critDamageMult}
                  onChange={(e) =>
                    setNum(setCritDamageMult, 1.0, 5.0)(e.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                />
                <div className="mt-1 text-xs text-neutral-500">
                  Default is 2.00 (expected crit).
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SIMPLE CONTROLS */}
        {uiMode === "simple" && (
          <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Quick Mode</div>
              <div className="text-xs text-neutral-500">
                Autos baseline + stats + pen + crit.
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSimpleType("burst")}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                  simpleType === "burst"
                    ? "border-neutral-500 bg-neutral-900"
                    : "border-neutral-800 bg-black text-neutral-400 hover:border-neutral-600"
                }`}
              >
                Burst (autos)
              </button>
              <button
                type="button"
                onClick={() => setSimpleType("dps")}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                  simpleType === "dps"
                    ? "border-neutral-500 bg-neutral-900"
                    : "border-neutral-800 bg-black text-neutral-400 hover:border-neutral-600"
                }`}
              >
                DPS (autos)
              </button>
            </div>

            {simpleType === "burst" ? (
              <div className="mt-4">
                <label className="text-sm text-neutral-300">Autos in combo</label>
                <input
                  type="number"
                  value={simpleAAs}
                  onChange={(e) => setNum(setSimpleAAs, 0, 50)(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                />
                <div className="mt-1 text-xs text-neutral-500">
                  Number of basic attacks you expect to land during the trade.
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <label className="text-sm text-neutral-300">Window (sec)</label>
                <input
                  type="number"
                  value={simpleWindow}
                  onChange={(e) => setNum(setSimpleWindow, 0, 120)(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                />
                <div className="mt-1 text-xs text-neutral-500"></div>
              </div>
            )}
          </div>
        )}

        <div className="mt-2 text-xs text-neutral-500">
          <span className="font-semibold">Burst (autos):</span> Total damage from
          a small number of autos.
          <br />
          <span className="font-semibold">DPS (autos):</span> Damage if you
          auto-attack continuously for a set time.
        </div>

        {/* ADVANCED CONTROLS */}
        {uiMode === "advanced" && (
          <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
            <div className="text-sm font-semibold">Mode</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("burst")}
                className={`rounded-xl border px-3 py-2 text-center text-sm font-semibold ${
                  mode === "burst"
                    ? "border-neutral-500 bg-neutral-900"
                    : "border-neutral-800 bg-black text-neutral-400 hover:border-neutral-600"
                }`}
              >
                Burst (Combo)
              </button>
              <button
                type="button"
                onClick={() => setMode("dps")}
                className={`rounded-xl border px-3 py-2 text-center text-sm font-semibold ${
                  mode === "dps"
                    ? "border-neutral-500 bg-neutral-900"
                    : "border-neutral-800 bg-black text-neutral-400 hover:border-neutral-600"
                }`}
              >
                DPS / Window
              </button>
            </div>
            <div className="mt-3 text-xs text-neutral-500">
              Advanced = manual damage buckets. Pen applied automatically. Crit
              expectation used in AA helpers.
            </div>
          </div>
        )}
      </section>

      {/* Right column */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 flex flex-col self-start">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Selected champion</h2>

          <div className="text-xs text-neutral-500">
            View:{" "}
            <span className="text-neutral-300 font-semibold">
              {uiMode === "simple" ? "Simple" : "Advanced"}
            </span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-neutral-300">Name</span>
            <span className="font-semibold">{selected?.name ?? "—"}</span>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-neutral-300">Title</span>
            <span className="font-semibold text-neutral-200">
              {selected?.title ?? "—"}
            </span>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-neutral-300">Level</span>
            <span className="font-semibold text-neutral-200">{lvl}</span>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-neutral-300">HP (at level)</span>
            <span className="font-semibold text-neutral-200">
              {fmt(champHp, 1)}
            </span>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-neutral-300">Armor (at level)</span>
            <span className="font-semibold text-neutral-200">
              {fmt(champArmor, 1)}
            </span>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-neutral-300">MR (at level)</span>
            <span className="font-semibold text-neutral-200">{fmt(champMr, 1)}</span>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-neutral-300">Resource</span>
            <span className="font-semibold text-neutral-200">
              {selected?.partype ?? "—"}
            </span>
          </div>
        </div>

        {/* Results */}
        <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Results</div>
            <div className="text-xs text-neutral-500">
              {uiMode === "simple" ? (
                <>
                  Mode:{" "}
                  <span className="text-neutral-300 font-semibold">
                    {simpleType === "burst" ? "Burst" : "DPS/Window"}
                  </span>
                </>
              ) : (
                <>
                  Mode:{" "}
                  <span className="text-neutral-300 font-semibold">
                    {mode === "burst" ? "Burst" : "DPS/Window"}
                  </span>
                </>
              )}
            </div>
          </div>

       {uiMode === "advanced" && (
  <>
    {/* Effective stats */}
    <div className="mt-4 rounded-xl border border-neutral-800 bg-black px-3 py-3">
      <div className="text-xs font-semibold text-neutral-300">
        Effective stats (champ + items)
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="flex justify-between">
          <span className="text-neutral-500">HP</span>
          <span className="text-neutral-200 font-semibold">{fmt(effHp, 0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">AD</span>
          <span className="text-neutral-200 font-semibold">{fmt(effAd, 0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">AP</span>
          <span className="text-neutral-200 font-semibold">{fmt(effAp, 0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">AS</span>
          <span className="text-neutral-200 font-semibold">{fmt(effAs, 3)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Crit</span>
          <span className="text-neutral-200 font-semibold">{fmt(totals.critChancePct, 0)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">AA DPS</span>
          <span className="text-neutral-200 font-semibold">
            {Number.isFinite(inferredAaDps) ? fmt(inferredAaDps, 1) : "—"}
          </span>
        </div>
      </div>

      <div className="mt-2 text-[11px] text-neutral-500">
        Resists include your pen: Armor→{fmt(targetArmorAfterPen, 1)}, MR→{fmt(targetMrAfterPen, 1)}
      </div>
    </div>
  </>
)}


          {/* SIMPLE RESULTS */}
          {uiMode === "simple" ? (
            <>
              {simpleType === "burst" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-neutral-300">
                      Damage (autos)
                    </span>
                    <span className="font-semibold text-neutral-200">
                      {fmt(simpleBurstPost, 0)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-neutral-300">% of Target HP</span>
                    <span className="font-semibold text-neutral-200">
                      {Number.isFinite(simpleBurstPct)
                        ? `${fmt(simpleBurstPct, 1)}%`
                        : "—"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-neutral-300">
                      Damage (autos, window)
                    </span>
                    <span className="font-semibold text-neutral-200">
                      {fmt(simpleWindowDamage, 0)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-neutral-300">
                      Time to kill (est.)
                    </span>
                    <span className="font-semibold text-neutral-200">
                      {Number.isFinite(simpleTimeToKill)
                        ? `${fmt(simpleTimeToKill, 2)}s`
                        : "—"}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-3 text-xs text-neutral-500">
                Simple mode is autos-baseline (stats + pen + expected crit).
                Abilities come later.
              </div>
            </>
          ) : (
            <>
              {/* ADVANCED RESULTS */}
              {mode === "burst" ? (
                <>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="text-xs text-neutral-500">
                      One AA (post-mitigation):{" "}
                      <span className="text-neutral-300 font-semibold">
                        {Number.isFinite(oneAutoPost) ? fmt(oneAutoPost, 0) : "—"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={addOneAutoToBurst}
                      disabled={!Number.isFinite(oneAutoRaw)}
                      className="rounded-xl border border-neutral-800 bg-black px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-600 disabled:opacity-50"
                    >
                      Add 1 AA
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="text-sm text-neutral-300">Raw Physical</label>
                      <input
                        type="number"
                        value={burstPhysRaw}
                        onChange={(e) =>
                          setNum(setBurstPhysRaw, 0, 999999)(e.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                      />
                      <div className="mt-1 text-xs text-neutral-500">
                        After armor:{" "}
                        <span className="text-neutral-300 font-semibold">
                          {Number.isFinite(physMult)
                            ? fmt(num0(burstPhysRaw) * physMult, 0)
                            : "—"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-neutral-300">Raw Magic</label>
                      <input
                        type="number"
                        value={burstMagicRaw}
                        onChange={(e) =>
                          setNum(setBurstMagicRaw, 0, 999999)(e.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                      />
                      <div className="mt-1 text-xs text-neutral-500">
                        After MR:{" "}
                        <span className="text-neutral-300 font-semibold">
                          {Number.isFinite(magicMult)
                            ? fmt(num0(burstMagicRaw) * magicMult, 0)
                            : "—"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-neutral-300">True Damage</label>
                      <input
                        type="number"
                        value={burstTrueRaw}
                        onChange={(e) =>
                          setNum(setBurstTrueRaw, 0, 999999)(e.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                      />
                      <div className="mt-1 text-xs text-neutral-500">
                        Not reduced by resists
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-neutral-300">
                        Total (post-mitigation)
                      </span>
                      <span className="font-semibold text-neutral-200">
                        {fmt(burstPost, 0)}
                      </span>
                    </div>

                    <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-neutral-300">% of Target HP</span>
                      <span className="font-semibold text-neutral-200">
                        {Number.isFinite(burstPct) ? `${fmt(burstPct, 1)}%` : "—"}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="text-xs text-neutral-500">
                      Expected AA DPS (raw):{" "}
                      <span className="text-neutral-300 font-semibold">
                        {Number.isFinite(inferredAaDps) ? fmt(inferredAaDps, 1) : "—"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={useAaDpsAsPhys}
                      disabled={!Number.isFinite(inferredAaDps)}
                      className="rounded-xl border border-neutral-800 bg-black px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-600 disabled:opacity-50"
                    >
                      Use AA DPS
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div>
                      <label className="text-sm text-neutral-300">Phys DPS (raw)</label>
                      <input
                        type="number"
                        value={dpsPhysRaw}
                        onChange={(e) =>
                          setNum(setDpsPhysRaw, 0, 999999)(e.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-neutral-300">Magic DPS (raw)</label>
                      <input
                        type="number"
                        value={dpsMagicRaw}
                        onChange={(e) =>
                          setNum(setDpsMagicRaw, 0, 999999)(e.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-neutral-300">True DPS</label>
                      <input
                        type="number"
                        value={dpsTrueRaw}
                        onChange={(e) =>
                          setNum(setDpsTrueRaw, 0, 999999)(e.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-neutral-300">Window (sec)</label>
                      <input
                        type="number"
                        value={windowSec}
                        onChange={(e) =>
                          setNum(setWindowSec, 0, 120)(e.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                      />
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-neutral-500">
                    Post-mitigation DPS:{" "}
                    <span className="text-neutral-300 font-semibold">{fmt(dpsPost, 1)}</span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-neutral-300">
                        Damage (autos, window)
                      </span>
                      <span className="font-semibold text-neutral-200">
                        {fmt(windowDamage, 0)}
                      </span>
                    </div>

                    <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-neutral-300">
                        Time to kill (est.)
                      </span>
                      <span className="font-semibold text-neutral-200">
                        {Number.isFinite(timeToKill) ? `${fmt(timeToKill, 2)}s` : "—"}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Small legend */}
          <div className="mt-4 text-[11px] leading-relaxed text-neutral-500">
            <span className="font-semibold text-neutral-400">Legend:</span>{" "}
            HP = Health, AD = Attack Damage, AP = Ability Power, AS = Attack Speed,
            MR = Magic Resist, AA = Auto Attack, DPS = Damage per Second, TTK = Time
            to Kill, Pen = Penetration (Armor/MR)
          </div>
        </div>
      </section>
    </div>
  );
}
