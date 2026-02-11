// app/calculators/wow/damage-calculator/client.tsx
"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PresetsFile, SpecPreset, ItemIndexRow } from "./page";

/* =========================
   Types / constants
========================= */

type MobileTab = "stats" | "gear" | "results";

type StatKey =
  | "STRENGTH"
  | "AGILITY"
  | "INTELLECT"
  | "STAMINA"
  | "CRIT_RATING"
  | "HASTE_RATING"
  | "MASTERY_RATING"
  | "VERSATILITY";

type PrimaryStat = "STRENGTH" | "AGILITY" | "INTELLECT";

type PackedItem = {
  id: number;
  detail: any;
};

type GearSlotKey =
  | "HEAD"
  | "NECK"
  | "SHOULDER"
  | "BACK"
  | "CHEST"
  | "WRIST"
  | "HANDS"
  | "WAIST"
  | "LEGS"
  | "FEET"
  | "FINGER"
  | "TRINKET"
  | "MAIN_HAND"
  | "OFF_HAND"
  | "TWO_HAND";

const GEAR_SLOTS: Array<{
  key: GearSlotKey;
  label: string;
  inventoryTypeKeys: string[]; // matches either index inventoryTypeKey/slot OR detail.inventory_type.type
  allowMulti?: boolean; // rings/trinkets
}> = [
  { key: "HEAD", label: "Head", inventoryTypeKeys: ["HEAD"] },
  { key: "NECK", label: "Neck", inventoryTypeKeys: ["NECK"] },
  { key: "SHOULDER", label: "Shoulder", inventoryTypeKeys: ["SHOULDER"] },
  { key: "BACK", label: "Back", inventoryTypeKeys: ["CLOAK", "BACK"] },
  { key: "CHEST", label: "Chest", inventoryTypeKeys: ["CHEST", "ROBE"] },
  { key: "WRIST", label: "Wrist", inventoryTypeKeys: ["WRIST"] },
  { key: "HANDS", label: "Hands", inventoryTypeKeys: ["HANDS", "HAND"] },
  { key: "WAIST", label: "Waist", inventoryTypeKeys: ["WAIST"] },
  { key: "LEGS", label: "Legs", inventoryTypeKeys: ["LEGS"] },
  { key: "FEET", label: "Feet", inventoryTypeKeys: ["FEET"] },

  { key: "FINGER", label: "Rings", inventoryTypeKeys: ["FINGER"], allowMulti: true },
  { key: "TRINKET", label: "Trinkets", inventoryTypeKeys: ["TRINKET"], allowMulti: true },

  // Weapon slots: your DB may use WEAPON/TWOHWEAPON etc
  {
    key: "MAIN_HAND",
    label: "Main Hand",
    inventoryTypeKeys: ["MAIN_HAND", "ONE_HAND", "WEAPONMAINHAND", "WEAPON"],
  },
  {
    key: "OFF_HAND",
    label: "Off Hand",
    inventoryTypeKeys: ["OFF_HAND", "HOLDABLE", "WEAPONOFFHAND", "WEAPON"],
  },
  {
    key: "TWO_HAND",
    label: "Two-Hand",
    inventoryTypeKeys: ["TWO_HAND", "2HWEAPON", "TWOHWEAPON"],
  },
];

/* =========================
   Math helpers
========================= */

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
function expectedDamageMultiplierFromCrit(critChancePct: number, critMult: number) {
  const c = clamp(critChancePct / 100, 0, 1);
  return (1 - c) * 1 + c * critMult;
}
function safeNum(n: number, fallback = 0) {
  return Number.isFinite(n) ? n : fallback;
}

/* =========================
   Compute (unchanged)
========================= */

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

    return { ability: a, upmBase, upmEff, expectedAfterMit, dps };
  });

  rows.sort((a, b) => b.dps - a.dps);
  const totalDps = rows.reduce((sum, r) => sum + (Number.isFinite(r.dps) ? r.dps : 0), 0);

  return { totalDps, rows, AP, SP };
}

/* =========================
   Small UI atoms (minimal)
========================= */

function SmallNumberInput(props: {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const { label, value, onChange, min, max, step, suffix } = props;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
      {label ? <div className="text-[11px] font-semibold text-neutral-400">{label}</div> : null}
      <div className="mt-2 flex items-center gap-2">
        <input
          className="h-10 w-full rounded-xl border border-neutral-800 bg-black px-3 text-sm text-neutral-100 outline-none transition focus:border-neutral-600"
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          inputMode="decimal"
        />
        {suffix ? <div className="shrink-0 text-xs text-neutral-500">{suffix}</div> : null}
      </div>
    </div>
  );
}

function ChipButton(props: { active?: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "h-10 rounded-xl border px-4 text-sm transition",
        props.active
          ? "border-neutral-600 bg-black text-white"
          : "border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-600 hover:text-white",
      ].join(" ")}
    >
      {props.children}
    </button>
  );
}

/* =========================
   Searchable dropdown
========================= */

function norm(s: string) {
  return (s || "").toLowerCase().trim();
}
function tokenizeQuery(q: string) {
  return norm(q)
    .split(/[^a-z0-9]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function isValidItemRow(r: ItemIndexRow): r is ItemIndexRow & { id: number } {
  return typeof (r as any)?.id === "number" && Number.isFinite((r as any).id);
}

function SearchDropdown(props: {
  placeholder: string;
  query: string;
  setQuery: (v: string) => void;
  results: ItemIndexRow[];
  onPick: (row: ItemIndexRow) => void;
  selectedLabel?: string;
  onClear?: () => void;
  maxResults?: number;
}) {
  const { placeholder, query, setQuery, results, onPick, selectedLabel, onClear, maxResults = 10 } =
    props;

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as any;
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const shown = results.slice(0, maxResults).filter(isValidItemRow);

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2">
        <input
          className="h-10 w-full rounded-xl border border-neutral-800 bg-black px-3 text-sm text-neutral-100 outline-none transition focus:border-neutral-600"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {selectedLabel ? (
          <button
            type="button"
            onClick={() => {
              onClear?.();
              setOpen(false);
            }}
            className="h-10 rounded-xl border border-neutral-800 bg-black px-3 text-xs text-neutral-200 hover:border-neutral-600 hover:text-white"
            title="Clear"
          >
            Clear
          </button>
        ) : null}
      </div>

      {selectedLabel ? (
        <div className="mt-2 text-[11px] text-neutral-400 truncate">
          Selected: <span className="text-neutral-200 font-semibold">{selectedLabel}</span>
        </div>
      ) : null}

      {open ? (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-[0_0_30px_rgba(0,0,0,0.55)]">
          <div className="max-h-[320px] overflow-auto p-2">
            {shown.length ? (
              shown.map((r) => (
                <button
                  key={String((r as any).id)}
                  type="button"
                  onClick={() => {
                    onPick(r);
                    setOpen(false);
                  }}
                  className="w-full rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-neutral-700 hover:bg-black"
                >
                  <div className="text-sm font-semibold text-white truncate">{String((r as any).name ?? "—")}</div>
                  <div className="mt-1 text-[11px] text-neutral-500 flex items-center gap-2">
                    <span className="truncate">
                      {String(
                        (r as any).inventoryTypeKey ??
                          (r as any).slot ??
                          (r as any).inventoryType ??
                          "—"
                      )}
                    </span>
                    {typeof (r as any).itemLevel === "number" ? (
                      <span>ilvl {(r as any).itemLevel}</span>
                    ) : typeof (r as any).ilvl === "number" ? (
                      <span>ilvl {(r as any).ilvl}</span>
                    ) : null}
                    {(r as any).quality ? <span className="truncate">{String((r as any).quality)}</span> : null}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-xs text-neutral-500">No matches. Try fewer words.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* =========================
   Item parsing (UPDATED for Blizzard-style detail)
========================= */

function sumStatsFromDetail(detail: any) {
  const out: Partial<Record<StatKey, number>> = {};

  const stats =
    detail?.stats ??
    detail?.preview_item?.stats ??
    detail?.previewItem?.stats ??
    [];

  if (Array.isArray(stats)) {
    for (const s of stats) {
      const type =
        s?.type?.type ??
        s?.type ??
        s?.stat ??
        s?.name ??
        "";

      const val = Number(s?.value ?? s?.amount ?? 0);
      if (!type || !Number.isFinite(val)) continue;

      const k = String(type).toUpperCase() as StatKey;
      out[k] = (out[k] ?? 0) + val;
    }
  } else if (stats && typeof stats === "object") {
    for (const [kRaw, vRaw] of Object.entries(stats)) {
      const k = kRaw.toString().toUpperCase() as StatKey;
      const val = Number(vRaw);
      if (!Number.isFinite(val)) continue;
      out[k] = (out[k] ?? 0) + val;
    }
  }

  return out;
}

function guessWeaponDps(detail: any): number {
  const dps =
    Number(detail?.weapon?.damage_per_second) ||
    Number(detail?.weapon?.dps) ||
    Number(detail?.weapon?.dps_value) ||
    Number(detail?.preview_item?.weapon?.damage_per_second) ||
    Number(detail?.preview_item?.weapon?.dps) ||
    0;
  return Number.isFinite(dps) ? dps : 0;
}

/* =========================
   Slot normalization (UPDATED)
========================= */

function normalizeSlotKey(raw: any): string {
  const k = String(raw ?? "").toUpperCase().trim();
  if (!k) return "";
  if (k === "HAND") return "HANDS";
  return k;
}

function getRowSlotKey(r: any): string {
  const type =
    r?.inventoryTypeKey ??
    r?.slot ??
    r?.inventoryType ??
    r?.detail?.inventory_type?.type ??
    r?.detail?.preview_item?.inventory_type?.type;

  return normalizeSlotKey(type);
}

/* =========================
   Component
========================= */

export default function WowDamageCalcClient(props: {
  presets: PresetsFile | null;
  itemsIndex: ItemIndexRow[];
}) {
  const presets: PresetsFile = useMemo(() => {
    if (props.presets?.specs?.length) return props.presets;
    return { version: "missing", specs: [] };
  }, [props.presets]);

  const [specId, setSpecId] = useState<string>(() => presets.specs[0]?.id ?? "");
  useEffect(() => {
    if (!presets.specs.length) return;
    if (!presets.specs.some((s) => s.id === specId)) setSpecId(presets.specs[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets.version, presets.specs.length]);

  const spec = useMemo(() => {
    return presets.specs.find((s) => s.id === specId) ?? presets.specs[0] ?? null;
  }, [presets, specId]);

  /* =========================
     Inputs (compact)
  ========================= */

  const [mobileTab, setMobileTab] = useState<MobileTab>("stats");

  const [mainStat, setMainStat] = useState<number>(12000);
  const [weaponDps, setWeaponDps] = useState<number>(520);
  const [apFromMain, setApFromMain] = useState<number>(1.0);
  const [spFromMain, setSpFromMain] = useState<number>(1.0);

  const [critPct, setCritPct] = useState<number>(25);
  const [hastePct, setHastePct] = useState<number>(18);
  const [masteryPct, setMasteryPct] = useState<number>(18);
  const [versPct, setVersPct] = useState<number>(8);
  const [critDamageBonusPct, setCritDamageBonusPct] = useState<number>(0);
  const [burstUptimePct, setBurstUptimePct] = useState<number>(25);

  const [armorDrPct, setArmorDrPct] = useState<number>(30);
  const [magicDrPct, setMagicDrPct] = useState<number>(0);

  const [raidBuffPct, setRaidBuffPct] = useState<number>(0);
  const [consumablePct, setConsumablePct] = useState<number>(0);
  const [externalMultPct, setExternalMultPct] = useState<number>(0);

  const [upmOverrides, setUpmOverrides] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!spec) return;
    setUpmOverrides((prev) => {
      const next: Record<string, number> = { ...prev };
      for (const a of spec.abilities) if (next[a.id] == null) next[a.id] = a.baseUpm;

      const allowed = new Set(spec.abilities.map((a) => a.id));
      for (const k of Object.keys(next)) if (!allowed.has(k)) delete next[k];
      return next;
    });
  }, [specId, spec]);

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

  const computed = useMemo(() => {
    if (!spec) return { totalDps: 0, rows: [], AP: 0, SP: 0 };
    return computeSpecDps(spec, baseInputs);
  }, [spec, baseInputs]);

  /* =========================
     Gear state (optional)
  ========================= */

  const itemsIndex = props.itemsIndex ?? [];
  const [primaryStat, setPrimaryStat] = useState<PrimaryStat>("STRENGTH");

  const [gear, setGear] = useState<Record<string, number[]>>(() => ({}));
  const [gearQuery, setGearQuery] = useState<Record<string, string>>(() => ({}));
  const [packCache, setPackCache] = useState<Record<number, PackedItem[]>>({});

  async function getPack(packNo: number) {
    if (packCache[packNo]) return packCache[packNo];
    const url = `/data/wow/items/packs/items.pack.${String(packNo).padStart(3, "0")}.json`;
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error(`Failed pack ${packNo}`);
    const json = (await res.json()) as PackedItem[];
    setPackCache((prev) => ({ ...prev, [packNo]: json }));
    return json;
  }

  async function resolveItemDetail(row: ItemIndexRow): Promise<any | null> {
    try {
      const packNo = Number((row as any).pack);
      if (!Number.isFinite(packNo)) return null;
      const pack = await getPack(packNo);
      const found = pack.find((p) => p?.id === (row as any).id);
      return found?.detail ?? null;
    } catch {
      return null;
    }
  }

  const gearDerived = useMemo(() => {
    return {
      selectedCount: Object.values(gear).reduce((s, arr) => s + (arr?.length ?? 0), 0),
    };
  }, [gear]);

  const [gearTotals, setGearTotals] = useState<{
    primary: number;
    crit: number;
    haste: number;
    mastery: number;
    vers: number;
    weaponDps: number;
    loadedItems: number;
  }>({
    primary: 0,
    crit: 0,
    haste: 0,
    mastery: 0,
    vers: 0,
    weaponDps: 0,
    loadedItems: 0,
  });

  async function recomputeGearTotalsAndApply() {
    let primary = 0;
    let crit = 0;
    let haste = 0;
    let mastery = 0;
    let vers = 0;
    let wDps = 0;
    let loaded = 0;

    const allSelectedIds = Object.entries(gear).flatMap(([slotKey, ids]) =>
      (ids ?? []).map((id) => ({ slotKey, id }))
    );

    const rowById = new Map<number, ItemIndexRow>();
    for (const r of itemsIndex) {
      const id = (r as any)?.id;
      if (typeof id === "number" && Number.isFinite(id)) rowById.set(id, r);
    }

    for (const pick of allSelectedIds) {
      const row = rowById.get(pick.id);
      if (!row) continue;

      const detail = await resolveItemDetail(row);
      if (!detail) continue;

      // Filter out non-equippable if detail says so
      const invType = String(detail?.inventory_type?.type ?? detail?.preview_item?.inventory_type?.type ?? "");
      const isEquip = detail?.is_equippable ?? detail?.preview_item?.is_equippable;
      if (invType === "NON_EQUIP" || isEquip === false) continue;

      loaded += 1;

      const stats = sumStatsFromDetail(detail);
      primary += Number(stats[primaryStat] ?? 0) || 0;

      crit += Number(stats.CRIT_RATING ?? 0) || 0;
      haste += Number(stats.HASTE_RATING ?? 0) || 0;
      mastery += Number(stats.MASTERY_RATING ?? 0) || 0;
      vers += Number(stats.VERSATILITY ?? 0) || 0;

      const dps = guessWeaponDps(detail);
      if (dps > wDps) wDps = dps;
    }

    setGearTotals({
      primary,
      crit,
      haste,
      mastery,
      vers,
      weaponDps: wDps,
      loadedItems: loaded,
    });

    if (primary > 0) setMainStat(primary);
    if (wDps > 0) setWeaponDps(wDps);
  }

  function slotResults(slot: (typeof GEAR_SLOTS)[number], q: string) {
    const tq = tokenizeQuery(q);
    const keys = new Set(slot.inventoryTypeKeys.map((x) => String(x).toUpperCase()));

    let pool = itemsIndex.filter((r: any) => {
      const k = getRowSlotKey(r);
      if (!k) return false;
      return keys.has(k);
    });

    if (tq.length) {
      pool = pool.filter((r: any) => {
        const toks = Array.isArray(r?.tokens) ? r.tokens : [];
        const nameNorm = String(r?.nameNorm || "").toLowerCase();
        const name = String(r?.name || "").toLowerCase();
        return tq.every((t) => nameNorm.includes(t) || name.includes(t) || toks.includes(t));
      });
    }

    pool.sort(
      (a: any, b: any) =>
        safeNum(b?.itemLevel ?? b?.ilvl ?? 0, 0) - safeNum(a?.itemLevel ?? a?.ilvl ?? 0, 0) ||
        String(a?.name).localeCompare(String(b?.name))
    );

    return pool;
  }

  function selectedLabelFor(slotKey: string, idx: number) {
    const id = gear[slotKey]?.[idx];
    if (!id) return "";
    const row = itemsIndex.find((r: any) => r?.id === id);
    return row ? String((row as any).name) : `Item ${id}`;
  }

  function setSlotPick(slotKey: string, which: number, id: number | null) {
    setGear((prev) => {
      const next = { ...prev };
      const arr = Array.isArray(next[slotKey]) ? [...next[slotKey]] : [];
      while (arr.length <= which) arr.push(0);
      arr[which] = id ?? 0;
      next[slotKey] = arr.filter((x) => Number(x) > 0);
      return next;
    });
  }

  /* =========================
     Panels (minimal)
  ========================= */

  const Panel = (props: { title: string; right?: ReactNode; children: ReactNode }) => (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-neutral-200">{props.title}</div>
        {props.right ? <div className="shrink-0">{props.right}</div> : null}
      </div>
      <div className="mt-4">{props.children}</div>
    </div>
  );

  const TopBar = (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="h-10 rounded-xl border border-neutral-800 bg-black px-3 text-sm text-neutral-100 outline-none focus:border-neutral-600"
          value={specId}
          onChange={(e) => setSpecId(e.target.value)}
        >
          {presets.specs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.className} — {s.name}
            </option>
          ))}
        </select>

        <select
          className="h-10 rounded-xl border border-neutral-800 bg-black px-3 text-sm text-neutral-100 outline-none focus:border-neutral-600"
          value={primaryStat}
          onChange={(e) => setPrimaryStat(e.target.value as PrimaryStat)}
          title="Primary stat to sum from gear"
        >
          <option value="STRENGTH">Strength</option>
          <option value="AGILITY">Agility</option>
          <option value="INTELLECT">Intellect</option>
        </select>

        <div className="ml-auto flex items-center gap-2 text-[11px] text-neutral-500">
          <span>{gearDerived.selectedCount} selected</span>
          <span>•</span>
          <span>{gearTotals.loadedItems} loaded</span>
        </div>
      </div>

      {!spec ? (
        <div className="mt-4 rounded-2xl border border-neutral-800 bg-black/40 p-4 text-sm text-neutral-300">
          No presets loaded. Ensure <span className="font-semibold text-white">/data/wow/quick-sim-presets.json</span>{" "}
          exists (disk or Blob) and has at least one spec.
        </div>
      ) : null}
    </div>
  );

  const StatsPanel = (
    <Panel
      title="Stats"
      right={
        <div className="text-[11px] text-neutral-500">
          AP/SP derived from Main Stat × multipliers.
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SmallNumberInput label="Main Stat" value={mainStat} onChange={setMainStat} step={50} />
        <SmallNumberInput label="Weapon DPS" value={weaponDps} onChange={setWeaponDps} step={5} />

        <SmallNumberInput label="Crit %" value={critPct} onChange={setCritPct} step={0.5} suffix="%" />
        <SmallNumberInput label="Haste %" value={hastePct} onChange={setHastePct} step={0.5} suffix="%" />

        <SmallNumberInput label="Mastery %" value={masteryPct} onChange={setMasteryPct} step={0.5} suffix="%" />
        <SmallNumberInput label="Vers %" value={versPct} onChange={setVersPct} step={0.5} suffix="%" />

        <SmallNumberInput
          label="Burst Uptime %"
          value={burstUptimePct}
          onChange={setBurstUptimePct}
          step={1}
          suffix="%"
        />
        <SmallNumberInput
          label="Crit Bonus %"
          value={critDamageBonusPct}
          onChange={setCritDamageBonusPct}
          step={0.5}
          suffix="%"
        />
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-semibold text-neutral-300">Advanced (AP/SP multipliers)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <SmallNumberInput label="AP per Main" value={apFromMain} onChange={setApFromMain} step={0.05} />
          <SmallNumberInput label="SP per Main" value={spFromMain} onChange={setSpFromMain} step={0.05} />
        </div>
      </details>
    </Panel>
  );

  const TargetPanel = (
    <details className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
      <summary className="cursor-pointer text-sm font-semibold text-neutral-200">Target + Buffs</summary>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SmallNumberInput label="Armor DR %" value={armorDrPct} onChange={setArmorDrPct} step={0.5} suffix="%" />
        <SmallNumberInput label="Magic DR %" value={magicDrPct} onChange={setMagicDrPct} step={0.5} suffix="%" />

        <SmallNumberInput label="Raid Buff %" value={raidBuffPct} onChange={setRaidBuffPct} step={0.5} suffix="%" />
        <SmallNumberInput
          label="Consumables %"
          value={consumablePct}
          onChange={setConsumablePct}
          step={0.5}
          suffix="%"
        />

        <div className="sm:col-span-2">
          <SmallNumberInput
            label="Custom Mult %"
            value={externalMultPct}
            onChange={setExternalMultPct}
            step={0.5}
            suffix="%"
          />
        </div>
      </div>
    </details>
  );

  const GearPanel = (
    <details className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
      <summary className="cursor-pointer text-sm font-semibold text-neutral-200">Gear (Optional)</summary>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={recomputeGearTotalsAndApply}
          className="h-10 rounded-xl border border-neutral-800 bg-black px-4 text-sm text-neutral-200 hover:border-neutral-600 hover:text-white"
        >
          Apply gear → inputs
        </button>
        <div className="text-[11px] text-neutral-500">
          Sums Primary + picks highest Weapon DPS from selected items.
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-neutral-800 bg-black/40 p-4">
          <div className="text-[11px] text-neutral-500">Last totals</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-neutral-800 bg-black/30 p-2">
              <div className="text-[11px] text-neutral-500">Primary</div>
              <div className="font-semibold text-neutral-200">{fmt(gearTotals.primary, 0)}</div>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-black/30 p-2">
              <div className="text-[11px] text-neutral-500">Weapon DPS</div>
              <div className="font-semibold text-neutral-200">{fmt(gearTotals.weaponDps, 0)}</div>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-black/30 p-2">
              <div className="text-[11px] text-neutral-500">Crit (rating)</div>
              <div className="font-semibold text-neutral-200">{fmt(gearTotals.crit, 0)}</div>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-black/30 p-2">
              <div className="text-[11px] text-neutral-500">Haste (rating)</div>
              <div className="font-semibold text-neutral-200">{fmt(gearTotals.haste, 0)}</div>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-black/30 p-2">
              <div className="text-[11px] text-neutral-500">Mastery (rating)</div>
              <div className="font-semibold text-neutral-200">{fmt(gearTotals.mastery, 0)}</div>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-black/30 p-2">
              <div className="text-[11px] text-neutral-500">Vers (rating)</div>
              <div className="font-semibold text-neutral-200">{fmt(gearTotals.vers, 0)}</div>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-neutral-500">
            Note: rating → % conversion varies by level/expansion. Keep % inputs manual for now.
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-black/40 p-4">
          <div className="text-[11px] text-neutral-500">
            Tip: search by name, then pick from top ilvl results.
          </div>
          <div className="mt-2 text-[11px] text-neutral-600">
            Your pack files are read from{" "}
            <span className="text-neutral-400 font-semibold">/data/wow/items/packs/</span>.
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {GEAR_SLOTS.map((slot) => {
          const slotKey = slot.key;
          const allowMulti = !!slot.allowMulti;
          const picks = allowMulti ? [0, 1] : [0];

          return (
            <div key={slotKey} className="rounded-2xl border border-neutral-800 bg-black/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-neutral-200">{slot.label}</div>
                <div className="text-[11px] text-neutral-500">{slot.inventoryTypeKeys.join("/")}</div>
              </div>

              <div className="mt-3 space-y-3">
                {picks.map((which) => {
                  const qKey = `${slotKey}:${which}`;
                  const q = gearQuery[qKey] ?? "";
                  const selected = selectedLabelFor(slotKey, which);
                  const results = slotResults(slot, q);

                  return (
                    <div key={qKey}>
                      <SearchDropdown
                        placeholder={
                          allowMulti ? `Search ${slot.label} ${which + 1}…` : `Search ${slot.label}…`
                        }
                        query={q}
                        setQuery={(v) => setGearQuery((prev) => ({ ...prev, [qKey]: v }))}
                        results={results}
                        selectedLabel={selected}
                        onPick={(row) => {
                          const id = typeof (row as any).id === "number" ? (row as any).id : 0;
                          if (id > 0) setSlotPick(slotKey, which, id);
                          setGearQuery((prev) => ({ ...prev, [qKey]: "" }));
                        }}
                        onClear={() => setSlotPick(slotKey, which, null)}
                        maxResults={10}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );

  const RotationPanel = (
    <details className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
      <summary className="cursor-pointer text-sm font-semibold text-neutral-200">Rotation (UPM)</summary>
      <div className="mt-4 space-y-2">
        {spec?.abilities?.map((a) => {
          const upmVal = upmOverrides[a.id] ?? a.baseUpm;
          const hasteMult = pctToMult(hastePct);
          const upmEff =
            (a.hasteAffectsRate ? upmVal * hasteMult : upmVal) *
            (a.tags?.includes("burst") ? clamp(burstUptimePct / 100, 0, 1) : 1);

          return (
            <div key={a.id} className="rounded-2xl border border-neutral-800 bg-black/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{a.name}</div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    {a.school}
                    {a.hasteAffectsRate ? " • haste→rate" : ""}
                    {a.tags?.includes("burst") ? " • burst" : ""}
                  </div>
                </div>

                <div className="w-28">
                  <input
                    className="h-10 w-full rounded-xl border border-neutral-800 bg-black px-3 text-sm text-neutral-100 outline-none focus:border-neutral-600"
                    type="number"
                    value={upmVal}
                    onChange={(e) =>
                      setUpmOverrides((prev) => ({
                        ...prev,
                        [a.id]: Number(e.target.value),
                      }))
                    }
                    step={1}
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-500">
                <span>Eff UPM</span>
                <span className="font-semibold text-neutral-200">{fmt(upmEff, 2)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );

  const ResultsPanel = (
    <div className="space-y-4">
      <div className="rounded-2xl border border-neutral-800 bg-black p-6 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
        <div className="text-xs text-neutral-400">Total DPS</div>
        <div className="mt-2 text-4xl font-black">{fmt(computed.totalDps, 1)}</div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-neutral-800 bg-black/40 p-4">
            <div className="text-xs text-neutral-500">Derived AP</div>
            <div className="mt-1 font-bold">{fmt(computed.AP, 0)}</div>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-black/40 p-4">
            <div className="text-xs text-neutral-500">Derived SP</div>
            <div className="mt-1 font-bold">{fmt(computed.SP, 0)}</div>
          </div>
        </div>

        <div className="mt-4 text-[11px] text-neutral-500">
          Expected hit × rate (UPM). Sorted by contribution.
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
        <div className="text-sm font-semibold text-neutral-200">Breakdown</div>
        <div className="mt-3 space-y-2">
          {computed.rows.map((r) => {
            const pct = computed.totalDps > 0 ? (r.dps / computed.totalDps) * 100 : 0;

            return (
              <div key={r.ability.id} className="rounded-2xl border border-neutral-800 bg-black/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{r.ability.name}</div>
                    <div className="mt-1 text-[11px] text-neutral-500">
                      {r.ability.school}
                      {r.ability.hasteAffectsRate ? " • haste→rate" : ""}
                      {r.ability.tags?.includes("burst") ? " • burst" : ""}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] text-neutral-500">DPS</div>
                    <div className="text-lg font-black">{fmt(r.dps, 1)}</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl border border-neutral-800 bg-black/30 p-2">
                    <div className="text-[11px] text-neutral-500">Expected Hit</div>
                    <div className="font-semibold text-neutral-200">{fmt(r.expectedAfterMit, 0)}</div>
                  </div>
                  <div className="rounded-xl border border-neutral-800 bg-black/30 p-2">
                    <div className="text-[11px] text-neutral-500">Eff UPM</div>
                    <div className="font-semibold text-neutral-200">{fmt(r.upmEff, 2)}</div>
                  </div>
                  <div className="rounded-xl border border-neutral-800 bg-black/30 p-2">
                    <div className="text-[11px] text-neutral-500">Share</div>
                    <div className="font-semibold text-neutral-200">{fmt(pct, 1)}%</div>
                  </div>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full border border-neutral-800 bg-black/30">
                  <div className="h-full bg-white/15" style={{ width: `${clamp(pct, 0, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  /* =========================
     Render
  ========================= */

  // Mobile tabs (simple, minimal)
  const MobileTabs = (
    <div className="sm:hidden sticky top-3 z-30">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/85 backdrop-blur p-2">
        <div className="flex gap-2">
          <ChipButton active={mobileTab === "stats"} onClick={() => setMobileTab("stats")}>
            Stats
          </ChipButton>
          <ChipButton active={mobileTab === "gear"} onClick={() => setMobileTab("gear")}>
            Gear
          </ChipButton>
          <ChipButton active={mobileTab === "results"} onClick={() => setMobileTab("results")}>
            Results
          </ChipButton>
        </div>
      </div>
    </div>
  );

  if (!spec) {
    return (
      <div className="space-y-4">
        {TopBar}
        <div className="rounded-2xl border border-neutral-800 bg-black/40 p-4 text-sm text-neutral-300">
          Missing presets. Create <span className="font-semibold text-white">/public/data/wow/quick-sim-presets.json</span>{" "}
          (or upload to Blob) with at least one spec preset.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {MobileTabs}

      {/* Desktop: 2-column, sticky results */}
      <div className="hidden sm:grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-start">
        <div className="space-y-6">
          {TopBar}
          {StatsPanel}
          {GearPanel}
          {TargetPanel}
          {RotationPanel}
        </div>

        <div className="sticky top-6">{ResultsPanel}</div>
      </div>

      {/* Mobile: tabbed content */}
      <div className="sm:hidden space-y-6">
        {TopBar}
        {mobileTab === "stats" ? (
          <>
            {StatsPanel}
            {TargetPanel}
            {RotationPanel}
          </>
        ) : null}

        {mobileTab === "gear" ? <>{GearPanel}</> : null}
        {mobileTab === "results" ? <>{ResultsPanel}</> : null}
      </div>
    </div>
  );
}
