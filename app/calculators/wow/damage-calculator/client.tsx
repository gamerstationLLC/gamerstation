"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PresetsFile, SpecPreset, ItemIndexRow } from "./page";

/* =========================
   Types / constants
========================= */

type TabKey = "inputs" | "results";

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
  | "CHEST"
  | "WAIST"
  | "LEGS"
  | "FEET"
  | "WRIST"
  | "HANDS"
  | "FINGER"
  | "TRINKET"
  | "BACK"
  | "MAIN_HAND"
  | "OFF_HAND"
  | "TWO_HAND";

const GEAR_SLOTS: Array<{
  key: GearSlotKey;
  label: string;
  inventoryTypeKeys: string[]; // match itemIndexRow.inventoryTypeKey
  allowMulti?: boolean; // rings/trinkets
}> = [
  { key: "HEAD", label: "Head", inventoryTypeKeys: ["HEAD"] },
  { key: "NECK", label: "Neck", inventoryTypeKeys: ["NECK"] },
  { key: "SHOULDER", label: "Shoulder", inventoryTypeKeys: ["SHOULDER"] },
  { key: "BACK", label: "Back", inventoryTypeKeys: ["CLOAK"] },
  { key: "CHEST", label: "Chest", inventoryTypeKeys: ["CHEST", "ROBE"] },
  { key: "WRIST", label: "Wrist", inventoryTypeKeys: ["WRIST"] },
  { key: "HANDS", label: "Hands", inventoryTypeKeys: ["HANDS"] },
  { key: "WAIST", label: "Waist", inventoryTypeKeys: ["WAIST"] },
  { key: "LEGS", label: "Legs", inventoryTypeKeys: ["LEGS"] },
  { key: "FEET", label: "Feet", inventoryTypeKeys: ["FEET"] },
  { key: "FINGER", label: "Ring", inventoryTypeKeys: ["FINGER"], allowMulti: true },
  { key: "TRINKET", label: "Trinket", inventoryTypeKeys: ["TRINKET"], allowMulti: true },

  // weapon-ish types (DB may vary by expansion; include common keys)
  {
    key: "MAIN_HAND",
    label: "Main Hand",
    inventoryTypeKeys: ["MAIN_HAND", "ONE_HAND", "WEAPONMAINHAND"],
  },
  {
    key: "OFF_HAND",
    label: "Off Hand",
    inventoryTypeKeys: ["OFF_HAND", "HOLDABLE", "WEAPONOFFHAND"],
  },
  { key: "TWO_HAND", label: "Two-Hand", inventoryTypeKeys: ["TWO_HAND", "2HWEAPON"] },
];

/* =========================
   Math helpers (unchanged)
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
   Sim inputs + compute (unchanged)
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
   UI helpers (yours)
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
  const { value, onChange, min, max, step, suffix, widthClass = "w-24", disabled } = props;

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
            <div className="mt-1 text-xs text-neutral-500 leading-snug">{props.sub}</div>
          ) : null}
        </div>
        {props.right ? <div className="shrink-0">{props.right}</div> : null}
      </div>
      {props.children ? <div className="mt-3">{props.children}</div> : null}
    </div>
  );
}

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
   Searchable dropdown (new)
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
  const { placeholder, query, setQuery, results, onPick, selectedLabel, onClear, maxResults = 10 } = props;

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

  const shown = results.slice(0, maxResults);

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2">
        <input
          className={[
            "h-9 w-[260px] max-w-[62vw] rounded-xl border border-neutral-800 bg-black px-3 text-sm text-neutral-100 outline-none transition",
            "focus:border-neutral-600",
          ].join(" ")}
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
            className="h-9 rounded-xl border border-neutral-800 bg-black px-3 text-xs text-neutral-200 hover:border-neutral-600 hover:text-white"
            title="Clear"
          >
            Clear
          </button>
        ) : null}
      </div>

      {selectedLabel ? (
        <div className="mt-2 text-xs text-neutral-400 truncate">
          Selected: <span className="text-neutral-200 font-semibold">{selectedLabel}</span>
        </div>
      ) : null}

      {open ? (
        <div className="absolute z-40 mt-2 w-full max-w-[460px] overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          <div className="max-h-[320px] overflow-auto p-2">
            {shown.length ? (
              shown.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onPick(r);
                    setOpen(false);
                  }}
                  className="w-full rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-neutral-700 hover:bg-black"
                >
                  <div className="text-sm font-semibold text-white truncate">{r.name}</div>
                  <div className="mt-1 text-[11px] text-neutral-500 flex items-center gap-2">
                    <span className="truncate">{r.inventoryTypeKey ?? "—"}</span>
                    {typeof r.itemLevel === "number" ? <span>ilvl {r.itemLevel}</span> : null}
                    {r.quality ? <span className="truncate">{r.quality}</span> : null}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-xs text-neutral-500">
                No matches. Try fewer words.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* =========================
   Item parsing helpers (new)
========================= */

function sumStatsFromDetail(detail: any) {
  const out: Partial<Record<StatKey, number>> = {};
  const stats = detail?.stats;

  // your DB builder supports either array stats or record-ish stats
  if (Array.isArray(stats)) {
    for (const s of stats) {
      const type = (s?.type ?? s?.stat ?? s?.name ?? "").toString().toUpperCase();
      const val = Number(s?.value ?? s?.amount ?? 0);
      if (!Number.isFinite(val) || !type) continue;

      // try to map to our keys
      const k = type as StatKey;
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
  // Blizzard item schema varies; best-effort.
  // If we can’t find it, return 0 and user can enter manually.
  const dps =
    Number(detail?.weapon?.damage_per_second) ||
    Number(detail?.weapon?.dps) ||
    Number(detail?.weapon?.dps_value) ||
    0;
  return Number.isFinite(dps) ? dps : 0;
}

/* =========================
   Component
========================= */

export default function WowDamageCalcClient(props: {
  presets: PresetsFile | null;
  itemsIndex: ItemIndexRow[];
}) {
  const [tab, setTab] = useState<TabKey>("inputs");

  // ✅ presets come from page.tsx JSON; fallback to minimal empty structure
  const presets: PresetsFile = useMemo(() => {
    if (props.presets?.specs?.length) return props.presets;
    return { version: "missing", specs: [] };
  }, [props.presets]);

  const [specId, setSpecId] = useState<string>(() => presets.specs[0]?.id ?? "");

  useEffect(() => {
    if (!presets.specs.length) return;
    if (!presets.specs.some((s) => s.id === specId)) {
      setSpecId(presets.specs[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets.version, presets.specs.length]);

  const spec = useMemo(() => {
    return presets.specs.find((s) => s.id === specId) ?? presets.specs[0] ?? null;
  }, [presets, specId]);

  /* =========================
     Core inputs (your existing)
  ========================= */

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
    if (!spec) return;
    setUpmOverrides((prev) => {
      const next: Record<string, number> = { ...prev };
      for (const a of spec.abilities) {
        if (next[a.id] == null) next[a.id] = a.baseUpm;
      }
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
     Gear state (new)
  ========================= */

  const itemsIndex = props.itemsIndex ?? [];

  // selected item ids per slot (support multi for ring/trinket)
  const [gear, setGear] = useState<Record<string, number[]>>(() => ({}));

  // per-slot search query
  const [gearQuery, setGearQuery] = useState<Record<string, string>>(() => ({}));

  // cached packs: packNo -> PackedItem[]
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
      const pack = await getPack(row.pack);
      const found = pack.find((p) => p?.id === row.id);
      return found?.detail ?? null;
    } catch {
      return null;
    }
  }

  const gearDerived = useMemo(() => {
    // aggregate selected item rows (index only) and pull known totals we can compute once we have details
    // We’ll compute totals from details that have been loaded; if not loaded yet, totals will be partial until Apply is pressed.
    return {
      selectedCount: Object.values(gear).reduce((s, arr) => s + (arr?.length ?? 0), 0),
    };
  }, [gear]);

  const [primaryStat, setPrimaryStat] = useState<PrimaryStat>("STRENGTH");

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
    // load details for all selected items, sum stats, and apply to inputs
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

    // map id -> index row
    const rowById = new Map<number, ItemIndexRow>();
    for (const r of itemsIndex) rowById.set(r.id, r);

    for (const pick of allSelectedIds) {
      const row = rowById.get(pick.id);
      if (!row) continue;

      const detail = await resolveItemDetail(row);
      if (!detail) continue;

      loaded += 1;

      const stats = sumStatsFromDetail(detail);

      primary += Number(stats[primaryStat] ?? 0) || 0;

      crit += Number(stats.CRIT_RATING ?? 0) || 0;
      haste += Number(stats.HASTE_RATING ?? 0) || 0;
      mastery += Number(stats.MASTERY_RATING ?? 0) || 0;
      vers += Number(stats.VERSATILITY ?? 0) || 0;

      // weapon dps: pick the highest we see (main-hand / 2h usually)
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

    // Apply to inputs (simple + explainable):
    // - Main Stat set to derived primary
    // - Weapon DPS set if non-zero
    // - Secondary ratings are *not* auto-converted to % here (that needs rating->% tables by level),
    //   so we apply them as a “hint” by setting the % fields ONLY if user wants; for now, keep % manual.
    setMainStat(primary > 0 ? primary : mainStat);
    if (wDps > 0) setWeaponDps(wDps);
  }

  /* =========================
     Search for each slot (index-only)
  ========================= */

  function slotResults(slot: (typeof GEAR_SLOTS)[number], q: string) {
    const tq = tokenizeQuery(q);
    const keys = new Set(slot.inventoryTypeKeys);

    // filter by slot first (cheap)
    let pool = itemsIndex.filter((r) => {
      const k = (r.inventoryTypeKey || "").toUpperCase();
      if (!k) return false;
      return keys.has(k);
    });

    // query match: token contains all query tokens
    if (tq.length) {
      pool = pool.filter((r) => {
        const toks = Array.isArray(r.tokens) ? r.tokens : [];
        // require every query token to match either nameNorm substring or tokens contain
        const nameNorm = (r.nameNorm || "").toLowerCase();
        return tq.every((t) => nameNorm.includes(t) || toks.includes(t));
      });
    }

    // sort: prefer higher ilvl then name
    pool.sort((a, b) => (safeNum(b.itemLevel, 0) - safeNum(a.itemLevel, 0)) || a.name.localeCompare(b.name));

    return pool;
  }

  function selectedLabelFor(slotKey: string, idx: number) {
    const id = gear[slotKey]?.[idx];
    if (!id) return "";
    const row = itemsIndex.find((r) => r.id === id);
    return row ? row.name : `Item ${id}`;
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
     Layout bits (yours)
  ========================= */

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

  /* =========================
     Panels
  ========================= */

  const InputsPanel = (
    <div className={`${card} p-3 sm:p-5`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-bold text-neutral-200">Quick Sim Inputs</div>
        <div className="hidden sm:block text-xs text-neutral-500">Stats + UPM → sim-like DPS breakdown.</div>
      </div>

      {!spec ? (
        <div className="rounded-2xl border border-neutral-800 bg-black/40 p-4 text-sm text-neutral-300">
          No presets loaded yet. Make sure{" "}
          <span className="font-semibold text-white">public/data/wow/quick-sim-presets.json</span>{" "}
          exists (or is uploaded to Blob) and contains at least one spec.
        </div>
      ) : (
        <div className="space-y-3">
          <InputCard
            title="Spec Preset"
            sub="Loads a curated ability list for sim-like DPS breakdown."
            right={
              <select
                className="h-9 w-56 max-w-[70vw] rounded-xl border border-neutral-800 bg-black px-3 text-sm text-neutral-100 outline-none focus:border-neutral-600"
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

          {/* ✅ NEW: Gear selection (searchable) */}
          <InputCard
            title="Gear (Searchable)"
            sub="Pick items from your item DB. Then click “Apply gear → inputs” to fill Main Stat + Weapon DPS."
            right={
              <button
                type="button"
                onClick={recomputeGearTotalsAndApply}
                className="h-9 rounded-xl border border-neutral-800 bg-black px-3 text-xs text-neutral-200 hover:border-neutral-600 hover:text-white"
              >
                Apply gear → inputs
              </button>
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <InputRow
                label="Primary Stat"
                sub="Used to sum main stat from items."
                control={
                  <select
                    className="h-9 w-40 rounded-xl border border-neutral-800 bg-black px-3 text-sm text-neutral-100 outline-none focus:border-neutral-600"
                    value={primaryStat}
                    onChange={(e) => setPrimaryStat(e.target.value as PrimaryStat)}
                  >
                    <option value="STRENGTH">Strength</option>
                    <option value="AGILITY">Agility</option>
                    <option value="INTELLECT">Intellect</option>
                  </select>
                }
              />
              <div className="rounded-xl border border-neutral-800 bg-black/30 px-3 py-2">
                <div className="text-[12px] font-semibold text-neutral-200 leading-tight">
                  Selected Items
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  {gearDerived.selectedCount} selected • {gearTotals.loadedItems} loaded
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {GEAR_SLOTS.map((slot) => {
                const slotKey = slot.key;
                const allowMulti = !!slot.allowMulti;

                const picks = allowMulti ? [0, 1] : [0];
                return (
                  <div key={slotKey} className="rounded-2xl border border-neutral-800 bg-black/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-neutral-200">{slot.label}</div>
                      <div className="text-[11px] text-neutral-500">
                        {slot.inventoryTypeKeys.join("/")}
                      </div>
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
                              placeholder={allowMulti ? `Search ${slot.label} ${which + 1}…` : `Search ${slot.label}…`}
                              query={q}
                              setQuery={(v) => setGearQuery((prev) => ({ ...prev, [qKey]: v }))}
                              results={results}
                              selectedLabel={selected}
                              onPick={(row) => {
                                setSlotPick(slotKey, which, row.id);
                                // keep slot active but clear query
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

            <div className="mt-3 rounded-2xl border border-neutral-800 bg-black/40 p-3">
              <div className="text-xs text-neutral-500">Last gear totals</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                <div className="rounded-xl border border-neutral-800 bg-black/30 p-2">
                  <div className="text-[11px] text-neutral-500">Primary</div>
                  <div className="font-semibold text-neutral-200">{fmt(gearTotals.primary, 0)}</div>
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

              <div className="mt-2 text-[11px] text-neutral-500">
                Note: rating → % conversion varies by level and expansion. For now, keep % inputs manual and use gear totals as a guide.
              </div>
            </div>
          </InputCard>

          <InputCard title="Character Stats" sub="Quick inputs (fast sim feel).">
            <div className="grid gap-2 sm:grid-cols-2">
              <InputRow
                label="Main Stat"
                control={<SmallNumberInput value={mainStat} onChange={setMainStat} step={50} widthClass="w-24" />}
              />
              <InputRow
                label="Weapon DPS"
                sub="Only affects weapon-scaled abilities."
                control={<SmallNumberInput value={weaponDps} onChange={setWeaponDps} step={5} widthClass="w-24" />}
              />

              <InputRow
                label="Crit %"
                control={
                  <SmallNumberInput value={critPct} onChange={setCritPct} step={0.5} widthClass="w-20" suffix="%" />
                }
              />
              <InputRow
                label="Haste %"
                sub="Scales UPM for haste→rate abilities."
                control={
                  <SmallNumberInput value={hastePct} onChange={setHastePct} step={0.5} widthClass="w-20" suffix="%" />
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
                  <SmallNumberInput value={versPct} onChange={setVersPct} step={0.5} widthClass="w-20" suffix="%" />
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
                  control={<SmallNumberInput value={apFromMain} onChange={setApFromMain} step={0.05} widthClass="w-20" />}
                />
                <InputRow
                  label="SP per Main"
                  control={<SmallNumberInput value={spFromMain} onChange={setSpFromMain} step={0.05} widthClass="w-20" />}
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
                  <SmallNumberInput value={armorDrPct} onChange={setArmorDrPct} step={0.5} widthClass="w-20" suffix="%" />
                }
              />
              <InputRow
                label="Magic DR %"
                sub="MAGIC only."
                control={
                  <SmallNumberInput value={magicDrPct} onChange={setMagicDrPct} step={0.5} widthClass="w-20" suffix="%" />
                }
              />
            </div>
          </InputCard>

          <InputCard title="Buffs / Multipliers" sub="Optional external amps (kept explainable).">
            <div className="grid gap-2 sm:grid-cols-2">
              <InputRow
                label="Raid Buff %"
                control={
                  <SmallNumberInput value={raidBuffPct} onChange={setRaidBuffPct} step={0.5} widthClass="w-20" suffix="%" />
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
                  <div key={a.id} className="rounded-xl border border-neutral-800 bg-black/30 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{a.name}</div>
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
      )}
    </div>
  );

  const ResultsPanel = (
    <div className={`${card} p-3 sm:p-5`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-bold text-neutral-200">Results</div>
        <div className="hidden sm:block text-xs text-neutral-500">
          {spec ? `${spec.className} — ${spec.name}` : "—"}
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
              <div key={r.ability.id} className="rounded-xl border border-neutral-800 bg-black/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{r.ability.name}</div>
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
                    <div className="font-semibold text-neutral-200">{fmt(r.expectedAfterMit, 0)}</div>
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
                  <div className="h-full bg-white/20" style={{ width: `${clamp(pct, 0, 100)}%` }} />
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
      <div className="sm:hidden sticky top-3 z-30">
        <div className="mx-auto w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-950/90 backdrop-blur p-2">
          {Tabs}
        </div>
      </div>

      <div className="sm:hidden space-y-4">{tab === "inputs" ? InputsPanel : ResultsPanel}</div>

      <div className="hidden sm:grid gap-4 items-start lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="self-start">{InputsPanel}</div>
        <div className="self-start">{ResultsPanel}</div>
      </div>
    </div>
  );
}
