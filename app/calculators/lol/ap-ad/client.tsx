// app/calculators/lol/ap-ad/client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Stats = {
  hp?: number;
  hpperlevel?: number;
  armor?: number;
  armorperlevel?: number;
  spellblock?: number;
  spellblockperlevel?: number;
  attackdamage?: number;
  attackdamageperlevel?: number;
};

export type ChampionRow = {
  key?: string | number;
  id: string;
  name: string;
  title?: string;
  tags?: string[];
  partype?: string;
  stats?: Stats;
};

type ItemRow = Record<string, any>;

type Num = number | "";
type UiMode = "simple" | "advanced";
type MobileTab = "inputs" | "results";
type DamageType = "magic" | "phys" | "true";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function fmt(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

/** Allow blank inputs (so users can delete zeros) */
const num0 = (v: Num) => (v === "" ? 0 : v);

const setNum =
  (setter: (v: Num) => void, min: number, max: number) => (raw: string) => {
    if (raw === "") return setter("");
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    setter(clamp(n, min, max));
  };

function damageMultiplierFromResist(resist: number) {
  if (!Number.isFinite(resist)) return NaN;
  if (resist >= 0) return 100 / (100 + resist);
  return 2 - 100 / (100 - resist);
}

function pickNumber(obj: any, keys: string[]): number | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  for (const k of keys) {
    const v = obj[k];
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Returns {value, hasInput} so we can distinguish
 * "real 0" vs "we didn't find stat keys at all".
 */
function getStatAtLevelMaybe(
  base: number | undefined,
  perLevel: number | undefined,
  lvl: number
): { value: number; hasInput: boolean } {
  const hasBase = Number.isFinite(Number(base));
  const hasPer = Number.isFinite(Number(perLevel));
  const hasInput = hasBase || hasPer;

  const b = hasBase ? Number(base) : 0;
  const p = hasPer ? Number(perLevel) : 0;
  const L = clamp(Number(lvl ?? 1), 1, 18);

  return { value: b + p * (L - 1), hasInput };
}

/**
 * ✅ Normalize stats across MANY schemas:
 * - DDragon (hp/hpperlevel/etc)
 * - alt common (hpBase/hpGrowth, armorBase/armorGrowth, mrBase/mrGrowth)
 * - camelCase (attackDamageBase, spellBlock, etc)
 */
function normalizeStats(raw: any): Stats {
  // try to locate stats object
  const s =
    raw?.stats ??
    raw?.data?.stats ??
    raw?.data?.champion?.stats ??
    raw?.champion?.stats ??
    raw?.champion ??
    raw?.statsBase ??
    null;

  const obj = s && typeof s === "object" ? s : raw && typeof raw === "object" ? raw : {};

  const hp = pickNumber(obj, [
    "hp",
    "HP",
    "health",
    "baseHp",
    "baseHP",
    "baseHealth",
    "hpBase",
    "healthBase",
    "baseHealthRegen", // harmless if present
  ]);

  const hpperlevel = pickNumber(obj, [
    "hpperlevel",
    "hpPerLevel",
    "healthperlevel",
    "healthPerLevel",
    "hp_per_level",
    "hpGrowth",
    "healthGrowth",
  ]);

  const armor = pickNumber(obj, [
    "armor",
    "Armor",
    "baseArmor",
    "armorBase",
    "defense",
    "defenseBase",
  ]);

  const armorperlevel = pickNumber(obj, [
    "armorperlevel",
    "armorPerLevel",
    "armor_per_level",
    "armorGrowth",
    "defenseGrowth",
  ]);

  // MR / spellblock
  const spellblock = pickNumber(obj, [
    "spellblock",
    "spellBlock",
    "spellblockBase",
    "spellBlockBase",
    "mr",
    "MR",
    "magicresist",
    "magicResist",
    "magicResistance",
    "baseMR",
    "mrBase",
    "magicResistBase",
  ]);

  const spellblockperlevel = pickNumber(obj, [
    "spellblockperlevel",
    "spellBlockPerLevel",
    "spellblock_per_level",
    "mrperlevel",
    "mrPerLevel",
    "mrGrowth",
    "magicresistperlevel",
    "magicResistPerLevel",
    "magicResistGrowth",
  ]);

  // AD
  const attackdamage = pickNumber(obj, [
    "attackdamage",
    "attackDamage",
    "ad",
    "AD",
    "basead",
    "baseAD",
    "baseAttackDamage",
    "attackDamageBase",
    "attackdamageBase",
  ]);

  const attackdamageperlevel = pickNumber(obj, [
    "attackdamageperlevel",
    "attackDamagePerLevel",
    "adperlevel",
    "adPerLevel",
    "attackdamage_per_level",
    "attackDamageGrowth",
    "attackdamageGrowth",
  ]);

  return {
    hp,
    hpperlevel,
    armor,
    armorperlevel,
    spellblock,
    spellblockperlevel,
    attackdamage,
    attackdamageperlevel,
  };
}

function safeChampions(champions: ChampionRow[]): ChampionRow[] {
  const arr = Array.isArray(champions) ? champions : [];
  return arr
    .filter(Boolean)
    .map((c: any) => {
      const id = String(c?.id ?? c?.slug ?? c?.key ?? "").trim();
      const name = String(c?.name ?? c?.id ?? c?.slug ?? "").trim();

      return {
        ...c,
        id,
        name,
        title: c?.title,
        tags: Array.isArray(c?.tags) ? c.tags : [],
        stats: normalizeStats(c),
      } as ChampionRow;
    })
    .filter((c) => c.id && c.name);
}

function damageTypeLabel(dt: DamageType) {
  if (dt === "phys") return "Physical";
  if (dt === "true") return "True";
  return "Magic";
}

/** ----------------------------
 * Items
 * ---------------------------- */
type UiItem = { key: string; name: string; raw: ItemRow };

function getItemName(it: any) {
  return (
    String(
      it?.name ??
        it?.displayName ??
        it?.id ??
        it?.key ??
        it?.itemId ??
        it?.item_id ??
        it?.slug ??
        ""
    ).trim() || "Unknown Item"
  );
}

function getItemKey(it: any, idx: number) {
  const k =
    it?.id ??
    it?.key ??
    it?.itemId ??
    it?.item_id ??
    it?.slug ??
    it?.apiName ??
    it?.name;
  const s = String(k ?? "").trim();
  return s ? s : `item_${idx}`;
}

function safeItems(items: ItemRow[] | undefined): UiItem[] {
  const arr = Array.isArray(items) ? items : [];
  return arr
    .filter(Boolean)
    .map((raw, idx) => ({
      key: getItemKey(raw, idx),
      name: getItemName(raw),
      raw,
    }))
    .filter((x) => x.key && x.name);
}

function asNumber(x: any): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function extractApAdFromItemRaw(raw: any): { ap: number; ad: number } {
  let ap = 0;
  let ad = 0;

  const stats = raw?.stats ?? raw?.data?.stats ?? raw?.item?.stats ?? null;
  if (stats && typeof stats === "object") {
    ap += asNumber(
      stats.FlatMagicDamageMod ??
        stats.flatMagicDamageMod ??
        stats.abilityPower ??
        stats.ap
    );
    ad += asNumber(
      stats.FlatPhysicalDamageMod ??
        stats.flatPhysicalDamageMod ??
        stats.attackDamage ??
        stats.ad
    );
  }

  const simpleStats = raw?.simpleStats ?? raw?.data?.simpleStats ?? null;
  if (simpleStats && typeof simpleStats === "object") {
    ap += asNumber(simpleStats.ap ?? simpleStats.abilityPower);
    ad += asNumber(simpleStats.ad ?? simpleStats.attackDamage);
  }

  ap += asNumber(raw?.ap ?? raw?.abilityPower);
  ad += asNumber(raw?.ad ?? raw?.attackDamage);

  return { ap, ad };
}

export default function ApAdClient({
  champions,
  patch,
  items,
}: {
  champions: ChampionRow[];
  patch: string;
  items?: ItemRow[];
}) {
  const champArray: ChampionRow[] = useMemo(() => safeChampions(champions), [champions]);
  const itemArray: UiItem[] = useMemo(() => safeItems(items ?? []), [items]);

  // ----------------------------
  // Mobile UX
  // ----------------------------
  const [mobileTab, setMobileTab] = useState<MobileTab>("inputs");
  const resultsRef = useRef<HTMLDivElement | null>(null);

  // Simple vs Advanced toggle
  const [uiMode, setUiMode] = useState<UiMode>("simple");

  // ----------------------------
  // Damage model
  // ----------------------------
  const [baseDamage, setBaseDamage] = useState<Num>(200);
  const [damageType, setDamageType] = useState<DamageType>("magic");
  const [apRatio, setApRatio] = useState<Num>(0.6);
  const [adRatio, setAdRatio] = useState<Num>(0);
  const [bonusAdRatio, setBonusAdRatio] = useState<Num>(0);

  // Collapsed by default
  const [damageOpen, setDamageOpen] = useState<boolean>(false);

  // ----------------------------
  // Attacker
  // ----------------------------
  const [attackerQuery, setAttackerQuery] = useState("");
  const [attackerChampionId, setAttackerChampionId] = useState<string>("");
  const [attackerLevel, setAttackerLevel] = useState<number>(9);
  const [attackerAp, setAttackerAp] = useState<Num>(0);
  const [attackerAd, setAttackerAd] = useState<Num>(0);
  const [attackerBonusAd, setAttackerBonusAd] = useState<Num>(0);

  const [attackerAdTouched, setAttackerAdTouched] = useState(false);

  const attackerFiltered = useMemo(() => {
    const q = attackerQuery.trim().toLowerCase();
    if (!q) return champArray.slice(0, 60);
    return champArray
      .filter((c) => {
        const hay = `${c.name} ${c.title ?? ""} ${(c.tags ?? []).join(" ")}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 60);
  }, [champArray, attackerQuery]);

  useEffect(() => {
    const q = attackerQuery.trim();
    if (!q) return;
    if (!attackerFiltered.length) return;
    if (attackerFiltered.some((c) => c.id === attackerChampionId)) return;
    if (attackerFiltered[0]?.id) setAttackerChampionId(attackerFiltered[0].id);
    setAttackerAdTouched(false);
  }, [attackerQuery, attackerFiltered, attackerChampionId]);

  const attackerChampion = useMemo(() => {
    if (!attackerChampionId) return null;
    return champArray.find((c) => c.id === attackerChampionId) ?? null;
  }, [champArray, attackerChampionId]);

  useEffect(() => {
    if (!attackerChampion) return;

    const { value: ad, hasInput } = getStatAtLevelMaybe(
      attackerChampion.stats?.attackdamage,
      attackerChampion.stats?.attackdamageperlevel,
      attackerLevel
    );

    if (!hasInput) return;
    if (!attackerAdTouched) setAttackerAd(Math.round(ad));
  }, [attackerChampion, attackerLevel, attackerAdTouched]);

  // ----------------------------
  // Items
  // ----------------------------
  const [itemQuery, setItemQuery] = useState("");
  const [selectedItemKeys, setSelectedItemKeys] = useState<string[]>([]);

  const itemFiltered = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (!q) return itemArray.slice(0, 60);
    return itemArray.filter((it) => it.name.toLowerCase().includes(q)).slice(0, 60);
  }, [itemArray, itemQuery]);

  const selectedItems = useMemo(() => {
    const set = new Set(selectedItemKeys);
    return itemArray.filter((it) => set.has(it.key));
  }, [itemArray, selectedItemKeys]);

  function addItemKey(k: string) {
    setSelectedItemKeys((prev) => (prev.includes(k) ? prev : [...prev, k]));
  }
  function removeItemKey(k: string) {
    setSelectedItemKeys((prev) => prev.filter((x) => x !== k));
  }

  const itemBonuses = useMemo(() => {
    let ap = 0;
    let ad = 0;
    for (const it of selectedItems) {
      const b = extractApAdFromItemRaw(it.raw);
      ap += b.ap;
      ad += b.ad;
    }
    return { ap, ad };
  }, [selectedItems]);

  // ----------------------------
  // Target
  // ----------------------------
  const [targetQuery, setTargetQuery] = useState("");
  const [targetChampionId, setTargetChampionId] = useState<string>("");
  const [targetLevel, setTargetLevel] = useState<number>(9);

  const [targetHp, setTargetHp] = useState<Num>(2000);
  const [targetArmor, setTargetArmor] = useState<Num>(80);
  const [targetMr, setTargetMr] = useState<Num>(60);

  const [targetHpTouched, setTargetHpTouched] = useState(false);
  const [targetArmorTouched, setTargetArmorTouched] = useState(false);
  const [targetMrTouched, setTargetMrTouched] = useState(false);

  const targetFiltered = useMemo(() => {
    const q = targetQuery.trim().toLowerCase();
    if (!q) return champArray.slice(0, 60);
    return champArray
      .filter((c) => {
        const hay = `${c.name} ${c.title ?? ""} ${(c.tags ?? []).join(" ")}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 60);
  }, [champArray, targetQuery]);

  useEffect(() => {
    const q = targetQuery.trim();
    if (!q) return;
    if (!targetFiltered.length) return;
    if (targetFiltered.some((c) => c.id === targetChampionId)) return;
    if (targetFiltered[0]?.id) setTargetChampionId(targetFiltered[0].id);
  }, [targetQuery, targetFiltered, targetChampionId]);

  const targetChampion = useMemo(() => {
    if (!targetChampionId) return null;
    return champArray.find((c) => c.id === targetChampionId) ?? null;
  }, [champArray, targetChampionId]);

  // ✅ when picking a new target champ, allow auto-overwrite again
  useEffect(() => {
    if (!targetChampionId) return;
    setTargetHpTouched(false);
    setTargetArmorTouched(false);
    setTargetMrTouched(false);
  }, [targetChampionId]);

  useEffect(() => {
    if (!targetChampion) return;

    const hp = getStatAtLevelMaybe(targetChampion.stats?.hp, targetChampion.stats?.hpperlevel, targetLevel);
    const armor = getStatAtLevelMaybe(targetChampion.stats?.armor, targetChampion.stats?.armorperlevel, targetLevel);
    const mr = getStatAtLevelMaybe(targetChampion.stats?.spellblock, targetChampion.stats?.spellblockperlevel, targetLevel);

    if (hp.hasInput && !targetHpTouched) setTargetHp(Math.round(hp.value));
    if (armor.hasInput && !targetArmorTouched) setTargetArmor(Math.round(armor.value));
    if (mr.hasInput && !targetMrTouched) setTargetMr(Math.round(mr.value));
  }, [targetChampion, targetLevel, targetHpTouched, targetArmorTouched, targetMrTouched]);

  function setTargetToCustom() {
    setTargetChampionId("");
  }

  // ----------------------------
  // Derived numbers (✅ item bonuses included)
  // ----------------------------
  const AP_base = num0(attackerAp);
  const totalAD_base = num0(attackerAd);
  const bonusAD_base = uiMode === "advanced" ? num0(attackerBonusAd) : 0;

  const AP = AP_base + itemBonuses.ap;

  const totalAD = totalAD_base + itemBonuses.ad;
  const bonusAD = (uiMode === "advanced" ? bonusAD_base : 0) + itemBonuses.ad;

  const tHP = num0(targetHp);
  const tArmor = num0(targetArmor);
  const tMR = num0(targetMr);

  const armorMult = useMemo(() => damageMultiplierFromResist(tArmor), [tArmor]);
  const mrMult = useMemo(() => damageMultiplierFromResist(tMR), [tMR]);

  const rawPacket = useMemo(() => {
    const base = Math.max(0, num0(baseDamage));
    const ar = num0(apRatio);
    const dr = num0(adRatio);
    const br = uiMode === "advanced" ? num0(bonusAdRatio) : 0;

    const raw = base + ar * AP + dr * totalAD + br * bonusAD;
    return Number.isFinite(raw) ? Math.max(0, raw) : NaN;
  }, [baseDamage, apRatio, adRatio, bonusAdRatio, AP, totalAD, bonusAD, uiMode]);

  const postPacket = useMemo(() => {
    if (!Number.isFinite(rawPacket)) return NaN;
    if (damageType === "true") return rawPacket;
    if (damageType === "phys") return Number.isFinite(armorMult) ? rawPacket * armorMult : NaN;
    return Number.isFinite(mrMult) ? rawPacket * mrMult : NaN;
  }, [rawPacket, damageType, armorMult, mrMult]);

  const pctOfHp = useMemo(() => {
    if (!(tHP > 0) || !Number.isFinite(postPacket)) return NaN;
    return (postPacket / tHP) * 100;
  }, [postPacket, tHP]);

  const delta = useMemo(() => {
    const base = Math.max(0, num0(baseDamage));
    const ar = num0(apRatio);
    const dr = num0(adRatio);
    const br = uiMode === "advanced" ? num0(bonusAdRatio) : 0;

    const raw0 = base + ar * AP + dr * totalAD + br * bonusAD;
    const rawAp = base + ar * (AP + 10) + dr * totalAD + br * bonusAD;
    const rawAd = base + ar * AP + dr * (totalAD + 10) + br * bonusAD;

    const rawDeltaAp = rawAp - raw0;
    const rawDeltaAd = rawAd - raw0;

    const mult = damageType === "true" ? 1 : damageType === "phys" ? armorMult : mrMult;

    const postDeltaAp = Number.isFinite(mult) ? rawDeltaAp * mult : NaN;
    const postDeltaAd = Number.isFinite(mult) ? rawDeltaAd * mult : NaN;

    return { rawDeltaAp, rawDeltaAd, postDeltaAp, postDeltaAd, mult };
  }, [baseDamage, apRatio, adRatio, bonusAdRatio, AP, totalAD, bonusAD, uiMode, damageType, armorMult, mrMult]);

  const killCheck = useMemo(() => {
    if (!(tHP > 0)) return { status: "—", detail: "Set target HP.", killable: false as const };
    if (!Number.isFinite(postPacket)) return { status: "—", detail: "Not enough data.", killable: false as const };
    if (postPacket >= tHP) return { status: "✅ Killable", detail: "Packet kills the target.", killable: true as const };
    const need = tHP - postPacket;
    return { status: "❌ Not killable", detail: `Needs ~${Math.round(need)} more damage.`, killable: false as const };
  }, [tHP, postPacket]);

  function resetAll() {
    setBaseDamage(200);
    setDamageType("magic");
    setApRatio(0.6);
    setAdRatio(0);
    setBonusAdRatio(0);

    setDamageOpen(false);

    setAttackerQuery("");
    setAttackerChampionId("");
    setAttackerLevel(9);
    setAttackerAp(0);
    setAttackerAd(0);
    setAttackerBonusAd(0);
    setAttackerAdTouched(false);

    setItemQuery("");
    setSelectedItemKeys([]);

    setTargetQuery("");
    setTargetChampionId("");
    setTargetLevel(9);
    setTargetHp(2000);
    setTargetArmor(80);
    setTargetMr(60);
    setTargetHpTouched(false);
    setTargetArmorTouched(false);
    setTargetMrTouched(false);

    setUiMode("simple");
    setMobileTab("inputs");
  }

  const footerSummary = useMemo(() => {
    const ap = Number.isFinite(delta.postDeltaAp) ? delta.postDeltaAp : NaN;
    const ad = Number.isFinite(delta.postDeltaAd) ? delta.postDeltaAd : NaN;
    return { ap, ad, dmg: postPacket, pct: pctOfHp, status: killCheck.status };
  }, [delta.postDeltaAp, delta.postDeltaAd, postPacket, pctOfHp, killCheck.status]);

  const resistLabel = damageType === "phys" ? "vs Armor" : damageType === "magic" ? "vs MR" : "true dmg";

  // ----------------------------
  // UI (your existing UI below)
  // ----------------------------
  return (
    <div className="pb-24 lg:pb-0">
      {/* ✅ Back to hub (top-left) */}
      <div className="mb-6 flex items-center">
        <Link
          href="/calculators/lol/hub"
          className="rounded-full border border-neutral-800 bg-black px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:border-neutral-600"
        >
          ← Back to LoL Hub
        </Link>
      </div>

      {/* Mobile sticky header */}
      <div className="lg:hidden sticky top-0 z-40 border-b border-neutral-800 bg-black/80 backdrop-blur">
        <div className="mx-auto max-w-xl px-3 py-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMobileTab("inputs")}
              className={cx(
                "flex-1 rounded-full border px-4 py-2 text-xs font-semibold",
                mobileTab === "inputs"
                  ? "border-neutral-500 bg-neutral-900 text-white"
                  : "border-neutral-800 bg-black text-neutral-300 hover:border-neutral-600"
              )}
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
              className={cx(
                "flex-1 rounded-full border px-4 py-2 text-xs font-semibold",
                mobileTab === "results"
                  ? "border-neutral-500 bg-neutral-900 text-white"
                  : "border-neutral-800 bg-black text-neutral-300 hover:border-neutral-600"
              )}
            >
              Results
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setUiMode("simple")}
              className={cx(
                "rounded-full border px-4 py-2 text-xs font-semibold",
                uiMode === "simple"
                  ? "border-neutral-500 bg-neutral-900 text-white"
                  : "border-neutral-800 bg-black text-neutral-300 hover:border-neutral-600"
              )}
            >
              Simple
            </button>
            <button
              type="button"
              onClick={() => setUiMode("advanced")}
              className={cx(
                "rounded-full border px-4 py-2 text-xs font-semibold",
                uiMode === "advanced"
                  ? "border-neutral-500 bg-neutral-900 text-white"
                  : "border-neutral-800 bg-black text-neutral-300 hover:border-neutral-600"
              )}
            >
              Advanced
            </button>
          </div>
        </div>
      </div>

      {/* prevent right column stretch */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Inputs */}
        <section
          className={cx(
            "rounded-2xl border border-neutral-800 bg-neutral-950 p-6 self-start",
            mobileTab !== "inputs" ? "hidden lg:block" : ""
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Inputs</h2>
            <div className="hidden lg:flex gap-2">
              <button
                type="button"
                onClick={() => setUiMode("simple")}
                className={cx(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  uiMode === "simple"
                    ? "border-neutral-500 bg-neutral-900 text-white"
                    : "border-neutral-800 bg-black text-neutral-300 hover:border-neutral-600"
                )}
              >
                Simple
              </button>
              <button
                type="button"
                onClick={() => setUiMode("advanced")}
                className={cx(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  uiMode === "advanced"
                    ? "border-neutral-500 bg-neutral-900 text-white"
                    : "border-neutral-800 bg-black text-neutral-300 hover:border-neutral-600"
                )}
              >
                Advanced
              </button>
            </div>
          </div>

          {/* Attacker */}
          <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Attacker</div>
              <div className="text-xs text-neutral-500">
                {attackerChampion ? `${attackerChampion.name} • Lvl ${attackerLevel}` : "Manual or pick a champ"}
              </div>
            </div>

            <div className="mt-3">
              <label className="text-sm text-neutral-300">Champion</label>
              <input
                value={attackerQuery}
                onChange={(e) => setAttackerQuery(e.target.value)}
                placeholder="Search champion (e.g., Ahri, Yasuo, Mage)..."
                className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
              />

              <select
                value={attackerChampionId}
                onChange={(e) => {
                  setAttackerChampionId(e.target.value);
                  setAttackerAdTouched(false);
                }}
                className="mt-3 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
              >
                <option value="">Manual (no champ)</option>
                {attackerFiltered.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.title ? `— ${c.title}` : ""}
                  </option>
                ))}
              </select>

              <div className="mt-1 text-xs text-neutral-500">
                Loaded <span className="text-neutral-300 font-semibold">{champArray.length}</span> champions • patch{" "}
                <span className="text-neutral-300 font-semibold">{patch}</span>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm text-neutral-300">Level</label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={18}
                    value={attackerLevel}
                    onChange={(e) => setAttackerLevel(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="min-w-[2.25rem] text-right text-sm text-neutral-200 font-semibold">
                    {attackerLevel}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm text-neutral-300">AP</label>
                <input
                  type="number"
                  value={attackerAp}
                  onChange={(e) => setNum(setAttackerAp, -9999, 99999)(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                />
                {itemBonuses.ap !== 0 && (
                  <div className="mt-1 text-[11px] text-neutral-500">
                    Items: <span className="text-neutral-300 font-semibold">+{Math.round(itemBonuses.ap)}</span> AP →{" "}
                    <span className="text-neutral-200 font-semibold">{Math.round(AP)}</span> effective
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm text-neutral-300">Total AD (auto from champ)</label>
                <input
                  type="number"
                  value={attackerAd}
                  onChange={(e) => {
                    setAttackerAdTouched(true);
                    setNum(setAttackerAd, -9999, 99999)(e.target.value);
                  }}
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                />
                <div className="mt-1 text-[11px] text-neutral-500">
                  If you type here, it stops auto-overwriting until you re-pick a champ.
                </div>
                {itemBonuses.ad !== 0 && (
                  <div className="mt-1 text-[11px] text-neutral-500">
                    Items: <span className="text-neutral-300 font-semibold">+{Math.round(itemBonuses.ad)}</span> AD →{" "}
                    <span className="text-neutral-200 font-semibold">{Math.round(totalAD)}</span> effective
                  </div>
                )}
              </div>

              {uiMode === "advanced" && (
                <div>
                  <label className="text-sm text-neutral-300">Bonus AD (advanced)</label>
                  <input
                    type="number"
                    value={attackerBonusAd}
                    onChange={(e) => setNum(setAttackerBonusAd, -9999, 99999)(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                  />
                  {itemBonuses.ad !== 0 && (
                    <div className="mt-1 text-[11px] text-neutral-500">
                      Items counted as bonus AD:{" "}
                      <span className="text-neutral-300 font-semibold">+{Math.round(itemBonuses.ad)}</span> →{" "}
                      <span className="text-neutral-200 font-semibold">{Math.round(bonusAD)}</span> effective
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Items */}
            <div className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Items</div>
                <div className="text-xs text-neutral-500">
                  {selectedItemKeys.length ? `${selectedItemKeys.length} selected` : "Optional"}
                </div>
              </div>

              <div className="mt-3">
                <label className="text-sm text-neutral-300">Search items</label>
                <input
                  value={itemQuery}
                  onChange={(e) => setItemQuery(e.target.value)}
                  placeholder="Type an item name..."
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                />

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {itemFiltered.slice(0, 8).map((it) => {
                    const isPicked = selectedItemKeys.includes(it.key);
                    return (
                      <button
                        key={it.key}
                        type="button"
                        onClick={() => addItemKey(it.key)}
                        disabled={isPicked}
                        className={cx(
                          "rounded-xl border px-3 py-2 text-left text-xs font-semibold",
                          isPicked
                            ? "border-neutral-900 bg-black text-neutral-600 cursor-not-allowed"
                            : "border-neutral-800 bg-black text-neutral-200 hover:border-neutral-600"
                        )}
                        title={it.name}
                      >
                        <span className="block truncate">{it.name}</span>
                      </button>
                    );
                  })}
                </div>

                {selectedItems.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-neutral-500">Selected</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedItems.map((it) => (
                        <button
                          key={it.key}
                          type="button"
                          onClick={() => removeItemKey(it.key)}
                          className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-black px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:border-neutral-600"
                          title="Remove"
                        >
                          <span className="max-w-[12rem] truncate">{it.name}</span>
                          <span className="text-neutral-500">✕</span>
                        </button>
                      ))}
                    </div>

                    <div className="mt-2 text-[11px] text-neutral-500">
                      Applied:{" "}
                      <span className="text-neutral-200 font-semibold">+{Math.round(itemBonuses.ap)}</span> AP •{" "}
                      <span className="text-neutral-200 font-semibold">+{Math.round(itemBonuses.ad)}</span> AD
                    </div>
                  </div>
                )}

                <div className="mt-2 text-[11px] text-neutral-500">
                  Loaded <span className="text-neutral-300 font-semibold">{itemArray.length}</span> items.
                </div>
              </div>
            </div>
          </div>

          {/* Target */}
          <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Target</div>
              <div className="text-xs text-neutral-500">Pick champ + level</div>
            </div>

            <div className="mt-3">
              <label className="text-sm text-neutral-300">Champion</label>
              <input
                value={targetQuery}
                onChange={(e) => setTargetQuery(e.target.value)}
                placeholder="Search target champ..."
                className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
              />

              <select
                value={targetChampionId}
                onChange={(e) => setTargetChampionId(e.target.value)}
                className="mt-3 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
              >
                <option value="">Custom</option>
                {targetFiltered.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.title ? `— ${c.title}` : ""}
                  </option>
                ))}
              </select>

              {targetChampion && (
                <div className="mt-1 text-xs text-neutral-500">
                  Using <span className="text-neutral-300 font-semibold">{targetChampion.name}</span> stats.
                </div>
              )}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm text-neutral-300">Level</label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={18}
                    value={targetLevel}
                    onChange={(e) => setTargetLevel(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="min-w-[2.25rem] text-right text-sm text-neutral-200 font-semibold">
                    {targetLevel}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-sm text-neutral-300">HP</label>
                <input
                  type="number"
                  value={targetHp}
                  onChange={(e) => {
                    setTargetHpTouched(true);
                    if (targetChampionId) setTargetToCustom();
                    setNum(setTargetHp, 1, 999999)(e.target.value);
                  }}
                  disabled={uiMode === "simple" && !!targetChampionId}
                  className={cx(
                    "mt-2 w-full rounded-xl border bg-black px-3 py-2 text-white outline-none focus:border-neutral-600",
                    uiMode === "simple" && targetChampionId ? "border-neutral-900 opacity-60" : "border-neutral-800"
                  )}
                />
                {uiMode === "simple" && targetChampionId && (
                  <div className="mt-1 text-[11px] text-neutral-500">Advanced to edit</div>
                )}
              </div>

              <div>
                <label className="text-sm text-neutral-300">Armor</label>
                <input
                  type="number"
                  value={targetArmor}
                  onChange={(e) => {
                    setTargetArmorTouched(true);
                    if (targetChampionId) setTargetToCustom();
                    setNum(setTargetArmor, -999, 9999)(e.target.value);
                  }}
                  disabled={uiMode === "simple" && !!targetChampionId}
                  className={cx(
                    "mt-2 w-full rounded-xl border bg-black px-3 py-2 text-white outline-none focus:border-neutral-600",
                    uiMode === "simple" && targetChampionId ? "border-neutral-900 opacity-60" : "border-neutral-800"
                  )}
                />
                <div className="mt-1 text-xs text-neutral-500">
                  Mult: <span className="text-neutral-300 font-semibold">{fmt(armorMult, 3)}</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-neutral-300">MR</label>
                <input
                  type="number"
                  value={targetMr}
                  onChange={(e) => {
                    setTargetMrTouched(true);
                    if (targetChampionId) setTargetToCustom();
                    setNum(setTargetMr, -999, 9999)(e.target.value);
                  }}
                  disabled={uiMode === "simple" && !!targetChampionId}
                  className={cx(
                    "mt-2 w-full rounded-xl border bg-black px-3 py-2 text-white outline-none focus:border-neutral-600",
                    uiMode === "simple" && targetChampionId ? "border-neutral-900 opacity-60" : "border-neutral-800"
                  )}
                />
                <div className="mt-1 text-xs text-neutral-500">
                  Mult: <span className="text-neutral-300 font-semibold">{fmt(mrMult, 3)}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-neutral-500">
              Tip: keep ratios fixed and compare <span className="text-neutral-200 font-semibold">+10 AP</span> vs{" "}
              <span className="text-neutral-200 font-semibold">+10 AD</span>.
            </div>
          </div>
        </section>

        {/* Results */}
        <section
          className={cx(
            "rounded-2xl border border-neutral-800 bg-neutral-950 p-6 self-start",
            mobileTab !== "results" ? "hidden lg:block" : ""
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Results</h2>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-full border border-neutral-800 bg-black px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:border-neutral-600"
            >
              Reset
            </button>
          </div>

          <div ref={resultsRef} />

          <div className="mt-2 text-xs text-neutral-500">
            Using attacker: <span className="text-neutral-200 font-semibold">{Math.round(AP)}</span> AP •{" "}
            <span className="text-neutral-200 font-semibold">{Math.round(totalAD)}</span> AD
          </div>

          <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">+10 Stat Impact (post-mitigation)</div>
              <div className="text-xs text-neutral-500">{resistLabel}</div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-neutral-300">+10 AP</span>
                <span className="font-semibold text-neutral-200">
                  {Number.isFinite(delta.postDeltaAp) ? fmt(delta.postDeltaAp, 2) : "—"}
                </span>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-neutral-300">+10 AD</span>
                <span className="font-semibold text-neutral-200">
                  {Number.isFinite(delta.postDeltaAd) ? fmt(delta.postDeltaAd, 2) : "—"}
                </span>
              </div>
            </div>

            <div className="mt-3 text-xs text-neutral-500">
              Raw deltas: +10 AP = <span className="text-neutral-300 font-semibold">{fmt(delta.rawDeltaAp, 2)}</span> •
              +10 AD = <span className="text-neutral-300 font-semibold">{fmt(delta.rawDeltaAd, 2)}</span>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
            <div className="text-sm font-semibold">Current damage (post-mitigation)</div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-neutral-300">Damage</span>
                <span className="font-semibold text-neutral-200">
                  {Number.isFinite(postPacket) ? fmt(postPacket, 0) : "—"}
                </span>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-neutral-300">% of target HP</span>
                <span className="font-semibold text-neutral-200">
                  {Number.isFinite(pctOfHp) ? `${fmt(pctOfHp, 1)}%` : "—"}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-neutral-800 bg-black px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-300">Kill check</span>
                <span className="font-semibold text-neutral-200">{killCheck.status}</span>
              </div>
              <div className="mt-1 text-xs text-neutral-500">{killCheck.detail}</div>
            </div>
          </div>

          <div className="mt-6 text-[11px] text-neutral-500">
            Legend: AP = Ability Power, AD = Attack Damage, MR = Magic Resist.
          </div>
        </section>
      </div>

      {/* Mobile sticky footer */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-black/80 backdrop-blur">
        <div className="mx-auto max-w-xl px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-neutral-400 truncate">
                {footerSummary.status} • +10 AP{" "}
                <span className="text-neutral-200 font-semibold">
                  {Number.isFinite(footerSummary.ap) ? fmt(footerSummary.ap, 2) : "—"}
                </span>{" "}
                • +10 AD{" "}
                <span className="text-neutral-200 font-semibold">
                  {Number.isFinite(footerSummary.ad) ? fmt(footerSummary.ad, 2) : "—"}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-neutral-500">
                Dmg{" "}
                <span className="text-neutral-200 font-semibold">
                  {Number.isFinite(footerSummary.dmg) ? fmt(footerSummary.dmg, 0) : "—"}
                </span>{" "}
                •{" "}
                <span className="text-neutral-200 font-semibold">
                  {Number.isFinite(footerSummary.pct) ? `${fmt(footerSummary.pct, 1)}%` : "—"}
                </span>{" "}
                of HP
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileTab("results");
                setTimeout(() => {
                  resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 60);
              }}
              className="shrink-0 rounded-xl border border-neutral-700 bg-black px-3 py-2 text-xs font-semibold text-neutral-100 hover:border-neutral-500"
            >
              View
            </button>
          </div>
        </div>
      </div>

      <div className="sr-only">
        <Link href="/calculators/lol/hub">Back to LoL Hub</Link>
      </div>
    </div>
  );
}
