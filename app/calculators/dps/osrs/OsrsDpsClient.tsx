"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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

import type { EnemyPreset } from "@/lib/osrs/enemies";
import { OSRS_SLOTS, type OsrsItemRow, type OsrsSlot } from "@/lib/osrs/items";

/* =========================
   Formatting helpers
========================= */
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

/* =========================
   Input sanitizers
========================= */
function onlyDigits(s: string) {
  return s.replace(/[^\d]/g, "");
}
function clamp99(n: number) {
  return Math.max(0, Math.min(99, n));
}
function toNumOr(n: string, fallback: number) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

type Equipped = Partial<Record<OsrsSlot, OsrsItemRow>>;

function add(a: number | undefined, b: number | undefined) {
  return (a ?? 0) + (b ?? 0);
}
/* =========================
   Slot JSON loader (PUBLIC)
   Reads from: /public/data/osrs/items/*.json
========================= */
async function loadItemsForSlot(slot: OsrsSlot): Promise<OsrsItemRow[]> {
  const path = `/data/osrs/items/${slot}.json`;

  try {
    const res = await fetch(path, { cache: "force-cache" });
    if (!res.ok) return [];

    const json = await res.json();

    const items =
      Array.isArray(json)
        ? (json as OsrsItemRow[])
        : json && Array.isArray(json.items)
        ? (json.items as OsrsItemRow[])
        : [];

    // Remove exact stat duplicates
    const seen = new Set<string>();
    return items.filter((it) => {
      const key = [
        it.name?.trim().toLowerCase() ?? "",
        it.slot ?? "",
        it.attackBonus ?? 0,
        it.strengthBonus ?? 0,
        it.rangedStrength ?? 0,
        it.magicDamagePct ?? 0,
        it.speedTicks ?? 0,
      ].join("|");

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
}

type MobileTab = "user" | "enemies" | "results";

export default function OsrsDpsPage() {
  // =========
  // MODE/TABS
  // =========
  const [style, setStyle] = useState<Style>("melee");

  // Mobile section tabs
  const [mobileTab, setMobileTab] = useState<MobileTab>("user");

  // =========
  // HISCORES IMPORT
  // =========
  const [rsn, setRsn] = useState("");
  const [hsLoading, setHsLoading] = useState(false);
  const [hsError, setHsError] = useState<string | null>(null);

  // =========
  // COLLAPSIBLES
  // =========
  const [openPlayerLevels, setOpenPlayerLevels] = useState(false);
  const [openGearBonuses, setOpenGearBonuses] = useState(false);
  const [openTarget, setOpenTarget] = useState(false);
  const [openResults, setOpenResults] = useState(true);
  const [openGear, setOpenGear] = useState(true);

  // =========
  // PLAYER LEVELS (STRING STATE)
  // =========
  const [atkLevel, setAtkLevel] = useState<string>("75");
  const [strLevel, setStrLevel] = useState<string>("75");
  const [rngLevel, setRngLevel] = useState<string>("75");
  const [magLevel, setMagLevel] = useState<string>("75");

  const atkLevelNum = useMemo(() => (atkLevel === "" ? 1 : clamp99(toNumOr(atkLevel, 1))), [atkLevel]);
  const strLevelNum = useMemo(() => (strLevel === "" ? 1 : clamp99(toNumOr(strLevel, 1))), [strLevel]);
  const rngLevelNum = useMemo(() => (rngLevel === "" ? 1 : clamp99(toNumOr(rngLevel, 1))), [rngLevel]);
  const magLevelNum = useMemo(() => (magLevel === "" ? 1 : clamp99(toNumOr(magLevel, 1))), [magLevel]);

  // =========
  // GEAR INPUTS (knobs math uses)
  // =========
  const [attackBonus, setAttackBonus] = useState(100);
  const [strengthBonus, setStrengthBonus] = useState(80);
  const [rangedStrength, setRangedStrength] = useState(80);
  const [magicDamagePct, setMagicDamagePct] = useState(0);
  const [speedTicks, setSpeedTicks] = useState(4);

  // =========
  // BUFFS
  // =========
  const [meleePrayer, setMeleePrayer] = useState<MeleePrayer>("none");
  const [rangedPrayer, setRangedPrayer] = useState<RangedPrayer>("none");
  const [magicPrayer, setMagicPrayer] = useState<MagicPrayer>("none");
  const [potion, setPotion] = useState<Potion>("none");

  // =========
  // TARGET / ENEMY
  // =========
  const [enemyKey, setEnemyKey] = useState("custom");

  const [targetHp, setTargetHp] = useState<string>("150");
  const [targetDefLevel, setTargetDefLevel] = useState<string>("100");
  const [targetDefBonus, setTargetDefBonus] = useState<string>("100");

  const targetHpNum = useMemo(() => clamp(toNumOr(targetHp, 150), 1, 5000), [targetHp]);
  const targetDefLevelNum = useMemo(() => clamp(toNumOr(targetDefLevel, 100), 1, 400), [targetDefLevel]);
  const targetDefBonusNum = useMemo(() => clamp(toNumOr(targetDefBonus, 100), -200, 400), [targetDefBonus]);

  // =========
  // ENEMIES (lazy-load from PUBLIC)
  // Reads from: /public/data/osrs/enemies.json
  // =========
  const CUSTOM_ENEMY: EnemyPreset = {
    key: "custom",
    name: "Custom",
    hp: 150,
    defLevel: 100,
    defBonus: 100,
  };

  const [enemyOptions, setEnemyOptions] = useState<EnemyPreset[]>([CUSTOM_ENEMY]);
  const [enemiesLoaded, setEnemiesLoaded] = useState(false);
  const [enemiesLoading, setEnemiesLoading] = useState(false);
  const [enemiesError, setEnemiesError] = useState<string | null>(null);

  const [enemyQuery, setEnemyQuery] = useState("");
  const [enemyOpen, setEnemyOpen] = useState(false);

  const enemyWrapRef = useRef<HTMLDivElement | null>(null);
  const enemyInputRef = useRef<HTMLInputElement | null>(null);

  const enemiesCacheRef = useRef<EnemyPreset[] | null>(null);

  async function loadAllEnemies() {
    if (enemiesLoaded || enemiesLoading) return;

    if (enemiesCacheRef.current) {
      setEnemyOptions(enemiesCacheRef.current);
      setEnemiesLoaded(true);
      return;
    }

    setEnemiesLoading(true);
    setEnemiesError(null);

    try {
      const res = await fetch("/data/osrs/enemies/enemies.json", {
        cache: "no-store",
      });

      const text = await res.text();

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
      if (!text.trim()) throw new Error("Empty response body");

      const json = JSON.parse(text);
      const full = Array.isArray(json?.enemies) ? (json.enemies as EnemyPreset[]) : [];

      const merged: EnemyPreset[] = [CUSTOM_ENEMY, ...full.filter((e) => e?.key !== "custom")];

      enemiesCacheRef.current = merged;
      setEnemyOptions(merged);
      setEnemiesLoaded(true);
    } catch (e) {
      console.error("loadAllEnemies failed:", e);
      setEnemiesError("Could not load the enemy list.");
      setEnemyOptions([CUSTOM_ENEMY]);
      setEnemiesLoaded(false);
    } finally {
      setEnemiesLoading(false);
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function onDocMouseDown(ev: MouseEvent) {
      const el = enemyWrapRef.current;
      if (!el) return;
      if (!el.contains(ev.target as Node)) setEnemyOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const filteredEnemies = useMemo(() => {
    if (!enemiesLoaded) return [] as EnemyPreset[];
    const q = enemyQuery.trim().toLowerCase();
    const base = enemyOptions;
    const list = !q ? base : base.filter((en: EnemyPreset) => en.name.toLowerCase().includes(q));
    return list.slice(0, 50);
  }, [enemyOptions, enemyQuery, enemiesLoaded]);

  function applyEnemyPreset(key: string) {
    setEnemyKey(key);

    const p = enemyOptions.find((x: EnemyPreset) => x.key === key) ?? CUSTOM_ENEMY;

    setTargetHp(String(p.hp));
    setTargetDefLevel(String(p.defLevel));
    setTargetDefBonus(String(p.defBonus));
  }

  // =========
  // PAPER DOLL / SEARCH (items)
  // =========
  const [activeSlot, setActiveSlot] = useState<OsrsSlot>("weapon");
  const [query, setQuery] = useState("");
  const [equipped, setEquipped] = useState<Equipped>({});
  const [searchOpen, setSearchOpen] = useState(false);

  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [slotItems, setSlotItems] = useState<OsrsItemRow[]>([]);
  const slotCacheRef = useRef<Partial<Record<OsrsSlot, OsrsItemRow[]>>>({});

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const cached = slotCacheRef.current[activeSlot];
      if (cached) {
        setSlotItems(cached);
        return;
      }
      try {
        const items = await loadItemsForSlot(activeSlot);
        if (cancelled) return;
        slotCacheRef.current[activeSlot] = items;
        setSlotItems(items);
      } catch {
        if (!cancelled) setSlotItems([]);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [activeSlot]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return slotItems
      .filter((it) => {
        if (!q) return true;
        return it.name.toLowerCase().includes(q);
      })
      .slice(0, 40);
  }, [slotItems, query]);

  const derived = useMemo(() => {
    let atk = 0;
    let str = 0;
    let rngStr = 0;
    let magDmg = 0;
    let spd: number | null = null;

    for (const slot of Object.keys(equipped) as OsrsSlot[]) {
      const it = equipped[slot];
      if (!it) continue;
      atk = add(atk, it.attackBonus);
      str = add(str, it.strengthBonus);
      rngStr = add(rngStr, it.rangedStrength);
      magDmg = add(magDmg, it.magicDamagePct);
      if (slot === "weapon" && typeof it.speedTicks === "number") spd = it.speedTicks;
    }
    return { atk, str, rngStr, magDmg, spd };
  }, [equipped]);

  const gearSynced = useMemo(() => {
    return {
      attackBonus: derived.atk,
      strengthBonus: derived.str,
      rangedStrength: derived.rngStr,
      magicDamagePct: derived.magDmg,
      speedTicks: derived.spd ?? speedTicks,
    };
  }, [derived, speedTicks]);

  function equipItem(item: OsrsItemRow) {
    setEquipped((prev) => ({ ...prev, [item.slot]: item }));
    setQuery("");
    setSearchOpen(false);

    setAttackBonus(derived.atk + (item.attackBonus ?? 0));
    setStrengthBonus(derived.str + (item.strengthBonus ?? 0));
    setRangedStrength(derived.rngStr + (item.rangedStrength ?? 0));
    setMagicDamagePct(derived.magDmg + (item.magicDamagePct ?? 0));
    if (item.slot === "weapon" && typeof item.speedTicks === "number") {
      setSpeedTicks(item.speedTicks);
    }
  }

  function unequipSlot(slot: OsrsSlot) {
    setEquipped((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  }

  // =========
  // INPUTS FOR MATH
  // =========
  const inputs: Inputs = useMemo(
    () => ({
      style,
      atkLevel: clamp(atkLevelNum, 1, 99),
      strLevel: clamp(strLevelNum, 1, 99),
      rngLevel: clamp(rngLevelNum, 1, 99),
      magLevel: clamp(magLevelNum, 1, 99),
      attackBonus: clamp(gearSynced.attackBonus ?? attackBonus, -200, 400),
      strengthBonus: clamp(gearSynced.strengthBonus ?? strengthBonus, -200, 400),
      rangedStrength: clamp(gearSynced.rangedStrength ?? rangedStrength, -200, 400),
      magicDamagePct: clamp(gearSynced.magicDamagePct ?? magicDamagePct, 0, 200),
      speedTicks: clamp(gearSynced.speedTicks ?? speedTicks, 2, 7),
      meleePrayer,
      rangedPrayer,
      magicPrayer,
      potion,
      targetHp: clamp(targetHpNum, 1, 5000),
      targetDefLevel: clamp(targetDefLevelNum, 1, 400),
      targetDefBonus: clamp(targetDefBonusNum, -200, 400),
    }),
    [
      style,
      atkLevelNum,
      strLevelNum,
      rngLevelNum,
      magLevelNum,
      gearSynced,
      attackBonus,
      strengthBonus,
      rangedStrength,
      magicDamagePct,
      speedTicks,
      meleePrayer,
      rangedPrayer,
      magicPrayer,
      potion,
      targetHpNum,
      targetDefLevelNum,
      targetDefBonusNum,
    ]
  );

  const result = useMemo(() => computeOsrsDps(inputs), [inputs]);

  async function importFromHiscores() {
    const name = rsn.trim();
    if (!name) return;

    setHsError(null);
    setHsLoading(true);

    try {
      const res = await fetch(`/api/osrs/hiscores?player=${encodeURIComponent(name)}`, {
        method: "GET",
        cache: "no-store",
      });

      // handle non-json (edge cases)
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok || !json?.ok) {
        setHsError(json?.error ?? "Could not load hiscores");
        return;
      }

      const skills = json.skills as {
        attack: number;
        strength: number;
        ranged: number;
        magic: number;
      };

      setAtkLevel(String(clamp99(skills.attack)));
      setStrLevel(String(clamp99(skills.strength)));
      setRngLevel(String(clamp99(skills.ranged)));
      setMagLevel(String(clamp99(skills.magic)));
    } catch {
      setHsError("Network error loading hiscores");
    } finally {
      setHsLoading(false);
    }
  }

  // ========
  // UI
  // ========
  return (
    <main className="min-h-screen bg-transparent text-white px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
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
              GamerStation<span className="align-super text-[0.6em]">™</span>
            </span>
          </Link>

          <a
            href="/calculators"
            className="
              ml-auto rounded-xl border border-neutral-800
              bg-black px-4 py-2 text-sm text-neutral-200
              transition
              hover:border-grey-400
              hover:text-white
              hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]
            "
          >
            Calculators
          </a>
        </header>

        <div className="mt-8">
          <h1 className="text-4xl font-bold tracking-tight">OSRS DPS Calculator</h1>
          <p className="mt-3 text-neutral-300 max-w-2xl">
            Baseline expected DPS using hit chance + average hit + attack speed. Great for quick comparisons.
          </p>
        </div>

        {/* MOBILE sticky bar (tabs + style) */}
        <div className="mt-6 sticky top-0 z-30 -mx-6 px-6 py-3 bg-black/85 backdrop-blur border-b border-neutral-800 ios-glass lg:static lg:bg-transparent lg:backdrop-blur-0 lg:border-b-0 lg:mx-0 lg:px-0">
          {/* Mobile section tabs (User / Enemies / Results) */}
          <div className="flex gap-2 lg:hidden">
            <MobileTopTab active={mobileTab === "user"} onClick={() => setMobileTab("user")} label="User" />
            <MobileTopTab active={mobileTab === "enemies"} onClick={() => setMobileTab("enemies")} label="Enemies" />
            <MobileTopTab active={mobileTab === "results"} onClick={() => setMobileTab("results")} label="Results" />
          </div>

          {/* Style tabs */}
          <div className="mt-3 flex flex-wrap gap-2 lg:mt-0">
            <Tab active={style === "melee"} onClick={() => setStyle("melee")} label="Melee" />
            <Tab active={style === "ranged"} onClick={() => setStyle("ranged")} label="Ranged" />
            <Tab active={style === "magic"} onClick={() => setStyle("magic")} label="Magic" />
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* INPUTS */}
          <section
            className={[
              "rounded-2xl border border-neutral-800 bg-neutral-950 p-6",
              "lg:block",
              mobileTab === "user" ? "block" : "hidden lg:block",
            ].join(" ")}
          >
            <div className="text-sm font-semibold">Inputs</div>

            {/* Username import + Player levels (collapsible) */}
            <div className="mt-5 rounded-2xl border border-neutral-800 bg-black/40 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <label className="block w-full">
                  <div className="text-xs text-neutral-400">OSRS username (hiscores)</div>
                  <input
                    value={rsn}
                    onChange={(e) => setRsn(e.target.value)}
                    placeholder="e.g. Zezima"
                    className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                  />
                </label>

                <button
                  type="button"
                  onClick={importFromHiscores}
                  disabled={hsLoading || !rsn.trim()}
                  className="rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm font-semibold text-white hover:border-neutral-600 disabled:opacity-50"
                >
                  {hsLoading ? "Importing..." : "Import stats"}
                </button>
              </div>

              {hsError && <div className="mt-3 text-xs text-red-300">{hsError}</div>}

              <div className="mt-3 text-xs text-neutral-500">Pulls combat skill levels from OSRS hiscores. Gear stays manual.</div>

              <div className="mt-4">
                <CollapsibleHeader
                  title="Player levels"
                  open={openPlayerLevels}
                  onToggle={() => setOpenPlayerLevels((v) => !v)}
                />

                {openPlayerLevels && (
                  <div className="mt-2 rounded-xl border border-neutral-800 bg-black/30 p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <L99Field label="Attack" value={atkLevel} setValue={setAtkLevel} />
                      <L99Field label="Strength" value={strLevel} setValue={setStrLevel} />
                      <L99Field label="Ranged" value={rngLevel} setValue={setRngLevel} />
                      <L99Field label="Magic" value={magLevel} setValue={setMagLevel} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Gear (collapsible) */}
            <div className="mt-6 rounded-2xl border border-neutral-800 bg-black/40 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Gear</div>
                <button
                  type="button"
                  onClick={() => setOpenGear((v) => !v)}
                  className="text-xs text-neutral-400 hover:text-white"
                >
                  {openGear ? "Hide" : "Show"}
                </button>
              </div>

              {openGear && (
                <>
                  {/* Search */}
                  <div className="mt-3" ref={searchWrapRef}>
                    <div className="relative">
                      <input
                        ref={searchInputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => setSearchOpen(true)}
                        onBlur={() => setSearchOpen(false)}
                        placeholder={`Search ${OSRS_SLOTS.find((s) => s.key === activeSlot)?.label ?? "items"}...`}
                        className="w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                      />

                      {searchOpen && filteredItems.length > 0 && (
                        <div className="absolute left-0 right-0 z-20 mt-2 max-h-72 overflow-auto rounded-2xl border border-neutral-800 bg-black shadow-xl">
                          <ul className="p-2">
                            {filteredItems.map((it) => (
                              <li key={it.id}>
                                <button
                                  type="button"
                                  onMouseDown={() => equipItem(it)}
                                  className="w-full rounded-xl border border-transparent px-3 py-2 text-left text-sm hover:border-neutral-800 hover:bg-neutral-950"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="font-semibold">{it.name}</div>
                                    <div className="text-xs text-neutral-500">{it.slot}</div>
                                  </div>
                                  <div className="mt-1 text-xs text-neutral-400">
                                    {typeof it.attackBonus === "number" && <>Atk {it.attackBonus} • </>}
                                    {typeof it.strengthBonus === "number" && <>Str {it.strengthBonus} • </>}
                                    {typeof it.rangedStrength === "number" && <>RngStr {it.rangedStrength} • </>}
                                    {typeof it.magicDamagePct === "number" && <>Mag% {it.magicDamagePct} • </>}
                                    {typeof it.speedTicks === "number" && <>Spd {it.speedTicks}t</>}
                                  </div>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 text-xs text-neutral-500">
                      Click a slot to filter search. Equipping clears search but keeps the slot active.
                    </div>
                  </div>

                  {/* Slot grid */}
                  <div className="mt-4">
                    <SlotButtonsGrid
                      activeSlot={activeSlot}
                      equipped={equipped}
                      onSelect={(slot) => {
                        setActiveSlot(slot);
                        setSearchOpen(true);
                        requestAnimationFrame(() => searchInputRef.current?.focus());
                      }}
                      onUnequip={unequipSlot}
                    />
                  </div>

                  {/* Gear bonuses */}
                  <div className="mt-4">
                    <CollapsibleHeader
                      title="Gear bonuses"
                      open={openGearBonuses}
                      onToggle={() => setOpenGearBonuses((v) => !v)}
                      rightHint="Derived"
                    />
                    {openGearBonuses && (
                      <div className="mt-2 rounded-xl border border-neutral-800 bg-black/30 p-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <MiniStat label="Atk bonus" value={String(gearSynced.attackBonus)} />
                          <MiniStat label="Spd (ticks)" value={String(gearSynced.speedTicks)} />
                          <MiniStat label="Str bonus" value={String(gearSynced.strengthBonus)} />
                          <MiniStat label="Rng str" value={String(gearSynced.rangedStrength)} />
                          <MiniStat label="Mag dmg %" value={String(gearSynced.magicDamagePct)} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Buffs */}
                  <div className="mt-4 rounded-xl border border-neutral-800 bg-black/30 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-neutral-200">Buffs</div>
                    </div>

                    <div className="mt-3 grid gap-3">
                      <div>
                        <div className="text-[11px] text-neutral-400">Potion</div>
                        <select
                          value={potion}
                          onChange={(e) => setPotion(e.target.value as Potion)}
                          className="mt-1 w-full rounded-lg border border-neutral-800 bg-black px-2 py-1.5 text-xs outline-none focus:border-neutral-600"
                        >
                          <option value="none">None</option>
                          <option value="super_combat">Super combat</option>
                          <option value="divine_super_combat">Divine super combat</option>
                          <option value="ranging">Ranging</option>
                          <option value="divine_ranging">Divine ranging</option>
                          <option value="magic">Magic</option>
                          <option value="divine_magic">Divine magic</option>
                        </select>
                      </div>

                      {style === "melee" && (
                        <div>
                          <div className="text-[11px] text-neutral-400">Melee prayer</div>
                          <select
                            value={meleePrayer}
                            onChange={(e) => setMeleePrayer(e.target.value as MeleePrayer)}
                            className="mt-1 w-full rounded-lg border border-neutral-800 bg-black px-2 py-1.5 text-xs outline-none focus:border-neutral-600"
                          >
                            <option value="none">None</option>
                            <option value="burst_of_strength">Burst of Strength</option>
                            <option value="superhuman_strength">Superhuman Strength</option>
                            <option value="ultimate_strength">Ultimate Strength</option>
                            <option value="chivalry">Chivalry</option>
                            <option value="piety">Piety</option>
                          </select>
                        </div>
                      )}

                      {style === "ranged" && (
                        <div>
                          <div className="text-[11px] text-neutral-400">Ranged prayer</div>
                          <select
                            value={rangedPrayer}
                            onChange={(e) => setRangedPrayer(e.target.value as RangedPrayer)}
                            className="mt-1 w-full rounded-lg border border-neutral-800 bg-black px-2 py-1.5 text-xs outline-none focus:border-neutral-600"
                          >
                            <option value="none">None</option>
                            <option value="sharp_eye">Sharp Eye</option>
                            <option value="hawk_eye">Hawk Eye</option>
                            <option value="eagle_eye">Eagle Eye</option>
                            <option value="rigour">Rigour</option>
                          </select>
                        </div>
                      )}

                      {style === "magic" && (
                        <div>
                          <div className="text-[11px] text-neutral-400">Magic prayer</div>
                          <select
                            value={magicPrayer}
                            onChange={(e) => setMagicPrayer(e.target.value as MagicPrayer)}
                            className="mt-1 w-full rounded-lg border border-neutral-800 bg-black px-2 py-1.5 text-xs outline-none focus:border-neutral-600"
                          >
                            <option value="none">None</option>
                            <option value="mystic_will">Mystic Will</option>
                            <option value="mystic_lore">Mystic Lore</option>
                            <option value="mystic_might">Mystic Might</option>
                            <option value="augury">Augury</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* RIGHT COLUMN: Enemies + Results */}
          <section
            className={[
              "rounded-2xl border border-neutral-800 bg-neutral-950 p-6 h-fit self-start",
              mobileTab === "user" ? "hidden lg:block" : "block",
            ].join(" ")}
          >
            {/* ENEMIES */}
            <div className={mobileTab === "enemies" ? "block" : "hidden lg:block"}>
              <div className="rounded-2xl border border-neutral-800 bg-black/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Enemy / Boss</div>
                  <div className="text-xs text-neutral-500">Preset fills Target</div>
                </div>

                {/* Enemy search */}
                <div className="mt-4" ref={enemyWrapRef}>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-neutral-400">Search enemy</div>

                    <button
                      type="button"
                      onClick={async () => {
                        await loadAllEnemies();
                        setEnemyOpen(true);
                        requestAnimationFrame(() => enemyInputRef.current?.focus());
                      }}
                      disabled={enemiesLoading || enemiesLoaded}
                      className="text-xs text-neutral-400 hover:text-white disabled:opacity-50"
                    >
                      {enemiesLoaded ? "Loaded" : enemiesLoading ? "Loading..." : "Load list"}
                    </button>
                  </div>

                  <div className="relative mt-2">
                    <input
                      ref={enemyInputRef}
                      value={enemyQuery}
                      onChange={(e) => {
                        setEnemyQuery(e.target.value);
                        setEnemyOpen(true);
                        if (!enemiesLoaded && !enemiesLoading) loadAllEnemies();
                      }}
                      onFocus={() => {
                        setEnemyOpen(true);
                        if (!enemiesLoaded && !enemiesLoading) loadAllEnemies();
                      }}
                      placeholder="Search enemies..."
                      className="w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                    />

                    {enemyOpen && (
                      <div className="absolute left-0 right-0 z-20 mt-2 max-h-72 overflow-auto rounded-2xl border border-neutral-800 bg-black shadow-xl">
                        <div className="p-2">
                          {!enemiesLoaded && enemiesLoading && (
                            <div className="rounded-xl border border-neutral-800 bg-black/40 px-3 py-2 text-xs text-neutral-400">
                              Loading enemies…
                            </div>
                          )}

                          {enemiesLoaded && filteredEnemies.length === 0 && (
                            <div className="rounded-xl border border-neutral-800 bg-black/40 px-3 py-2 text-xs text-neutral-400">
                              No matches.
                            </div>
                          )}

                          {enemiesLoaded && filteredEnemies.length > 0 && (
                            <ul className="space-y-1">
                              {filteredEnemies.map((en) => (
                                <li key={en.key}>
                                  <button
                                    type="button"
                                    onMouseDown={(ev) => {
                                      ev.preventDefault();
                                      applyEnemyPreset(en.key);
                                      setEnemyQuery("");
                                      setEnemyOpen(false);
                                    }}
                                    className="w-full rounded-xl border border-transparent px-3 py-2 text-left text-sm hover:border-neutral-800 hover:bg-neutral-950"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="font-semibold">{en.name}</div>
                                      <div className="text-xs text-neutral-500">
                                        HP {en.hp} • Def {en.defLevel} • Bonus {en.defBonus}
                                      </div>
                                    </div>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {enemiesError && <div className="mt-2 text-xs text-red-300">{enemiesError}</div>}

                  {/* Current target */}
                  <div className="mt-3 rounded-xl border border-neutral-800 bg-black/30 px-4 py-3">
                    <div className="text-xs text-neutral-400">Current target</div>
                    <div className="mt-1 text-sm text-neutral-200">
                      HP <span className="font-semibold">{targetHpNum}</span> • Def{" "}
                      <span className="font-semibold">{targetDefLevelNum}</span> • Bonus{" "}
                      <span className="font-semibold">{targetDefBonusNum}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <CollapsibleHeader title="Target" open={openTarget} onToggle={() => setOpenTarget((v) => !v)} />
                    {openTarget && (
                      <div className="mt-2 rounded-xl border border-neutral-800 bg-black/30 p-3">
                        <div className="grid grid-cols-3 gap-3">
                          <SmallNumberTextField
                            label="HP"
                            value={targetHp}
                            onChange={(v) => {
                              setEnemyKey("custom");
                              setTargetHp(v);
                            }}
                            min={1}
                            max={5000}
                          />
                          <SmallNumberTextField
                            label="Def lvl"
                            value={targetDefLevel}
                            onChange={(v) => {
                              setEnemyKey("custom");
                              setTargetDefLevel(v);
                            }}
                            min={1}
                            max={400}
                          />
                          <SmallNumberTextField
                            label="Def bonus"
                            value={targetDefBonus}
                            onChange={(v) => {
                              setEnemyKey("custom");
                              setTargetDefBonus(v);
                            }}
                            min={-200}
                            max={400}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5" />
            </div>

            {/* RESULTS */}
            <div className={mobileTab === "results" ? "block" : "hidden lg:block"}>
              <div className="rounded-2xl border border-neutral-800 bg-black/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Results</div>
                  <button
                    type="button"
                    onClick={() => setOpenResults((v) => !v)}
                    className="text-xs text-neutral-400 hover:text-white"
                  >
                    {openResults ? "Hide" : "Show"}
                  </button>
                </div>

                {openResults && (
                  <>
                    <div className="mt-4 grid gap-3">
                      <Row label="Max hit" value={String(result.maxHit)} />
                      <Row label="Hit chance" value={fmtPct(result.pHit)} />
                      <Row label="Avg hit (on successful hit)" value={fmt(result.avgHitOnSuccess)} />
                      <Row label="Expected dmg / attack" value={fmt(result.expectedPerSwing)} />
                      <Row label="Attack interval" value={`${fmt(result.secondsPerAttack)}s`} />
                      <Row label="DPS" value={fmt(result.dps)} />
                      <Row label="Time to kill" value={fmtTime(result.ttkSeconds)} />
                    </div>

                    <div className="mt-4 rounded-2xl border border-neutral-800 bg-black/40 p-4">
                      <div className="text-xs text-neutral-500">
                        v1 baseline model. Later: Slayer/Salve/Void, spec cycles, bolt procs, poison/venom, multi-hit
                        weapons, powered-staff formulas.
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Mobile sticky results footer */}
      {mobileTab !== "results" && (
        <button
          type="button"
          onClick={() => setMobileTab("results")}
          className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-neutral-800 bg-black/90 backdrop-blur"
        >
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between text-sm">
            <div className="flex flex-col text-left">
              <span className="text-xs text-neutral-400">DPS</span>
              <span className="font-semibold">{fmt(result.dps)}</span>
            </div>

            <div className="flex flex-col text-right">
              <span className="text-xs text-neutral-400">TTK</span>
              <span className="font-semibold">{fmtTime(result.ttkSeconds)}</span>
            </div>
          </div>
        </button>
      )}
    </main>
  );
}

/* =========================
   UI components
========================= */

function MobileTopTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl border px-3 py-2 text-sm font-semibold transition",
        active
          ? "border-neutral-500 bg-neutral-900 text-white"
          : "border-neutral-800 bg-black text-neutral-300 hover:border-neutral-600 hover:text-white",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function Tab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
        active
          ? "border-neutral-500 bg-neutral-900"
          : "border-neutral-800 bg-black text-neutral-300 hover:border-neutral-600 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function CollapsibleHeader({
  title,
  open,
  onToggle,
  rightHint,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  rightHint?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm font-semibold text-neutral-200">{title}</div>
      <div className="flex items-center gap-3">
        {rightHint && <div className="text-[11px] text-neutral-500">{rightHint}</div>}
        <button type="button" onClick={onToggle} className="text-xs text-neutral-400 hover:text-white">
          {open ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

/** Level 0–99, digit-only */
function L99Field({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-xs text-neutral-400">{label}</div>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => {
          const cleaned = onlyDigits(e.target.value).slice(0, 2);
          if (cleaned === "") {
            setValue("");
            return;
          }
          setValue(String(clamp99(Number(cleaned))));
        }}
        onBlur={() => {
          if (value === "") setValue("1");
        }}
        placeholder="1–99"
        className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
      />
    </label>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-black/40 px-3 py-2">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="mt-0.5 text-xs font-semibold text-neutral-200">{value}</div>
    </div>
  );
}

function SmallNumberTextField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="block">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => {
          const cleaned = onlyDigits(e.target.value);
          onChange(cleaned);
        }}
        onBlur={() => {
          const n = Number(value);
          if (!Number.isFinite(n)) onChange(String(min));
          else onChange(String(clamp(n, min, max)));
        }}
        className="mt-1 w-full rounded-lg border border-neutral-800 bg-black px-2 py-1.5 text-xs outline-none focus:border-neutral-600"
      />
    </label>
  );
}

/** Ordered compact slot buttons, with X to unequip */
function SlotButtonsGrid({
  activeSlot,
  equipped,
  onSelect,
  onUnequip,
}: {
  activeSlot: OsrsSlot;
  equipped: Partial<Record<OsrsSlot, OsrsItemRow>>;
  onSelect: (slot: OsrsSlot) => void;
  onUnequip: (slot: OsrsSlot) => void;
}) {
  const ordered: OsrsSlot[] = ["head", "body", "legs", "feet", "neck", "cape", "hands", "ring", "weapon", "ammo", "shield"];

  return (
    <div className="grid grid-cols-3 gap-2">
      {ordered.map((slot) => {
        const s = OSRS_SLOTS.find((x) => x.key === slot)!;
        const hasItem = Boolean(equipped[s.key]);

        const base = "relative rounded-xl border px-3 py-2 text-sm font-semibold transition bg-black text-neutral-200";
        const active = slot === activeSlot ? "border-neutral-600" : "border-neutral-800 hover:border-neutral-600";
        const equippedGlow = hasItem ? "shadow-[0_0_0_1px_rgba(16,185,129,0.35)]" : "";

        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelect(s.key)}
            className={`${base} ${active} ${equippedGlow}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span>{s.label}</span>

              {hasItem && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnequip(s.key);
                  }}
                  className="rounded-md border border-neutral-800 bg-black/60 px-1.5 py-0.5 text-[10px] text-neutral-200 hover:border-neutral-600"
                  aria-label={`Unequip ${s.label}`}
                >
                  ✕
                </button>
              )}
            </div>

            {hasItem && (
              <div className="mt-1 line-clamp-1 text-[11px] font-normal text-neutral-400">{equipped[s.key]?.name}</div>
            )}
          </button>
        );
      })}
    </div>
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