// lib/lol/rotationEngine.ts
import type { DDragonChampionFull, DDragonSpell } from "./ddragon";

export type RotationToken = "Q" | "W" | "E" | "R" | "AA";

export type DamageBucket = { physical: number; magic: number; true: number };

export type ScalingStats = {
  level: number;
  ap: number;
  adTotal: number;
  adBonus: number;
};

export type RotationEvent = {
  token: RotationToken;
  label: string;
  raw: DamageBucket;
};

export type RotationResult = {
  events: RotationEvent[];
  totalsRaw: DamageBucket;
};

const zero = (): DamageBucket => ({ physical: 0, magic: 0, true: 0 });
const add = (a: DamageBucket, b: DamageBucket): DamageBucket => ({
  physical: a.physical + b.physical,
  magic: a.magic + b.magic,
  true: a.true + b.true,
});
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

export function defaultSpellRanks(level: number) {
  const qwe = clamp(Math.ceil(level / 4), 1, 5);
  const r = clamp(Math.floor((level - 1) / 6) + 1, 1, 3);
  return { Q: qwe, W: qwe, E: qwe, R: r };
}

function baseByRank(spell: DDragonSpell, rank: number): number {
  const idx = clamp(rank, 1, spell.maxrank) - 1;

  const e1 = spell.effect?.[1];
  if (Array.isArray(e1) && typeof e1[idx] === "number") return e1[idx] as number;

  for (let i = 1; i < (spell.effect?.length || 0); i++) {
    const eff = spell.effect[i];
    if (Array.isArray(eff) && typeof eff[idx] === "number") return eff[idx] as number;
  }
  return 0;
}

function commonScaling(spell: DDragonSpell, s: ScalingStats): DamageBucket {
  const vars = spell.vars || [];
  let apCoeff = 0;
  let adCoeffTotal = 0;
  let adCoeffBonus = 0;

  for (const v of vars) {
    const coeff = Array.isArray(v.coeff) ? (v.coeff[0] ?? 0) : (v.coeff ?? 0);
    const link = String(v.link || "").toLowerCase();

    if (link.includes("ap")) apCoeff += coeff;
    if (link.includes("bonusattackdamage")) adCoeffBonus += coeff;
    // "attackdamage" catches total AD scaling
    if (link.includes("attackdamage") && !link.includes("bonus")) adCoeffTotal += coeff;
  }

  const scaling = apCoeff * s.ap + adCoeffTotal * s.adTotal + adCoeffBonus * s.adBonus;
  if (!Number.isFinite(scaling) || scaling <= 0) return zero();

  const physicalish = (adCoeffTotal + adCoeffBonus) > 0;
  return physicalish
    ? { physical: scaling, magic: 0, true: 0 }
    : { physical: 0, magic: scaling, true: 0 };
}

export function computeRotationRaw(opts: {
  champ: DDragonChampionFull;
  rotation: RotationToken[];
  stats: ScalingStats;
  spellRanks?: { Q: number; W: number; E: number; R: number };
  oneAutoRaw: () => DamageBucket; // AA raw damage for ONE auto
}): RotationResult {
  const ranks = opts.spellRanks || defaultSpellRanks(opts.stats.level);

  const spells = opts.champ.spells;
  const bySlot: Record<Exclude<RotationToken, "AA">, DDragonSpell> = {
    Q: spells[0]!,
    W: spells[1]!,
    E: spells[2]!,
    R: spells[3]!,
  };

  let totals = zero();
  const events: RotationEvent[] = [];

  for (const tok of opts.rotation) {
    if (tok === "AA") {
      const raw = opts.oneAutoRaw();
      events.push({ token: tok, label: "Auto", raw });
      totals = add(totals, raw);
      continue;
    }

    const spell = bySlot[tok];
    const rank = ranks[tok];
    const base = baseByRank(spell, rank);
    const scaling = commonScaling(spell, opts.stats);

    const looksPhysical = scaling.physical > 0 && scaling.magic === 0 && scaling.true === 0;
    const baseBucket: DamageBucket = looksPhysical
      ? { physical: base, magic: 0, true: 0 }
      : { physical: 0, magic: base, true: 0 };

    const raw = add(baseBucket, scaling);
    events.push({ token: tok, label: tok, raw });
    totals = add(totals, raw);
  }

  return { events, totalsRaw: totals };
}
