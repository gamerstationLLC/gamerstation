"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  (setter: (v: Num) => void, min: number, max: number) => (raw: string) => {
    if (raw === "") return setter("");
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    setter(clamp(n, min, max));
  };

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
type MobileTab = "inputs" | "results";
type CastKey = "Q" | "W" | "E" | "R" | "AA";

// -------------------------
// Data Dragon spell types
// -------------------------
type DdSpellVar = {
  coeff?: number[] | number;
  link?: string;
  key?: string;
};

type DdSpell = {
  name?: string;
  maxrank?: number;
  tooltip?: string;
  // effect is 1-indexed in practice (effect[1] usually holds a primary array)
  effect?: (number[] | null)[];
  // effectBurn mirrors effect but as human-readable strings like "10/30/50/70/90".
  // Some spells have effect arrays that are null/0 while effectBurn contains the values.
  effectBurn?: (string | null)[];
  vars?: DdSpellVar[];
};

type DdChampionFull = {
  key?: string;
  spells?: DdSpell[];
  passive?: { name?: string; description?: string };
  // CommunityDragon-style calculation map (keys referenced from tooltip placeholders like {{ qdamage }})
  spellCalculations?: Record<string, any>;
};

type SpellSlot = "Q" | "W" | "E" | "R";

// -------------------------
// Champion-specific overrides (minimal, scalable)
// -------------------------
// Some champions have spells where Data Dragon's primary values represent a *single tick / dagger / bolt*
// rather than a full cast's total. In those cases we apply a multiplier so the Rotation/Combo totals
// are not wildly undercounted.
//
// Keep this list small and only add entries when you confirm a champion is mis-modeled.
const CHAMP_SPELL_MULTIPLIER: Record<string, Partial<Record<SpellSlot, number>>> = {
  // Katarina R (Death Lotus): Data Dragon values are per dagger; assume full channel on one target.
  Katarina: { R: 15 },
};

function spellCastMultiplier(champId: string, slot: SpellSlot) {
  const m = CHAMP_SPELL_MULTIPLIER[champId]?.[slot];
  return typeof m === "number" && Number.isFinite(m) && m > 0 ? m : 1;
}

function isNumArray(x: any): x is number[] {
  return Array.isArray(x) && x.every((v) => typeof v === "number" && Number.isFinite(v));
}

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function isMostlyNonDecreasing(arr: number[]) {
  let bad = 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < arr[i - 1]) bad++;
  }
  return bad <= Math.max(1, Math.floor(arr.length / 3));
}

function isIntegerish(n: number) {
  return Number.isFinite(n) && Math.abs(n - Math.round(n)) < 1e-6;
}

// Best-effort: choose a “damage-like” base array from effect[]
// We score arrays that:
// - match maxrank
// - are positive
// - trend upward with rank (damage often increases; cooldown usually decreases)
// - have larger magnitude
function pickPrimaryEffectArray(effect: (number[] | null)[] | undefined, maxrank: number) {
  if (!effect) return null;

  let best: number[] | null = null;
  let bestScore = -Infinity;

  for (let i = 0; i < effect.length; i++) {
    const arr = effect[i];
    if (!isNumArray(arr) || arr.length !== maxrank) continue;

    const a = arr.map((x) => (Number.isFinite(x) ? x : 0));
    const maxVal = Math.max(...a);
    const minVal = Math.min(...a);
    const mean = avg(a);

    // Ignore clearly non-damage arrays
    if (maxVal <= 0) continue;

    const nonDecreasing = isMostlyNonDecreasing(a) ? 1 : 0;

    // Score favors bigger + increasing arrays
    const score = mean + maxVal * 0.25 + nonDecreasing * 15 - (minVal < 0 ? 10 : 0);

    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }

  if (best) return best;

  // Fallback: first numeric array
  for (let i = 0; i < effect.length; i++) {
    const arr = effect[i];
    if (isNumArray(arr) && arr.length > 0) return arr;
  }

  return null;
}

// Best-effort: pick a “hit count / tick count” array when Data Dragon encodes multi-hit spells.
// We only consider arrays that:
// - match maxrank
// - look like small integers (2..30)
function pickHitCountEffectArray(
  effect: (number[] | null)[] | undefined,
  maxrank: number,
  damageArr: number[] | null
) {
  if (!effect) return null;

  let best: number[] | null = null;
  let bestScore = -Infinity;

  for (let i = 0; i < effect.length; i++) {
    const arr = effect[i];
    if (!isNumArray(arr) || arr.length !== maxrank) continue;
    if (damageArr && arr === damageArr) continue;

    const a = arr.map((x) => (Number.isFinite(x) ? x : 0));
    const maxVal = Math.max(...a);
    const minVal = Math.min(...a);
    const mean = avg(a);

    // Must look like a count
    if (minVal < 1 || maxVal > 30) continue;
    if (!a.every(isIntegerish)) continue;

    const nonDecreasing = isMostlyNonDecreasing(a) ? 1 : 0;

    // Prefer slightly larger counts, and stable/increasing
    const score = mean + nonDecreasing * 5;

    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }

  return best;
}

function textLooksMultiHit(tooltip?: string, name?: string) {
  const t = `${name ?? ""} ${tooltip ?? ""}`.toLowerCase();
  // Very common multi-hit / DoT / channel words
  return (
    t.includes("over ") ||
    t.includes("per second") ||
    t.includes("each second") ||
    t.includes("each hit") ||
    t.includes("dagger") ||
    t.includes("bolts") ||
    t.includes("shots") ||
    t.includes("strikes") ||
    t.includes("waves") ||
    t.includes("ticks") ||
    t.includes("channel")
  );
}


// Prefer using tooltip-referenced effect keys ({{ e1 }}, {{ e2 }}, etc.) when available.
// Many spells have multiple effect arrays (damage, cooldown, cost). The tooltip often points
// to the correct damage array via e# placeholders.
function pickEffectArrayFromTooltip(
  effect: (number[] | null)[] | undefined,
  tooltip: string | undefined,
  maxrank: number
) {
  if (!effect || !tooltip) return null;
  const t = tooltip.toLowerCase();
  const matches = Array.from(t.matchAll(/\{\{\s*e(\d+)\s*\}\}/g));
  if (!matches.length) return null;

  // preserve order of first appearance
  const seen = new Set<number>();
  const keys: number[] = [];
  for (const m of matches) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) continue;
    const k = Math.trunc(n);
    if (k < 0 || k >= effect.length) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    keys.push(k);
  }

  for (const k of keys) {
    const arr = effect[k];
    if (Array.isArray(arr) && arr.length === maxrank && arr.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      const maxVal = Math.max(...arr);
      if (maxVal > 0) return arr;
    }
  }

  return null;
}

function parseEffectBurnArray(burn: string | null, maxrank: number): number[] | null {
  if (!burn) return null;
  const parts = String(burn)
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const nums: number[] = [];
  for (const p of parts) {
    // Data Dragon burn strings are usually plain numbers; be permissive.
    const n = Number(p.replace(/[^0-9.+-]/g, ""));
    if (!Number.isFinite(n)) return null;
    nums.push(n);
  }
  if (nums.length !== maxrank) return null;
  return nums;
}

function pickBurnArrayFromTooltip(
  effectBurn: (string | null)[] | undefined,
  tooltip: string | undefined,
  maxrank: number
) {
  if (!effectBurn || !tooltip) return null;
  const t = tooltip.toLowerCase();
  const matches = Array.from(t.matchAll(/\{\{\s*e(\d+)\s*\}\}/g));
  if (!matches.length) return null;

  const seen = new Set<number>();
  const keys: number[] = [];
  for (const m of matches) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) continue;
    const k = Math.trunc(n);
    if (k < 0 || k >= effectBurn.length) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    keys.push(k);
  }

  for (const k of keys) {
    const arr = parseEffectBurnArray(effectBurn[k], maxrank);
    if (arr && Math.max(...arr) > 0) return arr;
  }

  return null;
}

function pickPrimaryBurnArray(effectBurn: (string | null)[] | undefined, maxrank: number) {
  if (!effectBurn) return null;
  let best: number[] | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < effectBurn.length; i++) {
    const arr = parseEffectBurnArray(effectBurn[i], maxrank);
    if (!arr) continue;
    const mean = avg(arr);
    const nonDecreasing = isMostlyNonDecreasing(arr) ? 1 : 0;
    const score = mean + nonDecreasing * 5;
    if (score > bestScore) {
      bestScore = score;
      best = arr;
    }
  }
  return best;
}


// -------------------------
// Champion-specific overrides
// -------------------------
// Data Dragon gives us numbers, but it does NOT encode stateful rules (ticks, dagger pickups, detonations, etc.)
// Keep this layer tiny: prefer generic Data Dragon parsing, and only override counts where needed.
type SpellOverride = {
  // Multiply the base spell damage by a count (e.g., channel ticks, multi-hit ult)
  hitMult?: number;

  // Add an extra "proc" packet as a fraction of the computed base spell damage.
  // Example: addMagicMult: 0.75 means "add ~75% of this spell's magic damage again".
  // This is intentionally conservative and only used for champs whose damage is stateful
  // (daggers, marks, detonations) and not represented as a single packet in Data Dragon.
  addPhysMult?: number;
  addMagicMult?: number;
  addTrueMult?: number;
};

type ChampionOverrides = {
  // keyed by spell slot (Q/W/E/R)
  Q?: SpellOverride;
  W?: SpellOverride;
  E?: SpellOverride;
  R?: SpellOverride;
};

const CHAMPION_OVERRIDES: Record<string, ChampionOverrides> = {
  // Katarina: Death Lotus is multi-hit. Data Dragon damage values are per-dagger.
  // Assume full channel on ONE target.
  Katarina: {
    // Bouncing Blade's meaningful damage is split between the initial hit and dagger pickup.
    // Approximation: assume you pick up ONE dagger from Q.
    Q: { addMagicMult: 0.75 },
    R: { hitMult: 15 },
  },
};

function getSpellOverride(championId: string, slot: SpellSlot): SpellOverride | null {
  const o = CHAMPION_OVERRIDES[championId];
  if (!o) return null;
  return (o as any)[slot] ?? null;
}
// -------------------------
// External spell base/type overrides (loaded from /public/data/lol/spells_overrides.json)
// Only used when DDragon base arrays are null/empty.
// JSON shape supports both champion "id" (e.g. "Aatrox") and champion numeric "key" (e.g. "266"), and Q/W/E/R keys.
// Example:
// { "266": { "Q": { "type":"phys", "base":[10,20,30,40,50] } } }
type ExternalSpellOverride = {
  type?: "phys" | "magic" | "true";
  base?: number[];
};
type ExternalOverridesJson = Record<string, Partial<Record<SpellSlot, ExternalSpellOverride>>>;

function normalizeNumArray(arr: any, maxrank: number): number[] | null {
  if (!Array.isArray(arr)) return null;
  const out = arr
    .slice(0, maxrank)
    .map((v) => Number(v))
    .map((v) => (Number.isFinite(v) ? v : 0));
  return out.length ? out : null;
}

function getExternalOverride(
  overrides: ExternalOverridesJson | null | undefined,
  champId: string,
  champKey: string | number | null | undefined,
  slot: SpellSlot,
  maxrank: number
): { base: number[] | null; type: "phys" | "magic" | "true" | null } {
  if (!overrides) return { base: null, type: null };
  const keyStr = champKey == null ? "" : String(champKey);

  const node =
    (overrides as any)?.[champId] ??
    (keyStr ? (overrides as any)?.[keyStr] : null) ??
    (overrides as any)?.[String(champId)] ??
    null;

  const slotNode = node ? (node as any)[slot] : null;
  const base = normalizeNumArray(slotNode?.base, maxrank);
  const t = slotNode?.type;
  const type = t === "phys" || t === "magic" || t === "true" ? t : null;
  return { base, type };
}


function coeffAtRank(coeff: number[] | number | undefined, rank: number) {
  if (typeof coeff === "number") return coeff;
  if (Array.isArray(coeff)) {
    const idx = clamp(rank - 1, 0, coeff.length - 1);
    return coeff[idx] ?? 0;
  }
  return 0;
}

// Heuristic damage type inference based on vars links
function inferDamageType(vars: DdSpellVar[] | undefined): "phys" | "magic" {
  const links = (vars ?? []).map((v) => (v.link ?? "").toLowerCase());
  const hasAp = links.some((l) => l.includes("spelldamage") || l.includes("magic"));
  const hasAd = links.some((l) => l.includes("attackdamage") || l.includes("bonusattackdamage"));
  // If both exist, default to magic (common for mixed scalings); you can refine later
  if (hasAd && !hasAp) return "phys";
  return "magic";
}

function inferMaxRank(spell: DdSpell | null) {
  if (!spell) return 0;
  const mr = (spell as any).maxrank;
  if (typeof mr === "number" && Number.isFinite(mr) && mr > 0) return Math.trunc(mr);

  // Fallback: infer from effect arrays if maxrank is missing.
  const eff = (spell as any).effect as (number[] | null)[] | undefined;
  if (Array.isArray(eff)) {
    let best = 0;
    for (const a of eff) {
      if (Array.isArray(a) && a.length > best) best = a.length;
    }
    if (best > 0) return best;
  }

  return 0;
}

// Compute raw spell damage (very generic):
// base = chosen effect array value at rank
// + sum(vars): AP/AD/bonusAD scalings
function computeSpellRawDamage(opts: {
  spell: DdSpell | null;
  rank: number;
  effAp: number;
  effAd: number;
  bonusAd: number;
  // External overrides (only used when base arrays are missing)
  baseOverride?: number[] | null;
  typeOverride?: "phys" | "magic" | "true" | null;
}) {
  const { spell, rank, effAp, effAd, bonusAd, baseOverride, typeOverride } = opts;
  if (!spell) return { phys: 0, magic: 0, trueDmg: 0, rawTotal: 0 };

  // Data Dragon almost always provides maxrank, but some champion JSON variants or custom
  // objects can omit it. Infer from effect arrays if needed.
  const inferredMax = inferMaxRank(spell);
  const maxrank = clamp(inferredMax || 0, 0, 10);
  if (maxrank <= 0) return { phys: 0, magic: 0, trueDmg: 0, rawTotal: 0 };

  const r = clamp(rank, 1, maxrank);

  // Prefer tooltip-referenced effect arrays first; fallback to heuristic scoring.
  // If numeric effect arrays are missing/empty, fall back to effectBurn strings.
  let baseArr =
    pickEffectArrayFromTooltip(spell.effect ?? undefined, spell.tooltip, maxrank) ||
    pickPrimaryEffectArray(spell.effect ?? undefined, maxrank);

  if (!baseArr || (Array.isArray(baseArr) && baseArr.every((v) => v === 0))) {
    baseArr =
      pickBurnArrayFromTooltip(spell.effectBurn ?? undefined, spell.tooltip, maxrank) ||
      pickPrimaryBurnArray(spell.effectBurn ?? undefined, maxrank);
  }

  // External override: if we still don't have a usable base array, use overrides (slot-based)
  if (
    (!baseArr || (Array.isArray(baseArr) && baseArr.every((v) => v === 0))) &&
    Array.isArray(baseOverride) &&
    baseOverride.length
  ) {
    baseArr = baseOverride;
  }

  const base = baseArr ? (baseArr[clamp(r - 1, 0, baseArr.length - 1)] ?? 0) : 0;

  let scaling = 0;

  for (const v of spell.vars ?? []) {
    const link = (v.link ?? "").toLowerCase();
    const c = coeffAtRank(v.coeff, r);

    if (!Number.isFinite(c) || c === 0) continue;

    if (link.includes("spelldamage")) {
      scaling += c * effAp;
    } else if (link.includes("bonusattackdamage")) {
      scaling += c * bonusAd;
    } else if (link.includes("attackdamage")) {
      scaling += c * effAd;
    } else {
      // ignore other scalings for now (hp, mana, etc.)
    }
  }

  // If Data Dragon encodes per-hit damage for a multi-hit spell, we can sometimes find a hit-count array.
  // This is intentionally conservative: only apply when the tooltip/name looks multi-hit.
  const hitArr = pickHitCountEffectArray(spell.effect ?? undefined, maxrank, baseArr);
  const hitCount = hitArr ? (hitArr[clamp(r - 1, 0, hitArr.length - 1)] ?? 1) : 1;
  const useHits = hitArr && textLooksMultiHit(spell.tooltip, spell.name);

  const perHit = Math.max(0, base + scaling);
  const rawTotal = useHits ? perHit * clamp(hitCount, 1, 50) : perHit;

  const forced = typeOverride;
  const dmgType = forced ?? inferDamageType(spell.vars);
  if (dmgType === "true") return { phys: 0, magic: 0, trueDmg: rawTotal, rawTotal };
  if (dmgType === "phys") return { phys: rawTotal, magic: 0, trueDmg: 0, rawTotal };
  return { phys: 0, magic: rawTotal, trueDmg: 0, rawTotal };
}


// ==============================
// CommunityDragon tooltip-calculation parsing (works for ALL champs)
// ==============================

// Extract first damage placeholder key from tooltip, preferring typed tags.
function extractCalcKeyFromTooltip(tooltip?: string): { key: string; dmg: "phys" | "magic" | "true" } | null {
  if (!tooltip) return null;
  const t = String(tooltip);

  const typed = [
    { tag: "physicalDamage", dmg: "phys" as const },
    { tag: "magicDamage", dmg: "magic" as const },
    { tag: "trueDamage", dmg: "true" as const },
  ];

  for (const { tag, dmg } of typed) {
    // match: <physicalDamage> ... {{ qdamage }} ... </physicalDamage>
    const re = new RegExp(`<${tag}>[\\s\\S]*?\\{\\{\\s*([a-zA-Z0-9_]+)\\s*\\}\\}[\\s\\S]*?<\\/${tag}>`, "i");
    const m = re.exec(t);
    if (m?.[1]) return { key: m[1], dmg };
  }

  // fallback: first {{ key }}
  const m2 = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/.exec(t);
  if (m2?.[1]) return { key: m2[1], dmg: "magic" }; // unknown → treat as magic by default
  return null;
}

function pickRankedNumber(val: any, rank: number): number {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (Array.isArray(val)) {
    const i = clamp(rank - 1, 0, val.length - 1);
    const n = val[i];
    return typeof n === "number" && Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// Best-effort evaluator for CommunityDragon "spellCalculations" entries.
// Supports the common pattern: base values per rank + coefficients that scale with AP/AD/bonusAD.
function evalCdCalculation(
  calc: any,
  rank: number,
  stats: { ap: number; ad: number; bonusAd: number }
): number {
  if (!calc) return 0;

  // 1) Base values (most common)
  // Common shapes:
  // - { values: [10,20,30,40,50], ... }
  // - { values: [[10,20,30,40,50]], ... }  (nested)
  // - { values: { "1": 10, "2": 20, ... } }
  let base = 0;

  const values = (calc as any).values ?? (calc as any).value ?? null;
  if (Array.isArray(values)) {
    if (values.length && Array.isArray(values[0])) {
      // nested arrays: pick first numeric row that looks ranked
      let row: any[] | null = null;
      for (const r of values) {
        if (Array.isArray(r) && r.some((x) => typeof x === "number")) {
          row = r;
          break;
        }
      }
      base = row ? pickRankedNumber(row, rank) : 0;
    } else {
      base = pickRankedNumber(values, rank);
    }
  } else if (values && typeof values === "object") {
    const arr = Object.keys(values)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (values as any)[k]);
    base = pickRankedNumber(arr, rank);
  }

  // 2) Coefficients (AP/AD scalings)
  let scaling = 0;
  const coeffs = (calc as any).coefficients;
  if (Array.isArray(coeffs)) {
    for (const c of coeffs) {
      const coef = pickRankedNumber((c as any).coefficient ?? (c as any).coeff ?? (c as any).value, rank);
      if (!Number.isFinite(coef) || coef === 0) continue;

      const rawKey = String((c as any).scaling ?? (c as any).stat ?? (c as any).link ?? "").toLowerCase();

      if (rawKey.includes("bonus") && rawKey.includes("attack")) {
        scaling += coef * stats.bonusAd;
      } else if (rawKey.includes("attack") || rawKey.includes("ad")) {
        scaling += coef * stats.ad;
      } else if (rawKey.includes("ability") || rawKey.includes("spell") || rawKey.includes("magic") || rawKey.includes("ap")) {
        scaling += coef * stats.ap;
      } else {
        // unknown coefficient type → ignore (keeps us safe)
      }
    }
  }

  const out = base + scaling;
  return Number.isFinite(out) ? Math.max(0, out) : 0;
}

// CommunityDragon-aware spell raw damage.
// It looks for the first damage placeholder in the tooltip (e.g., {{ qdamage }})
// then evaluates ddFull.spellCalculations[qdamage] with AP/AD/bonusAD.
function computeSpellRawDamageFromCd(opts: {
  ddFull: DdChampionFull | null;
  spell: DdSpell | null;
  slot: SpellSlot;
  rank: number;
  effAp: number;
  effAd: number;
  bonusAd: number;
}) {
  const { ddFull, spell, rank, effAp, effAd, bonusAd } = opts;
  if (!ddFull || !spell) return null;

  const calcRef = extractCalcKeyFromTooltip(spell.tooltip);
  if (!calcRef?.key) return null;

  const calc = ddFull.spellCalculations?.[calcRef.key];
  const raw = evalCdCalculation(calc, rank, {
    ap: Number.isFinite(effAp) ? effAp : 0,
    ad: Number.isFinite(effAd) ? effAd : 0,
    bonusAd: Number.isFinite(bonusAd) ? bonusAd : 0,
  });

  if (!(raw > 0)) return null;

  if (calcRef.dmg === "phys") return { phys: raw, magic: 0, trueDmg: 0, rawTotal: raw };
  if (calcRef.dmg === "true") return { phys: 0, magic: 0, trueDmg: raw, rawTotal: raw };
  return { phys: 0, magic: raw, trueDmg: 0, rawTotal: raw };
}

export default function LolClient({
  champions,
  patch,
  ddragon,
  items,
}: {
  champions: ChampionIndexRow[];
  patch: string;   // display patch like "26.4"
  ddragon: string; // ddragon asset version like "16.4.1"
  items: ItemRow[];
}) {

  // ----------------------------
  // ✅ Mobile UX state
  // ----------------------------
  const [mobileTab, setMobileTab] = useState<MobileTab>("inputs"); // default Inputs
  const [showChampMobile, setShowChampMobile] = useState(false); // collapsed by default
  const resultsRef = useRef<HTMLDivElement | null>(null);

  // ✅ Simple vs Advanced toggle
  const [uiMode, setUiMode] = useState<UiMode>("simple");
  const toggleUiMode = () =>
    setUiMode((prev) => (prev === "simple" ? "advanced" : "simple"));

  // Champion picker
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(champions[0]?.id ?? "");

  const searchParams = useSearchParams();

  // External overrides (slot-based): loaded once, never triggers rerenders
  const externalOverridesRef = useRef<ExternalOverridesJson | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/lol/spells_overrides.json", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as ExternalOverridesJson;
        if (!cancelled) externalOverridesRef.current = json;
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);


  // ✅ Import champion from URL once: /calculators/lol?champion=Ahri
// IMPORTANT: only apply on first mount so the dropdown doesn't "lock" to the URL value.
const didInitFromUrl = useRef(false);

useEffect(() => {
  if (didInitFromUrl.current) return;
  didInitFromUrl.current = true;

  const fromUrl = searchParams.get("champion")?.trim();
  if (!fromUrl) return;

  if (!champions.some((c) => c.id === fromUrl)) return;

  setSelectedId(fromUrl);
  setQuery("");
}, [searchParams, champions]);
// Level
  const [level, setLevel] = useState<number>(1);

  // ✅ Target inputs allow blank
  const [targetHp, setTargetHp] = useState<Num>(2000);
  const [targetArmor, setTargetArmor] = useState<Num>(80);
  const [targetMr, setTargetMr] = useState<Num>(60);

  // ✅ Target champion + target level
  const [targetChampionId, setTargetChampionId] = useState<string>(""); // "" = custom
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

  // ==============================
  // Rotation / Combo (Advanced Mode)
  // ==============================
  const [useRotation, setUseRotation] = useState(false);
  const [rotation, setRotation] = useState<CastKey[]>([]);

  function addCast(k: CastKey) {
    setRotation((prev) => [...prev, k]);
  }
  function removeCastAt(i: number) {
    setRotation((prev) => prev.filter((_, idx) => idx !== i));
  }
  function moveCast(i: number, dir: -1 | 1) {
    setRotation((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function clearRotation() {
    setRotation([]);
  }

  // ==============================
  // ✅ Data Dragon full champion spell fetch
  // ==============================
  const [ddFull, setDdFull] = useState<DdChampionFull | null>(null);
  const [ddLoading, setDdLoading] = useState(false);
  const [ddErr, setDdErr] = useState<string>("");

  // Spell ranks for Q/W/E/R (needed to compute base arrays)
  const [spellRanks, setSpellRanks] = useState<Record<SpellSlot, number>>({
    Q: 1,
    W: 1,
    E: 1,
    R: 1,
  });

  // map spells by slot
  const spellBySlot = useMemo(() => {
    const spells = ddFull?.spells ?? [];
    return {
      Q: spells[0] ?? null,
      W: spells[1] ?? null,
      E: spells[2] ?? null,
      R: spells[3] ?? null,
    } as Record<SpellSlot, DdSpell | null>;
  }, [ddFull]);

  // When selected champion changes: fetch their spell data
    // When selected champion changes: fetch their spell data
  useEffect(() => {
    let alive = true;

    async function run() {
      if (!selectedId || !ddragon) {
        setDdFull(null);
        return;
      }

      setDdLoading(true);
      setDdErr("");

      try {
        // Prefer CommunityDragon via our API route (has spellCalculations so abilities can show damage).
        const champKey = (champions as any[]).find((c) => c.id === selectedId)?.key as
          | string
          | undefined;

        let champ: any = null;

        if (champKey) {
          const cdRes = await fetch(`/api/lol/champion/${champKey}`, { cache: "no-store" });
          if (cdRes.ok) {
            champ = await cdRes.json();
          }
        }

        // Fallback: Data Dragon champion json (keeps UI stable).
        if (!champ) {
          const url = `https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(
            ddragon
          )}/data/en_US/champion/${encodeURIComponent(selectedId)}.json`;

          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) throw new Error(`Champion fetch failed (${res.status})`);
          const json = await res.json();
          champ = json?.data?.[selectedId] ?? null;
        }

        if (!alive) return;

        setDdFull({
          key: champ?.key ?? null,
          spells: champ?.spells ?? [],
          passive: champ?.passive ?? null,
          spellCalculations: champ?.spellCalculations ?? champ?.spellcalculations ?? null,
        });

        // Reset ranks to 1 on champ change (safe default)
        setSpellRanks({ Q: 1, W: 1, E: 1, R: 1 });
      } catch (e: any) {
        if (!alive) return;
        setDdFull(null);
        setDdErr(e?.message ? String(e.message) : "Failed to load champion spells.");
      } finally {
        if (alive) setDdLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [selectedId, ddragon, champions]); // ✅ deps: include ddragon + champions (used for champKey)


  const selected = useMemo(
    () => champions.find((c) => c.id === selectedId),
    [champions, selectedId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return champions.slice(0, 60);
    return champions
      .filter((c) => {
        const hay = `${c.name} ${c.title ?? ""} ${(c.tags ?? []).join(" ")}`.toLowerCase();
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
  const champHp = selected
    ? selected.stats.hp + selected.stats.hpperlevel * (lvl - 1)
    : NaN;
  const champArmor = selected
    ? selected.stats.armor + selected.stats.armorperlevel * (lvl - 1)
    : NaN;
  const champMr = selected
    ? selected.stats.spellblock + selected.stats.spellblockperlevel * (lvl - 1)
    : NaN;

  // AD / AS
  const champBaseAd = selected ? (selected.stats as any).attackdamage : NaN;
  const champAdPer = selected ? (selected.stats as any).attackdamageperlevel : 0;
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

  const targetChampHp = targetChampion
    ? targetChampion.stats.hp + targetChampion.stats.hpperlevel * (tLvl - 1)
    : NaN;
  const targetChampArmor = targetChampion
    ? targetChampion.stats.armor + targetChampion.stats.armorperlevel * (tLvl - 1)
    : NaN;
  const targetChampMr = targetChampion
    ? targetChampion.stats.spellblock + targetChampion.stats.spellblockperlevel * (tLvl - 1)
    : NaN;

  // ✅ Auto-fill target stats when target champ/level changes
  useEffect(() => {
    if (!targetChampionId) return;
    setTargetHp(Number.isFinite(targetChampHp) ? Math.round(targetChampHp) : "");
    setTargetArmor(
      Number.isFinite(targetChampArmor) ? Math.round(targetChampArmor) : ""
    );
    setTargetMr(Number.isFinite(targetChampMr) ? Math.round(targetChampMr) : "");
  }, [targetChampionId, tLvl, targetChampHp, targetChampArmor, targetChampMr]);

  function onTargetManualChange() {
    if (targetChampionId) setTargetChampionId(""); // switch back to custom
  }

  // Items
  const selectedItems = useMemo(() => {
    return selectedItemIds
      .map((id) => items.find((x) => x.id === id))
      .filter(Boolean) as ItemRow[];
  }, [selectedItemIds, items]);

  const totals = useMemo(() => itemTotals(selectedItems), [selectedItems]);

  // ✅✅✅ ADDED: Total build cost (Gold) shown as "G"
  const totalGoldG = useMemo(() => {
    return selectedItems.reduce((sum, it) => sum + (it.gold ?? 0), 0);
  }, [selectedItems]);

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
  const effAs = Number.isFinite(champAs)
    ? champAs * (1 + totals.asPct / 100)
    : NaN;

  const bonusAd = useMemo(() => {
    if (!Number.isFinite(effAd) || !Number.isFinite(champAd)) return 0;
    return Math.max(0, effAd - champAd);
  }, [effAd, champAd]);

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

  // ==============================
  // ✅ Rotation / Combo using Data Dragon spells
  // ==============================
  
  // Detailed per-cast packets (for UI) + totals.
  const rotationSteps = useMemo(() => {
    if (!useRotation || rotation.length === 0) return [] as {
      key: CastKey;
      phys: number;
      magic: number;
      trueDmg: number;
      rawTotal: number;
    }[];

    // AA raw components
    const aaPhysRaw = Number.isFinite(oneAutoRaw) ? oneAutoRaw : 0;
    const aaMagicRaw = Math.max(0, ohMagic);
    const aaTrueRaw = 0;

    const steps: {
      key: CastKey;
      phys: number;
      magic: number;
      trueDmg: number;
      rawTotal: number;
    }[] = [];

    for (const cast of rotation) {
      if (cast === "AA") {
        const phys = aaPhysRaw;
        const magic = aaMagicRaw;
        const trueDmg = aaTrueRaw;
        steps.push({ key: cast, phys, magic, trueDmg, rawTotal: phys + magic + trueDmg });
        continue;
      }

      const slot = cast as SpellSlot;
      const spell = spellBySlot[slot];
      const rank = spellRanks[slot] ?? 1;
      const champKey = (ddFull as any)?.key ?? (ddFull as any)?.data?.[selectedId]?.key ?? (selected as any)?.key ?? null;
      const ext = getExternalOverride(externalOverridesRef.current, selectedId, champKey, slot, inferMaxRank(spell));

      const dmgCd = computeSpellRawDamageFromCd({
        ddFull,
        spell,
        slot,
        rank,
        effAp: Number.isFinite(effAp) ? effAp : 0,
        effAd: Number.isFinite(effAd) ? effAd : 0,
        bonusAd,
      });

      const dmg =
        dmgCd && dmgCd.rawTotal > 0 ? dmgCd :
        computeSpellRawDamage({
          spell,
          rank,
          baseOverride: ext.base,
          typeOverride: ext.type,
          effAp: Number.isFinite(effAp) ? effAp : 0,
          effAd: Number.isFinite(effAd) ? effAd : 0,
          bonusAd,
        });

      const ov = getSpellOverride(selectedId, slot);
      const mult = clamp(ov?.hitMult ?? 1, 0, 1000);

      const addPhysMult = clamp(ov?.addPhysMult ?? 0, 0, 10);
      const addMagicMult = clamp(ov?.addMagicMult ?? 0, 0, 10);
      const addTrueMult = clamp(ov?.addTrueMult ?? 0, 0, 10);

      const phys = dmg.phys * mult * (1 + addPhysMult);
      const magic = dmg.magic * mult * (1 + addMagicMult);
      const trueDmg = dmg.trueDmg * mult * (1 + addTrueMult);

      steps.push({ key: cast, phys, magic, trueDmg, rawTotal: phys + magic + trueDmg });
    }

    return steps;
  }, [
    useRotation,
    rotation,
    spellBySlot,
    spellRanks,
    effAp,
    effAd,
    bonusAd,
    oneAutoRaw,
    ohMagic,
    ddFull,
    selectedId,
  ]);


  const rotationRaw = useMemo(() => {
    if (!useRotation || rotationSteps.length === 0) return { phys: 0, magic: 0, trueDmg: 0 };
    let phys = 0;
    let magic = 0;
    let trueDmg = 0;
    for (const s of rotationSteps) {
      phys += s.phys;
      magic += s.magic;
      trueDmg += s.trueDmg;
    }
    return { phys, magic, trueDmg };
  }, [useRotation, rotationSteps]);


  // ✅ Advanced mode: lock to Combos only
  useEffect(() => {
    if (uiMode === "advanced") setMode("burst");
  }, [uiMode]);

  // ---------- Advanced math (post-mitigation) ----------
  // If rotation is enabled, feed rotation totals into the same resist math.
  // - Burst: treat rotationRaw as the burst packet.
  // - DPS: convert rotationRaw into per-second by dividing by window.
  const advPhysForMath =
    useRotation && rotation.length > 0
      ? mode === "burst"
        ? rotationRaw.phys
        : advWindow > 0
        ? rotationRaw.phys / advWindow
        : 0
      : mode === "burst"
      ? advBurstPhys
      : advDpsPhys;

  const advMagicForMath =
    useRotation && rotation.length > 0
      ? mode === "burst"
        ? rotationRaw.magic
        : advWindow > 0
        ? rotationRaw.magic / advWindow
        : 0
      : mode === "burst"
      ? advBurstMagic
      : advDpsMagic;


 const advTrueForMath =
    useRotation && rotation.length > 0
      ? mode === "burst"
        ? rotationRaw.trueDmg
        : advWindow > 0
        ? rotationRaw.trueDmg / advWindow
        : 0
      : mode === "burst"
      ? advBurstTrue
      : advDpsTrue;

  const burstPost =
    (Number.isFinite(physMult) ? advPhysForMath * physMult : NaN) +
    (Number.isFinite(magicMult) ? advMagicForMath * magicMult : NaN) +
    advTrueForMath;

  const burstPct =
    Number.isFinite(burstPost) && tHP > 0 ? (burstPost / tHP) * 100 : NaN;

  const dpsPost =
    (Number.isFinite(physMult) ? advPhysForMath * physMult : NaN) +
    (Number.isFinite(magicMult) ? advMagicForMath * magicMult : NaN) +
    advTrueForMath;

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
    if (ohMagic > 0) setBurstMagicRaw((prev) => Math.round(num0(prev) + ohMagic));
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
    Number.isFinite(simpleDpsPost) && simpleDpsPost > 0 ? tHP / simpleDpsPost : NaN;

  const simpleWindowDamage =
    Number.isFinite(simpleDpsPost) && sWindow > 0 ? simpleDpsPost * sWindow : NaN;

  const simpleWindowPct =
    Number.isFinite(simpleWindowDamage) && tHP > 0
      ? (simpleWindowDamage / tHP) * 100
      : NaN;

  // ✅ Kill Check (est.)
  const hasItems = selectedItems.length > 0;
  const killLabel = hasItems ? "with items" : "no items";

  const killCheck = useMemo(() => {
    if (!(tHP > 0)) {
      return { status: "—", detail: "Enter a target HP.", hint: "" };
    }

    // SIMPLE
    if (uiMode === "simple") {
      if (simpleType === "burst") {
        if (!Number.isFinite(simpleBurstPost)) {
          return { status: "—", detail: "Not enough data.", hint: "" };
        }
        if (simpleBurstPost >= tHP) {
          return { status: "✅ Killable", detail: `Burst kills (${killLabel}).`, hint: "" };
        }
        return {
          status: "❌ Not killable",
          detail: `Burst doesn't kill (${killLabel}).`,
          hint: "",
        };
      } else {
        if (!Number.isFinite(simpleTimeToKill) || !Number.isFinite(sWindow) || sWindow <= 0) {
          return { status: "—", detail: "Set a window (sec).", hint: "" };
        }
        if (simpleTimeToKill <= sWindow) {
          return {
            status: "✅ Killable",
            detail: `Kills in ~${fmt(simpleTimeToKill, 2)}s (${killLabel}).`,
            hint: "",
          };
        }
        return {
          status: "❌ Not killable",
          detail: `Needs ~${fmt(simpleTimeToKill, 2)}s (${killLabel}).`,
          hint: "",
        };
      }
    }

    // ADVANCED (locked to burst)
    if (!Number.isFinite(burstPost)) {
      return { status: "—", detail: "Not enough data.", hint: "" };
    }
    if (burstPost >= tHP) {
      return { status: "✅ Killable", detail: `Burst kills (${killLabel}).`, hint: "" };
    }
    return { status: "❌ Not killable", detail: `Burst doesn't kill (${killLabel}).`, hint: "" };
  }, [
    tHP,
    uiMode,
    simpleType,
    simpleBurstPost,
    simpleTimeToKill,
    sWindow,
    burstPost,
    killLabel,
  ]);

  // ----------------------------
  // ✅ Sticky "Killable" bar numbers
  // ----------------------------
  const stickyModeLabel =
    uiMode === "simple" ? (simpleType === "burst" ? "Burst" : "DPS") : "Burst";

  const stickyDamage =
    uiMode === "simple"
      ? simpleType === "burst"
        ? simpleBurstPost
        : simpleWindowDamage
      : burstPost;

  const stickyPct =
    uiMode === "simple"
      ? simpleType === "burst"
        ? simpleBurstPct
        : simpleWindowPct
      : burstPct;

  // ----------------------------
  // ✅ Top sticky Burst/DPS switch (mobile)
  // ----------------------------
  const currentFightMode: Mode = uiMode === "simple" ? simpleType : "burst";
  const setFightMode = (m: Mode) => {
    if (uiMode === "simple") setSimpleType(m);
    // Advanced is locked to Combos
  };

  // ✅ Reset Results (does NOT touch champion, target, or items)
  function resetResults() {
    // Advanced knobs
    setBurstPhysRaw(300);
    setBurstMagicRaw(200);
    setBurstTrueRaw(0);

    setDpsPhysRaw(200);
    setDpsMagicRaw(0);
    setDpsTrueRaw(0);
    setWindowSec(6);

    setOnHitFlatMagic(0);
    setOnHitPctTargetMaxHpPhys(0);
    setCritDamageMult(2.0);

    // Rotation (advanced)
    setUseRotation(false);
    clearRotation();
    setSpellRanks({ Q: 1, W: 1, E: 1, R: 1 });
    setMode("burst");

    // Simple knobs
    setSimpleType("burst");
    setSimpleWindow(6);
    setSimpleAAs(6);
  }

  return (
    <div className="pb-28 lg:pb-0">
      {/* ✅ Mobile sticky header: Tabs + Burst/DPS */}
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
                  resultsRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
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
          </div>

          {/* ✅ Advanced: remove DOT selection from mobile sticky header */}
          {uiMode === "simple" ? (
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFightMode("burst")}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                  currentFightMode === "burst"
                    ? "border-neutral-600 bg-neutral-900 text-white"
                    : "border-neutral-800 bg-black text-neutral-400 hover:border-neutral-600"
                }`}
              >
                Combos
              </button>
              <button
                type="button"
                onClick={() => setFightMode("dps")}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                  currentFightMode === "dps"
                    ? "border-neutral-600 bg-neutral-900 text-white"
                    : "border-neutral-800 bg-black text-neutral-400 hover:border-neutral-600"
                }`}
              >
                Damage Over Time
              </button>
            </div>
          ) : (
            <div className="mt-1.5">
              <button
                type="button"
                className="w-full rounded-lg border border-neutral-600 bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white"
                disabled
                title="Advanced mode uses Combos only"
              >
                Combos
              </button>
            </div>
          )}
        </div>
      </div>

      
<div className="mt-10 grid gap-6 lg:grid-cols-2 lg:items-start">
  {/* Inputs */}
  <section
    className={`rounded-2xl border border-neutral-800 bg-neutral-950 p-6 ${
      mobileTab !== "inputs" ? "hidden lg:block" : ""
    }`}
  >
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
              title="Click to switch mode"
            >
              {uiMode === "simple" ? "Simple" : "Advanced"}
            </button>
          </div>

          {/* ✅ Mobile: collapsible Selected champion */}
          <div className="lg:hidden mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
            <button
              type="button"
              onClick={() => setShowChampMobile((v) => !v)}
              className="w-full flex items-center justify-between"
            >
              <div className="text-sm font-semibold">
                {selected?.name ?? "—"} • Lvl {lvl}
              </div>
              <div className="text-xs text-neutral-500">
                {showChampMobile ? "Hide" : "Show"}
              </div>
            </button>

            <div className="mt-2 text-xs text-neutral-400">
              HP {fmt(champHp, 0)} • Armor {fmt(champArmor, 0)} • MR {fmt(champMr, 0)}
            </div>

            {showChampMobile && (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-neutral-300">Title</span>
                  <span className="font-semibold text-neutral-200">{selected?.title ?? "—"}</span>
                </div>

                <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-neutral-300">Resource</span>
                  <span className="font-semibold text-neutral-200">
                    {(selected as any)?.partype ?? "—"}
                  </span>
                </div>
              </div>
            )}
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
                  {c.name} {c.title ? `— ${c.title}` : ""}
                </option>
              ))}
            </select>

            <div className="mt-2 text-xs text-neutral-500">
              Loaded <span className="text-neutral-300 font-semibold">{champions.length}</span>{" "}
              champions • Data Dragon patch{" "}
              <span className="text-neutral-300 font-semibold">{patch}</span>
            </div>

            <div className="mt-2 text-xs text-neutral-500">
              Showing {filtered.length} results (type to filter). Selected:{" "}
              <span className="text-neutral-300 font-semibold">{selected?.name ?? "—"}</span>
            </div>

            {/* ✅ Spell data status */}
            {uiMode === "advanced" && (
              <div className="mt-2 text-xs text-neutral-500">
                Spells:{" "}
                {ddLoading ? (
                  <span className="text-neutral-300 font-semibold">Loading…</span>
                ) : ddErr ? (
                  <span className="text-red-400 font-semibold">{ddErr}</span>
                ) : ddFull?.spells?.length ? (
                  <span className="text-neutral-300 font-semibold">Loaded</span>
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </div>
            )}
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
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <div className="text-sm font-semibold">Target</div>
              <div className="text-[11px] leading-snug text-neutral-500 sm:text-xs sm:leading-normal sm:text-neutral-500">
                {uiMode === "advanced"
                  ? "Choose a champion or enter custom stats."
                  : "Choose a champion to simulate a matchup."}
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm text-neutral-300">Champion:</label>
                <select
                  value={targetChampionId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setTargetChampionId(id);
                    if (!targetLevelTouched) setTargetLevel(lvl);
                  }}
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                >
                  <option value="">Custom</option>
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
                  <div className="mt-1 text-xs text-neutral-500">Auto-synced to your level.</div>
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

            {uiMode === "advanced" && (
              <>
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
              </>
            )}
          </div>

          {/* Items */}
          <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Items</div>
              <div className="text-xs text-neutral-500">{selectedItems.length}/6</div>
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
                      <span className="text-neutral-200 font-semibold">+{totals.hp}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">AD</span>
                      <span className="text-neutral-200 font-semibold">+{totals.ad}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">AP</span>
                      <span className="text-neutral-200 font-semibold">+{totals.ap}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Armor</span>
                      <span className="text-neutral-200 font-semibold">+{totals.armor}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">MR</span>
                      <span className="text-neutral-200 font-semibold">+{totals.mr}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">AS</span>
                      <span className="text-neutral-200 font-semibold">+{fmt(totals.asPct, 0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Crit</span>
                      <span className="text-neutral-200 font-semibold">
                        +{fmt(totals.critChancePct, 0)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Lethality</span>
                      <span className="text-neutral-200 font-semibold">+{fmt(totals.lethality, 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">% Armor Pen</span>
                      <span className="text-neutral-200 font-semibold">
                        +{fmt(totals.armorPenPct, 0)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Magic Pen</span>
                      <span className="text-neutral-200 font-semibold">+{fmt(totals.magicPenFlat, 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">% Magic Pen</span>
                      <span className="text-neutral-200 font-semibold">
                        +{fmt(totals.magicPenPct, 0)}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-neutral-500">
                    Stats are applied. True “unique passives” require the knobs below (we’ll expand later).
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
                  <label className="text-sm text-neutral-300">On-hit Magic (flat)</label>
                  <input
                    type="number"
                    value={onHitFlatMagic}
                    onChange={(e) => setNum(setOnHitFlatMagic, 0, 9999)(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                  />
                  <div className="mt-1 text-xs text-neutral-500">Applied per auto (mitigated by MR).</div>
                </div>

                <div>
                  <label className="text-sm text-neutral-300">% Target HP On-hit (phys)</label>
                  <input
                    type="number"
                    value={onHitPctTargetMaxHpPhys}
                    onChange={(e) => setNum(setOnHitPctTargetMaxHpPhys, 0, 50)(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                  />
                  <div className="mt-1 text-xs text-neutral-500">
                    Example: 3 = 3% max HP per hit (mitigated by armor).
                  </div>
                </div>

                <div>
                  <label className="text-sm text-neutral-300">Crit Damage Mult</label>
                  <input
                    type="number"
                    step="0.05"
                    value={critDamageMult}
                    onChange={(e) => setNum(setCritDamageMult, 1.0, 5.0)(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                  />
                  <div className="mt-1 text-xs text-neutral-500">Default is 2.00 (expected crit).</div>
                </div>
              </div>
            </div>
          )}

          {/* SIMPLE CONTROLS */}
          {uiMode === "simple" && (
            <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Quick Mode</div>
                <div className="text-xs text-neutral-500">Autos baseline + stats + pen + crit.</div>
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
                  Combos
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
                  Damage Over Time
                </button>
              </div>

              <div className="mt-4 min-h-[88px]">
                {simpleType === "burst" ? (
                  <div>
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
                  <div>
                    <label className="text-sm text-neutral-300">Window (sec)</label>
                    <input
                      type="number"
                      value={simpleWindow}
                      onChange={(e) => setNum(setSimpleWindow, 0, 120)(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                    />
                    <div className="mt-1 text-xs text-neutral-500">&nbsp;</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ADVANCED CONTROLS */}
          {uiMode === "advanced" && (
            <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
              <div className="text-sm font-semibold">Mode</div>

              {/* ✅ Removed "Damage Over Time" button above Rotation/Combo */}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setMode("burst")}
                  className="w-full rounded-xl border border-neutral-500 bg-neutral-900 px-3 py-2 text-center text-sm font-semibold text-white"
                >
                  Combos
                </button>
              </div>

              <div className="mt-3 text-xs text-neutral-500">
                Advanced = Combos only. Rotation/Combo damage counts toward your total automatically.
              </div>
            </div>
          )}

          {/* ✅✅✅ MOVED: Rotation / Combo (Advanced) now UNDER the mode buttons */}
          {uiMode === "advanced" && (
            <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Rotation / Combo</div>
                  <div className="text-xs text-neutral-500">
                    Choose cast order. Q/W/E/R uses Data Dragon (best-effort), AA uses your AA math.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setUseRotation((v) => {
                      const next = !v;
                      if (!next) clearRotation();
                      return next;
                    });
                  }}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                    useRotation
                      ? "border-neutral-500 bg-neutral-900 text-white"
                      : "border-neutral-800 bg-black text-neutral-300 hover:border-neutral-600"
                  }`}
                >
                  {useRotation ? "On" : "Off"}
                </button>
              </div>

              {/* Spell rank controls */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["Q", "W", "E", "R"] as SpellSlot[]).map((slot) => {
                  const sp = spellBySlot[slot];
                  const max = clamp(sp?.maxrank ?? (slot === "R" ? 3 : 5), 1, 10);
                  const val = clamp(spellRanks[slot] ?? 1, 1, max);

                  return (
                    <div key={slot} className="rounded-xl border border-neutral-800 bg-black px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-neutral-400">{slot}</div>
                        <div className="text-xs text-neutral-500">
                          Rank <span className="text-neutral-200 font-semibold">{val}</span> / {max}
                        </div>
                      </div>

                      <div className="mt-1 text-xs text-neutral-300 font-semibold truncate">
                        {sp?.name ?? "—"}
                      </div>

                      <input
                        type="range"
                        min={1}
                        max={max}
                        value={val}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setSpellRanks((prev) => ({ ...prev, [slot]: n }));
                        }}
                        className="mt-2 w-full"
                        disabled={!sp}
                      />

                      {!sp && (
                        <div className="mt-1 text-[11px] text-neutral-500">
                          Spell data not loaded yet.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {useRotation && (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["Q", "W", "E", "R", "AA"] as CastKey[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => addCast(k)}
                        className="rounded-lg border border-neutral-800 bg-black px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:border-neutral-600"
                      >
                        {k}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={clearRotation}
                      className="ml-auto rounded-lg border border-neutral-800 bg-black px-3 py-1.5 text-xs font-semibold text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {rotation.length === 0 && (
                      <div className="text-xs text-neutral-500">No casts added yet.</div>
                    )}

                    {rotation.map((k, i) => {
                      const s = rotationSteps[i];
                      const raw = s ? s.rawTotal : 0;
                      const phys = s ? s.phys : 0;
                      const magic = s ? s.magic : 0;
                      return (
                      <div
                        key={`${k}-${i}`}
                        className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2"
                      >
                        <div className="text-sm font-semibold w-8">{k}</div>

                        <div className="flex flex-col leading-tight">
                          <div className="text-xs text-neutral-300 font-semibold">
                            {raw > 0 ? `${Math.round(raw)} raw` : "—"}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {raw > 0 ? `phys ${Math.round(phys)} / magic ${Math.round(magic)}` : ""}
                          </div>
                        </div>

                        <div className="ml-auto flex gap-1">
                          <button
                            type="button"
                            onClick={() => moveCast(i, -1)}
                            disabled={i === 0}
                            className="rounded border border-neutral-800 px-2 py-0.5 text-xs disabled:opacity-40"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveCast(i, 1)}
                            disabled={i === rotation.length - 1}
                            className="rounded border border-neutral-800 px-2 py-0.5 text-xs disabled:opacity-40"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCastAt(i)}
                            className="rounded border border-neutral-800 px-2 py-0.5 text-xs text-red-400 hover:border-red-500"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 text-xs text-neutral-500">
                    Rotation raw total:{" "}
                    <span className="text-neutral-300 font-semibold">
                      {Math.round(rotationRaw.phys + rotationRaw.magic + rotationRaw.trueDmg)}
                    </span>{" "}
                    (phys {Math.round(rotationRaw.phys)} / magic {Math.round(rotationRaw.magic)})
                  </div>

                  <div className="mt-1 text-[11px] text-neutral-500">
                    Note: Data Dragon spell parsing is best-effort. Some spells may need champion-specific tuning.
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        {/* ✅ FIX #2 — REPLACE your entire Right column <section> opening tag with this */}
  <section
    className={`rounded-2xl border border-neutral-800 bg-neutral-950 p-6 flex flex-col
      lg:sticky lg:top-6 lg:self-start lg:h-fit
      ${mobileTab !== "results" ? "hidden lg:flex" : ""}`}
  >
  {/* ✅ Collapsible: Selected champion (desktop only) */}
  <div className="hidden lg:block">
    <details
      className="group rounded-2xl border border-neutral-800 bg-black"
      open={false}
    >
      <summary className="cursor-pointer list-none select-none px-4 py-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-white">Selected champion</div>
        <div className="text-xs text-neutral-500 group-open:hidden">Show</div>
        <div className="text-xs text-neutral-500 hidden group-open:block">Hide</div>
      </summary>

      <div className="px-4 pb-4 pt-1 space-y-3">
        <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-neutral-300">Name</span>
          <span className="font-semibold">{selected?.name ?? "—"}</span>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-neutral-300">Title</span>
          <span className="font-semibold text-neutral-200">{selected?.title ?? "—"}</span>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-neutral-300">Level</span>
          <span className="font-semibold text-neutral-200">{lvl}</span>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-neutral-300">HP (at level)</span>
          <span className="font-semibold text-neutral-200">{fmt(champHp, 1)}</span>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-neutral-300">Armor (at level)</span>
          <span className="font-semibold text-neutral-200">{fmt(champArmor, 1)}</span>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-neutral-300">MR (at level)</span>
          <span className="font-semibold text-neutral-200">{fmt(champMr, 1)}</span>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-neutral-300">Resource</span>
          <span className="font-semibold text-neutral-200">
            {(selected as any)?.partype ?? "—"}
          </span>
        </div>
      </div>
    </details>
  </div>

  {/* Results (scrolls with page like normal) */}
  <div
    ref={resultsRef}
    className={`mt-6 rounded-2xl border border-neutral-800 bg-black p-3 ${
      uiMode === "simple" ? "min-h-[240px]" : ""
    }`}
  >
    
          
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Results</div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetResults}
                  className="rounded-lg border border-neutral-800 bg-black px-2.5 py-1 text-[11px] font-semibold text-neutral-200 hover:border-neutral-600"
                  title="Resets damage inputs, windows, crit/on-hit, and rotation (does not touch champion/target/items)."
                >
                  Reset Results
                </button>

                <div className="text-xs text-neutral-500">
                  {uiMode === "simple" ? (
                    <>
                      Mode:{" "}
                      <span className="text-neutral-300 font-semibold">
                        {simpleType === "burst" ? "Burst" : "Damage Over Time"}
                      </span>
                    </>
                  ) : (
                    <>
                      Mode:{" "}
                      <span className="text-neutral-300 font-semibold">Burst</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-neutral-800 bg-black px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-neutral-300">Kill Check (est.)</div>
                <div className="text-[11px] text-neutral-500">{hasItems ? "With items" : "No items"}</div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-neutral-300">Result</span>
                <span className="font-semibold text-neutral-200">{killCheck.status}</span>
              </div>

              <div className="mt-1 text-xs text-neutral-500">{killCheck.detail}</div>

              <div className="mt-2 text-[11px] text-neutral-500">
                Based on your damage vs target HP only (no enemy damage/healing/shields/CC).
              </div>
            </div>

            {totalGoldG > 0 && (
              <div className="mt-4 rounded-xl border border-neutral-800 bg-black px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-300">Cost</span>
                  <span className="font-semibold text-neutral-200">
                    {totalGoldG.toLocaleString()}G
                  </span>
                </div>
              </div>
            )}

            {uiMode === "advanced" && (
              <div className="mt-4 rounded-xl border border-neutral-800 bg-black px-3 py-3">
                <div className="text-xs font-semibold text-neutral-300">Effective stats (champ + items)</div>

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
            )}

            {/* SIMPLE RESULTS */}
            {uiMode === "simple" ? (
              <>
                {simpleType === "burst" ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-neutral-300">Total Damage</span>
                      <span className="font-semibold text-neutral-200">{fmt(simpleBurstPost, 0)}</span>
                    </div>
                    <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-neutral-300">% of Target HP</span>
                      <span className="font-semibold text-neutral-200">
                        {Number.isFinite(simpleBurstPct) ? `${fmt(simpleBurstPct, 1)}%` : "—"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-neutral-300">Damage (autos, window)</span>
                      <span className="font-semibold text-neutral-200">{fmt(simpleWindowDamage, 0)}</span>
                    </div>
                    <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-neutral-300">Time to kill (est.)</span>
                      <span className="font-semibold text-neutral-200">
                        {Number.isFinite(simpleTimeToKill) ? `${fmt(simpleTimeToKill, 2)}s` : "—"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-3 text-xs text-neutral-500">
                  Simple mode is autos-baseline (stats + pen + expected crit). Abilities come later.
                </div>
              </>
            ) : (
              <>
                {/* ADVANCED RESULTS (Burst only) */}
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

                {/* Only show manual buckets when rotation is off */}
                {!useRotation && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="text-sm text-neutral-300">Raw Physical</label>
                      <input
                        type="number"
                        value={burstPhysRaw}
                        onChange={(e) => setNum(setBurstPhysRaw, 0, 999999)(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                      />
                      <div className="mt-1 text-xs text-neutral-500">
                        After armor:{" "}
                        <span className="text-neutral-300 font-semibold">
                          {Number.isFinite(physMult) ? fmt(num0(burstPhysRaw) * physMult, 0) : "—"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-neutral-300">Raw Magic</label>
                      <input
                        type="number"
                        value={burstMagicRaw}
                        onChange={(e) => setNum(setBurstMagicRaw, 0, 999999)(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                      />
                      <div className="mt-1 text-xs text-neutral-500">
                        After MR:{" "}
                        <span className="text-neutral-300 font-semibold">
                          {Number.isFinite(magicMult) ? fmt(num0(burstMagicRaw) * magicMult, 0) : "—"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-neutral-300">True Damage</label>
                      <input
                        type="number"
                        value={burstTrueRaw}
                        onChange={(e) => setNum(setBurstTrueRaw, 0, 999999)(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                      />
                      <div className="mt-1 text-xs text-neutral-500">Not reduced by resists</div>
                    </div>
                  </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-neutral-300">Total (post-mitigation)</span>
                    <span className="font-semibold text-neutral-200">{fmt(burstPost, 0)}</span>
                  </div>
                  <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-neutral-300">% of Target HP</span>
                    <span className="font-semibold text-neutral-200">
                      {Number.isFinite(burstPct) ? `${fmt(burstPct, 1)}%` : "—"}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className="mt-4 text-[11px] leading-relaxed text-neutral-500">
              <span className="font-semibold text-neutral-400">Legend:</span>{" "}
              HP = Health, AD = Attack Damage, AP = Ability Power, AS = Attack Speed, MR = Magic Resist, AA = Auto Attack,
              DPS = Damage per Second, TTK = Time to Kill, Pen = Penetration (Armor/MR)
            </div>
          </div>
        </section>
      </div>

      {/* ✅ Mobile sticky bottom: Killable bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-black/80 backdrop-blur">
        <div className="mx-auto max-w-xl px-3 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-neutral-400">
              {stickyModeLabel} •{" "}
              <span className="text-neutral-200 font-semibold truncate">{killCheck.status}</span>
            </div>
            <div className="text-xs text-neutral-500">
              Dmg <span className="text-neutral-200 font-semibold">{fmt(stickyDamage, 0)}</span> {" • "}
              <span className="text-neutral-200 font-semibold">
                {Number.isFinite(stickyPct) ? `${fmt(stickyPct, 1)}%` : "—"}
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
            className="shrink-0 rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm font-semibold text-neutral-100 hover:border-neutral-500"
          >
            Results
          </button>
        </div>
      </div>
    </div>
  );
}