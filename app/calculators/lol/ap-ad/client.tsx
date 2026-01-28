// app/calculators/lol/ap-ad/client.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ItemRow, SpellsOverrides } from "./page";

/**
 * AP/AD Stat Impact (GamerStation) — Overrides-first
 *
 * - No champion API usage.
 * - Ability DAMAGE comes from `spells_overrides.json` (passed from page.tsx as `overrides`).
 * - Champion names / spell names / base stats come from Data Dragon champion JSON.
 *
 * Overrides format (your file):
 * {
 *   "1": { "id":"Annie", "Q": { "type":"magic", "base":[...] }, ... },
 *   "2": { "id":"Olaf",  ... }
 * }
 *
 * We lookup overrides primarily by champion numeric key from champions_index.json (e.g. "1"),
 * with a fallback lookup by champion id string (e.g. "Annie") if needed.
 */

type Num = number | "";
const num0 = (v: Num) => (v === "" ? 0 : v);

type MobileTab = "inputs" | "results";
type CastKey = "Q" | "W" | "E" | "R" | "AA";
type SpellSlot = "Q" | "W" | "E" | "R";

export type ChampionRow = {
  id: string; // "Aatrox"
  key?: string; // "266" etc
  name: string;
  title?: string;
  tags?: string[];
};

type DdSpell = { name?: string; maxrank?: number };
type DdChampion = { id?: string; key?: string; spells?: DdSpell[]; stats?: any };

type OverrideSpell = {
  type?: "phys" | "physical" | "magic" | "true" | "mixed";
  base?: number[];
  // Optional future-proofing:
  apRatio?: number; // multiplier of AP
  adRatio?: number; // multiplier of total AD
  bonusAdRatio?: number; // multiplier of bonus AD
};

type OverrideChampion = {
  id?: string;
  Q?: OverrideSpell;
  W?: OverrideSpell;
  E?: OverrideSpell;
  R?: OverrideSpell;
};

type DamageParts = {
  phys: number;
  magic: number;
  trueDmg: number;
  rawTotal: number;
  postTotal: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function fmt(n: number, digits = 1) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

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

function statAtLevel(base: any, perLevel: any, level: number) {
  const b = Number(base);
  const p = Number(perLevel);
  const L = clamp(level, 1, 18);
  return (Number.isFinite(b) ? b : 0) + (Number.isFinite(p) ? p : 0) * (L - 1);
}

// Parse Data Dragon item stats (same mapping as LolClient)
function itemTotals(selectedItems: ItemRow[]) {
  let hp = 0;
  let ad = 0;
  let ap = 0;
  let armor = 0;
  let mr = 0;

  // penetration
  let lethality = 0;
  let armorPenPct = 0; // 0-100
  let magicPenFlat = 0;
  let magicPenPct = 0; // 0-100

  for (const it of selectedItems) {
    const s = (it as any).stats || {};
    hp += s.FlatHPPoolMod ?? 0;
    ad += s.FlatPhysicalDamageMod ?? 0;
    ap += s.FlatMagicDamageMod ?? 0;
    armor += s.FlatArmorMod ?? 0;
    mr += s.FlatSpellBlockMod ?? 0;

    lethality += s.FlatArmorPenetrationMod ?? 0;
    armorPenPct += (s.PercentArmorPenetrationMod ?? 0) * 100;
    magicPenFlat += s.FlatMagicPenetrationMod ?? 0;
    magicPenPct += (s.PercentMagicPenetrationMod ?? 0) * 100;
  }

  armorPenPct = clamp(armorPenPct, 0, 100);
  magicPenPct = clamp(magicPenPct, 0, 100);

  return { hp, ad, ap, armor, mr, lethality, armorPenPct, magicPenFlat, magicPenPct };
}

// ---------- UI helpers ----------
function TogglePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
        active
          ? "border-neutral-500 bg-neutral-900 text-white"
          : "border-neutral-800 bg-black text-neutral-300 hover:border-neutral-600"
      }`}
    >
      {children}
    </button>
  );
}

function DamageRow({
  label,
  rawTotal,
  phys,
  magic,
  trueDmg,
  onRemove,
}: {
  label: string;
  rawTotal: number;
  phys: number;
  magic: number;
  trueDmg: number;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-black px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-6 text-xs font-bold text-neutral-200">{label}</div>
          <div className="text-xs font-semibold text-neutral-200">{fmt(rawTotal, 0)} raw</div>
        </div>
        <div className="mt-0.5 text-[11px] text-neutral-500">
          phys {fmt(phys, 0)} · magic {fmt(magic, 0)} · t {fmt(trueDmg, 0)}
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="rounded-lg border border-neutral-800 bg-black px-2 py-1 text-xs font-semibold text-neutral-300 hover:border-neutral-600"
        title="Remove from rotation"
      >
        ✕
      </button>
    </div>
  );
}

// ---------- Overrides helpers ----------
function normType(t?: string): "phys" | "magic" | "true" | "mixed" {
  const s = String(t ?? "").toLowerCase();
  if (s.includes("phys")) return "phys";
  if (s.includes("physical")) return "phys";
  if (s.includes("magic")) return "magic";
  if (s.includes("true")) return "true";
  return "mixed";
}

function pickByRank(arr: number[] | undefined, rank: number) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const i = clamp(rank - 1, 0, arr.length - 1);
  const n = arr[i];
  return Number.isFinite(n) ? n : 0;
}

function findOverrideForChampion(
  overrides: SpellsOverrides,
  champKey: string,
  champId: string
): OverrideChampion | null {
  // 1) exact numeric key match
  const direct = (overrides as any)?.[champKey] as OverrideChampion | undefined;
  if (direct && (direct.Q || direct.W || direct.E || direct.R)) return direct;

  // 2) scan for matching id
  const want = String(champId ?? "").toLowerCase();
  for (const k of Object.keys(overrides ?? {})) {
    const v = (overrides as any)[k] as OverrideChampion | undefined;
    if (!v) continue;
    if (String(v.id ?? "").toLowerCase() === want) return v;
  }

  return null;
}

function computeRawFromOverrideSpell(
  spell: OverrideSpell | undefined,
  rank: number,
  effAp: number,
  effAd: number,
  bonusAd: number
) {
  if (!spell) return { phys: 0, magic: 0, trueDmg: 0 };

  const base = pickByRank(spell.base, rank);

  // Optional scaling support if you add these later
  const apRatio = Number(spell.apRatio ?? 0);
  const adRatio = Number(spell.adRatio ?? 0);
  const bonusAdRatio = Number(spell.bonusAdRatio ?? 0);

  const raw =
    (Number.isFinite(base) ? base : 0) +
    (Number.isFinite(apRatio) ? apRatio : 0) * (Number.isFinite(effAp) ? effAp : 0) +
    (Number.isFinite(adRatio) ? adRatio : 0) * (Number.isFinite(effAd) ? effAd : 0) +
    (Number.isFinite(bonusAdRatio) ? bonusAdRatio : 0) * (Number.isFinite(bonusAd) ? bonusAd : 0);

  const dmgType = normType(spell.type);

  if (!(raw > 0)) return { phys: 0, magic: 0, trueDmg: 0 };
  if (dmgType === "phys") return { phys: raw, magic: 0, trueDmg: 0 };
  if (dmgType === "true") return { phys: 0, magic: 0, trueDmg: raw };
  if (dmgType === "magic") return { phys: 0, magic: raw, trueDmg: 0 };

  // mixed: split evenly as a safe default
  return { phys: raw * 0.5, magic: raw * 0.5, trueDmg: 0 };
}

export default function ApAdClient({
  champions,
  patch,
  items,
  overrides,
}: {
  champions: ChampionRow[];
  patch: string;
  items: ItemRow[];
  overrides: SpellsOverrides;
}) {
  const [mobileTab, setMobileTab] = useState<MobileTab>("inputs");
  const resultsRef = useRef<HTMLDivElement | null>(null);

  // attacker champ
  const [champQuery, setChampQuery] = useState("");
  const [selectedId, setSelectedId] = useState(champions[0]?.id ?? "");

  // levels
  const [level, setLevel] = useState<number>(1);
  const lvl = clamp(level, 1, 18);

  // target
  const [targetChampionId, setTargetChampionId] = useState<string>("");
  const [targetLevel, setTargetLevel] = useState<number>(1);
  const [targetLevelTouched, setTargetLevelTouched] = useState(false);
  const tLvl = clamp(targetLevel, 1, 18);

  const [targetHp, setTargetHp] = useState<Num>(2000);
  const [targetArmor, setTargetArmor] = useState<Num>(80);
  const [targetMr, setTargetMr] = useState<Num>(60);

  // items
  const [itemQuery, setItemQuery] = useState("");
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [selectedItemKeys, setSelectedItemKeys] = useState<string[]>([]);

  // bonus AP
  const [bonusAp, setBonusAp] = useState<Num>(0);

  // spell ranks
  const [spellRanks, setSpellRanks] = useState<Record<SpellSlot, number>>({
    Q: 1,
    W: 1,
    E: 1,
    R: 1,
  });

  // rotation builder
  const [rotationEnabled, setRotationEnabled] = useState(true);
  const [rotation, setRotation] = useState<CastKey[]>(["Q", "W", "AA"]);

  // Optional: DDragon for names/stats only
  const [ddChamp, setDdChamp] = useState<DdChampion | null>(null);
  const [ddLoading, setDdLoading] = useState(false);
  const [ddErr, setDdErr] = useState("");

  const [ddTarget, setDdTarget] = useState<DdChampion | null>(null);
  const [ddTargetErr, setDdTargetErr] = useState("");

  const searchParams = useSearchParams();
  const didInitFromUrl = useRef(false);

  useEffect(() => {
    if (didInitFromUrl.current) return;
    didInitFromUrl.current = true;

    const fromUrl = searchParams.get("champion")?.trim();
    if (!fromUrl) return;
    if (!champions.some((c) => c.id === fromUrl)) return;

    setSelectedId(fromUrl);
    setChampQuery("");
  }, [searchParams, champions]);

  const filteredChamps = useMemo(() => {
    const q = champQuery.trim().toLowerCase();
    if (!q) return champions.slice(0, 60);
    return champions
      .filter((c) => {
        const hay = `${c.name} ${c.title ?? ""} ${(c.tags ?? []).join(" ")}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 60);
  }, [champions, champQuery]);

  useEffect(() => {
    const q = champQuery.trim();
    if (!q) return;
    if (!filteredChamps.length) return;
    if (filteredChamps.some((c) => c.id === selectedId)) return;
    setSelectedId(filteredChamps[0]!.id);
  }, [champQuery, filteredChamps, selectedId]);

  const selectedChampion = useMemo(
    () => champions.find((c) => c.id === selectedId) ?? null,
    [champions, selectedId]
  );

  const selectedChampKey = useMemo(() => {
    const k = selectedChampion?.key ?? "";
    return String(k ?? "");
  }, [selectedChampion]);

  // Item identity across different possible item.json shapes:
  // Prefer `id` if present, else fall back to `name`
  const itemKey = (it: any) => {
    const id = it?.id ?? it?.itemId ?? it?.key;
    if (id != null) return String(id);
    return String(it?.name ?? "");
  };

  const selectedItems = useMemo(() => {
    const map = new Map<string, any>();
    for (const it of items as any[]) map.set(itemKey(it), it);

    return selectedItemKeys
      .map((k) => map.get(k))
      .filter(Boolean) as ItemRow[];
  }, [selectedItemKeys, items]);

  const totals = useMemo(() => itemTotals(selectedItems), [selectedItems]);

  const itemResults = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return (items as any[])
      .filter((it) => String(it?.name ?? "").toLowerCase().includes(q))
      .slice(0, 30);
  }, [items, itemQuery]);

  // --- Fetch attacker DDragon (names/stats only) ---
  useEffect(() => {
    let alive = true;

    async function run() {
      if (!selectedId || !patch) {
        setDdChamp(null);
        return;
      }

      setDdLoading(true);
      setDdErr("");

      try {
        const url = `https://ddragon.leagueoflegends.com/cdn/${patch}/data/en_US/champion/${selectedId}.json`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Champion fetch failed (${res.status})`);
        const json = await res.json();
        const champ = json?.data?.[selectedId] ?? null;
        if (!alive) return;

        setDdChamp({
          id: champ?.id ?? selectedId,
          key: champ?.key ?? selectedChampKey,
          spells: champ?.spells ?? [],
          stats: champ?.stats ?? null,
        });

        setSpellRanks({ Q: 1, W: 1, E: 1, R: 1 });
      } catch (e: any) {
        if (!alive) return;
        setDdChamp(null);
        setDdErr(e?.message ? String(e.message) : "Failed to load champion data.");
      } finally {
        if (alive) setDdLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [selectedId, patch, selectedChampKey]);

  // --- Fetch target DDragon (names/stats only) ---
  useEffect(() => {
    let alive = true;

    async function run() {
      if (!targetChampionId || !patch) {
        setDdTarget(null);
        setDdTargetErr("");
        return;
      }

      setDdTargetErr("");

      try {
        const url = `https://ddragon.leagueoflegends.com/cdn/${patch}/data/en_US/champion/${targetChampionId}.json`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Target fetch failed (${res.status})`);
        const json = await res.json();
        const champ = json?.data?.[targetChampionId] ?? null;
        if (!alive) return;

        setDdTarget({
          id: champ?.id ?? targetChampionId,
          key: champ?.key ?? null,
          spells: champ?.spells ?? [],
          stats: champ?.stats ?? null,
        });
      } catch (e: any) {
        if (!alive) return;
        setDdTarget(null);
        setDdTargetErr(e?.message ? String(e.message) : "Failed to load target.");
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [targetChampionId, patch]);

  // target level defaults to attacker level unless touched
  useEffect(() => {
    if (!targetLevelTouched) setTargetLevel(lvl);
  }, [lvl, targetLevelTouched]);

  // when using target champ, auto-apply hp/armor/mr by level
  useEffect(() => {
    if (!targetChampionId) return;
    const st = (ddTarget as any)?.stats;
    if (!st) return;

    setTargetHp(statAtLevel(st.hp, st.hpperlevel, tLvl));
    setTargetArmor(statAtLevel(st.armor, st.armorperlevel, tLvl));
    setTargetMr(statAtLevel(st.spellblock, st.spellblockperlevel, tLvl));
  }, [targetChampionId, ddTarget, tLvl]);

  // attacker base AD
  const champBaseAd = useMemo(() => {
    const st = (ddChamp as any)?.stats;
    if (!st) return 0;
    return statAtLevel(st.attackdamage, st.attackdamageperlevel, lvl);
  }, [ddChamp, lvl]);

  // effective stats
  const effAd = champBaseAd + totals.ad;
  const effAp = totals.ap + num0(bonusAp);
  const bonusAd = Math.max(0, effAd - champBaseAd);

  // target after pen
  const tHP = num0(targetHp);
  const tArmor = num0(targetArmor);
  const tMr = num0(targetMr);

  const armorAfterPen = useMemo(() => {
    const afterPct = tArmor * (1 - totals.armorPenPct / 100);
    return afterPct - totals.lethality;
  }, [tArmor, totals.armorPenPct, totals.lethality]);

  const mrAfterPen = useMemo(() => {
    const afterPct = tMr * (1 - totals.magicPenPct / 100);
    return afterPct - totals.magicPenFlat;
  }, [tMr, totals.magicPenPct, totals.magicPenFlat]);

  const physMult = useMemo(() => damageMultiplierFromResist(armorAfterPen), [armorAfterPen]);
  const magicMult = useMemo(() => damageMultiplierFromResist(mrAfterPen), [mrAfterPen]);

  function spellAtSlot(slot: SpellSlot) {
    const idx = slot === "Q" ? 0 : slot === "W" ? 1 : slot === "E" ? 2 : 3;
    return ddChamp?.spells?.[idx] ?? null;
  }

  const ovrChamp = useMemo(() => {
    if (!selectedChampion) return null;
    return findOverrideForChampion(overrides ?? {}, selectedChampKey, selectedChampion.id);
  }, [overrides, selectedChampion, selectedChampKey]);

  function entryRaw(ap: number, ad: number, k: CastKey) {
    if (k === "AA") return { phys: ad, magic: 0, trueDmg: 0 };

    const slot = k as SpellSlot;
    const spell = spellAtSlot(slot);
    const maxrank = Number(spell?.maxrank ?? 0) || (slot === "R" ? 3 : 5);
    const r = clamp(spellRanks[slot], 1, maxrank);

    const spellOvr = (ovrChamp as any)?.[slot] as OverrideSpell | undefined;
    return computeRawFromOverrideSpell(spellOvr, r, ap, ad, Math.max(0, ad - champBaseAd));
  }

  function partsToDamage(parts: { phys: number; magic: number; trueDmg: number }): DamageParts {
    const phys = parts.phys;
    const magic = parts.magic;
    const trueDmg = parts.trueDmg;
    const rawTotal = phys + magic + trueDmg;
    const postTotal = phys * physMult + magic * magicMult + trueDmg;
    return { phys, magic, trueDmg, rawTotal, postTotal };
  }

  function computeCombo(ap: number, ad: number) {
    const keys = rotationEnabled ? rotation : [];
    const useKeys = keys.length ? keys : (["Q", "W", "E", "R", "AA"] as CastKey[]);
    let phys = 0;
    let magic = 0;
    let trueDmg = 0;

    for (const k of useKeys) {
      const p = entryRaw(ap, ad, k);
      phys += p.phys;
      magic += p.magic;
      trueDmg += p.trueDmg;
    }

    return partsToDamage({ phys, magic, trueDmg });
  }

  const breakdown = useMemo(() => {
    const useKeys = rotationEnabled ? rotation : [];
    if (!useKeys.length) return [];
    return useKeys.map((k, i) => {
      const p = entryRaw(effAp, effAd, k);
      const d = partsToDamage(p);
      return { k, i, ...d };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotationEnabled, rotation, effAp, effAd, spellRanks, ovrChamp, physMult, magicMult, champBaseAd]);

  const base = useMemo(
    () => computeCombo(effAp, effAd),
    [effAp, effAd, rotationEnabled, rotation, spellRanks, ovrChamp, physMult, magicMult, champBaseAd]
  );

  const deltaAp = useMemo(
    () => computeCombo(effAp + 10, effAd).postTotal - base.postTotal,
    [effAp, effAd, base.postTotal, rotationEnabled, rotation, spellRanks, ovrChamp, physMult, magicMult, champBaseAd]
  );

  const deltaAd = useMemo(
    () => computeCombo(effAp, effAd + 10).postTotal - base.postTotal,
    [effAp, effAd, base.postTotal, rotationEnabled, rotation, spellRanks, ovrChamp, physMult, magicMult, champBaseAd]
  );

  function resetAll() {
    setChampQuery("");
    setSelectedId(champions[0]?.id ?? "");
    setLevel(1);
    setBonusAp(0);
    setSelectedItemKeys([]);
    setItemQuery("");
    setTargetChampionId("");
    setTargetLevel(1);
    setTargetLevelTouched(false);
    setTargetHp(2000);
    setTargetArmor(80);
    setTargetMr(60);
    setSpellRanks({ Q: 1, W: 1, E: 1, R: 1 });
    setRotationEnabled(true);
    setRotation(["Q", "W", "AA"]);
    setMobileTab("inputs");
  }

  const overridesStatus = useMemo(() => {
    if (!selectedChampion) return "No champion selected";
    if (!overrides || Object.keys(overrides).length === 0) return "Overrides: missing/empty";
    if (!ovrChamp) return `Overrides: not found for ${selectedChampion.id}`;
    return `Overrides: OK (${selectedChampion.id})`;
  }, [overrides, ovrChamp, selectedChampion]);

  return (
    <div className="pb-28 lg:pb-0">
      {/* Mobile sticky header */}
      <div className="lg:hidden sticky top-0 z-40 border-b border-neutral-800 bg-black/80 backdrop-blur ios-glass">
        <div className="mx-auto max-w-xl px-3 py-1.5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMobileTab("inputs")}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                mobileTab === "inputs"
                  ? "border-neutral-500 bg-neutral-900 text-white"
                  : "border-neutral-800 bg-black text-neutral-300 hover:border-neutral-600"
              }`}
            >
              Inputs
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileTab("results");
                setTimeout(() => {
                  resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 60);
              }}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                mobileTab === "results"
                  ? "border-neutral-500 bg-neutral-900 text-white"
                  : "border-neutral-800 bg-black text-neutral-300 hover:border-neutral-600"
              }`}
            >
              Results
            </button>

            <button
              type="button"
              onClick={resetAll}
              className="rounded-lg border border-neutral-800 bg-black px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:border-neutral-600"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4">
        <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:items-start">
          {/* Inputs */}
          <div
            className={`rounded-2xl border border-neutral-800 bg-neutral-950 p-6 ${
              mobileTab !== "inputs" ? "hidden lg:block" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Inputs</div>

              <div className="hidden lg:flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetAll}
                  className="rounded-xl border border-neutral-800 bg-black px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:border-neutral-600"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Champion picker */}
            <div className="mt-6">
              <label className="text-xs font-semibold text-neutral-300">Champion</label>

              <div className="mt-2">
                <input
                  value={champQuery}
                  onChange={(e) => setChampQuery(e.target.value)}
                  placeholder="Search champion (e.g., Ahri, Yasuo, Mage)..."
                  className="w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                />
              </div>

              <div className="mt-2">
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                >
                  {filteredChamps.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-2 text-xs text-neutral-500">
                Loaded {champions.length} champions · Data Dragon patch {patch} ·{" "}
                {ddLoading ? "Loading..." : ddChamp ? "DDragon: loaded" : "DDragon: not loaded"}{" "}
                {ddErr ? `(${ddErr})` : ""}
                <br />
                {overridesStatus}
              </div>
            </div>

            {/* Level */}
            <div className="mt-6">
              <label className="text-xs font-semibold text-neutral-300">Level</label>

              <input
                type="range"
                min={1}
                max={18}
                value={lvl}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="mt-2 w-full"
              />

              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <TogglePill active={lvl === 1} onClick={() => setLevel(1)}>
                    Level 1
                  </TogglePill>
                  <TogglePill active={lvl === 9} onClick={() => setLevel(9)}>
                    Level 9
                  </TogglePill>
                  <TogglePill active={lvl === 18} onClick={() => setLevel(18)}>
                    Level 18
                  </TogglePill>
                </div>

                <div className="text-sm font-semibold text-neutral-200">{lvl}</div>
              </div>
            </div>

            {/* Attacker stats */}
            <div className="mt-8 flex items-center justify-between">
              <div className="text-sm font-semibold">Attacker Stats</div>
              <div className="text-xs text-neutral-500">Auto from champ + items</div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-neutral-300">Bonus AP (optional)</label>
                <input
                  value={bonusAp === "" ? "" : String(bonusAp)}
                  onChange={(e) => setBonusAp(e.target.value === "" ? "" : Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                  inputMode="numeric"
                />
                <div className="mt-1 text-[11px] text-neutral-500">Adds on top of item AP.</div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300">Total AD (auto)</label>
                <input
                  value={fmt(effAd, 2)}
                  readOnly
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none"
                />
                <div className="mt-1 text-[11px] text-neutral-500">
                  Base AD {fmt(champBaseAd, 2)} + item AD {fmt(totals.ad, 2)}
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="mt-8 flex items-center justify-between">
              <div className="text-sm font-semibold">Items</div>
              <div className="text-xs text-neutral-500">Optional</div>
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
                      <div className="px-3 py-2 text-xs text-neutral-500">No matches.</div>
                    ) : (
                      itemResults.map((it: any, idx: number) => {
                        const k = itemKey(it);
                        const selected = selectedItemKeys.includes(k);
                        return (
                          <button
                            key={`${k}:${idx}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setSelectedItemKeys((prev) =>
                                prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
                              );
                            }}
                            className={`w-full px-3 py-2 text-left text-sm ${
                              selected
                                ? "bg-neutral-900 text-white"
                                : "bg-black text-neutral-200 hover:bg-neutral-900"
                            }`}
                          >
                            {it.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedItems.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedItems.map((it: any) => (
                  <button
                    key={itemKey(it)}
                    type="button"
                    onClick={() => setSelectedItemKeys((prev) => prev.filter((x) => x !== itemKey(it)))}
                    className="rounded-full border border-neutral-800 bg-black px-3 py-1 text-xs text-neutral-200 hover:border-neutral-600"
                    title="Remove"
                  >
                    {it.name} ✕
                  </button>
                ))}
              </div>
            )

            }

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-neutral-800 bg-black px-3 py-2 text-neutral-200">
                AP <span className="font-semibold">{fmt(effAp, 1)}</span>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-black px-3 py-2 text-neutral-200">
                AD <span className="font-semibold">{fmt(effAd, 1)}</span>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-black px-3 py-2 text-neutral-200">
                Lethality <span className="font-semibold">{fmt(totals.lethality, 1)}</span>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-black px-3 py-2 text-neutral-200">
                Magic Pen <span className="font-semibold">{fmt(totals.magicPenFlat, 1)}</span>
              </div>
            </div>

            {/* Target */}
            <div className="mt-8 flex items-center justify-between">
              <div className="text-sm font-semibold">Target</div>
              <div className="text-xs text-neutral-500">For pen & post-mitigation</div>
            </div>

            <div className="mt-3">
              <label className="text-xs font-semibold text-neutral-300">Target champion (optional)</label>
              <select
                value={targetChampionId}
                onChange={(e) => {
                  setTargetChampionId(e.target.value);
                  setTargetLevelTouched(false);
                }}
                className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
              >
                <option value="">Custom stats</option>
                {champions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.title}
                  </option>
                ))}
              </select>

              {ddTargetErr ? <div className="mt-2 text-xs text-red-300">{ddTargetErr}</div> : null}
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold text-neutral-300">Target level</label>
              <input
                type="range"
                min={1}
                max={18}
                value={tLvl}
                onChange={(e) => {
                  setTargetLevel(Number(e.target.value));
                  setTargetLevelTouched(true);
                }}
                className="mt-2 w-full"
              />
              <div className="mt-1 text-xs text-neutral-400">Level {tLvl}</div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-neutral-300">HP</label>
                <input
                  value={targetHp === "" ? "" : String(targetHp)}
                  onChange={(e) => setTargetHp(e.target.value === "" ? "" : Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-300">Armor</label>
                <input
                  value={targetArmor === "" ? "" : String(targetArmor)}
                  onChange={(e) => setTargetArmor(e.target.value === "" ? "" : Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-300">MR</label>
                <input
                  value={targetMr === "" ? "" : String(targetMr)}
                  onChange={(e) => setTargetMr(e.target.value === "" ? "" : Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="mt-2 text-[11px] text-neutral-500">
              Pen order: % pen → flat pen. (This is why target stats matter for “+10 AP vs +10 AD”.)
            </div>

            {/* Rotation / Combo */}
            <div className="mt-8 rounded-2xl border border-neutral-800 bg-black p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Rotation / Combo</div>
                  <div className="mt-0.5 text-[11px] text-neutral-500">
                    Damage from your overrides. AA uses your AA math.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <TogglePill active={rotationEnabled} onClick={() => setRotationEnabled((p) => !p)}>
                    {rotationEnabled ? "On" : "Off"}
                  </TogglePill>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {(["Q", "W", "E", "R"] as SpellSlot[]).map((s) => {
                  const spell = spellAtSlot(s);
                  const maxrank = Number(spell?.maxrank ?? 0) || (s === "R" ? 3 : 5);
                  const r = clamp(spellRanks[s], 1, maxrank);

                  return (
                    <div key={s} className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs text-neutral-500">{s}</div>
                          <div className="text-sm font-semibold text-neutral-200">{spell?.name ?? "—"}</div>
                        </div>
                        <div className="text-xs text-neutral-500">
                          Rank {r}/{maxrank}
                        </div>
                      </div>

                      <input
                        type="range"
                        min={1}
                        max={maxrank}
                        value={r}
                        onChange={(e) =>
                          setSpellRanks((prev) => ({ ...prev, [s]: Number(e.target.value) }))
                        }
                        className="mt-3 w-full"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {(["Q", "W", "E", "R", "AA"] as CastKey[]).map((k) => (
                    <TogglePill key={k} active={false} onClick={() => setRotation((prev) => [...prev, k])}>
                      {k}
                    </TogglePill>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setRotation([])}
                  className="rounded-lg border border-neutral-800 bg-black px-3 py-1 text-xs font-semibold text-neutral-200 hover:border-neutral-600"
                >
                  Clear
                </button>
              </div>

              {rotationEnabled && rotation.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {breakdown.map((b) => (
                    <DamageRow
                      key={`${b.k}-${b.i}`}
                      label={b.k}
                      rawTotal={b.rawTotal}
                      phys={b.phys}
                      magic={b.magic}
                      trueDmg={b.trueDmg}
                      onRemove={() => setRotation((prev) => prev.filter((_, idx) => idx !== b.i))}
                    />
                  ))}
                  <div className="text-[11px] text-neutral-500">
                    Rotation raw total: {fmt(breakdown.reduce((a, x) => a + x.rawTotal, 0), 0)} (phys{" "}
                    {fmt(breakdown.reduce((a, x) => a + x.phys, 0), 0)} / magic{" "}
                    {fmt(breakdown.reduce((a, x) => a + x.magic, 0), 0)} / t{" "}
                    {fmt(breakdown.reduce((a, x) => a + x.trueDmg, 0), 0)})
                    <br />
                    Note: If a spell shows 0, that champion/slot is missing in spells_overrides.json.
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-[11px] text-neutral-500">
                  Add casts with Q/W/E/R/AA to see per-ability damage rows.
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          <div
            ref={resultsRef}
            className={`rounded-2xl border border-neutral-800 bg-neutral-950 p-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-auto lg:self-start ${
              mobileTab !== "results" ? "hidden lg:block" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Results</div>
              <div className="text-xs text-neutral-500">Post-mitigation vs target (after pen)</div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-neutral-800 bg-black p-4">
                <div className="text-xs text-neutral-500">+10 AP Stat Impact</div>
                <div className="mt-2 text-2xl font-semibold text-white">{fmt(deltaAp, 2)}</div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  AP {fmt(effAp, 1)} → {fmt(effAp + 10, 1)}
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-black p-4">
                <div className="text-xs text-neutral-500">+10 AD Stat Impact</div>
                <div className="mt-2 text-2xl font-semibold text-white">{fmt(deltaAd, 2)}</div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  AD {fmt(effAd, 1)} → {fmt(effAd + 10, 1)}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-neutral-800 bg-black p-4">
              <div className="text-xs text-neutral-500">Current combo damage (post-mitigation)</div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="text-2xl font-semibold text-white">{fmt(base.postTotal, 2)}</div>
                <div className="text-xs text-neutral-500">Raw {fmt(base.rawTotal, 2)}</div>
              </div>

              <div className="mt-2 text-[11px] text-neutral-500">
                Raw split: P {fmt(base.phys, 1)} · M {fmt(base.magic, 1)} · T {fmt(base.trueDmg, 1)}
              </div>

              <div className="mt-2 text-[11px] text-neutral-500">
                Multipliers: phys {fmt(physMult, 3)} vs armor {fmt(armorAfterPen, 1)} · magic{" "}
                {fmt(magicMult, 3)} vs MR {fmt(mrAfterPen, 1)}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-neutral-800 bg-black p-4">
                <div className="text-xs text-neutral-500">Target EHP (after pen)</div>
                <div className="mt-2 text-sm text-neutral-200">
                  vs Physical:{" "}
                  <span className="font-semibold">{fmt(effectiveHp(tHP, armorAfterPen), 0)}</span>
                </div>
                <div className="mt-1 text-sm text-neutral-200">
                  vs Magic: <span className="font-semibold">{fmt(effectiveHp(tHP, mrAfterPen), 0)}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-black p-4">
                <div className="text-xs text-neutral-500">Kill check</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {tHP > 0 && base.postTotal >= tHP ? "Killable" : "Not killable"}
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  Needs {tHP > 0 ? fmt(Math.max(0, tHP - base.postTotal), 1) : "—"} more damage
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-neutral-500">
              Using {selectedId} (Lvl {lvl}) · Eff AP {fmt(effAp, 1)} · Eff AD {fmt(effAd, 1)}
              {targetChampionId ? ` · Target ${targetChampionId} (Lvl ${tLvl})` : ""}
            </div>

            {ddErr ? (
              <div className="mt-3 rounded-xl border border-red-900/40 bg-red-950/30 px-3 py-2 text-xs text-red-200">
                {ddErr}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
