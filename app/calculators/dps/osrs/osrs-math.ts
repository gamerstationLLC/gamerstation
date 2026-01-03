// app/calculators/dps/osrs/osrs-math.ts

export type Style = "melee" | "ranged" | "magic";

export type MeleePrayer =
  | "none"
  | "burst_of_strength"
  | "superhuman_strength"
  | "ultimate_strength"
  | "chivalry"
  | "piety";

export type RangedPrayer =
  | "none"
  | "sharp_eye"
  | "hawk_eye"
  | "eagle_eye"
  | "rigour";

export type MagicPrayer = "none" | "mystic_will" | "mystic_lore" | "mystic_might" | "augury";

export type Potion =
  | "none"
  | "super_combat"
  | "ranging"
  | "magic"
  | "divine_super_combat"
  | "divine_ranging"
  | "divine_magic";

export type Inputs = {
  style: Style;

  // Player levels
  atkLevel: number; // melee
  strLevel: number; // melee
  rngLevel: number;
  magLevel: number;

  // Gear bonuses
  attackBonus: number; // relevant attack style bonus (stab/slash/crush/range/magic)
  strengthBonus: number; // melee strength bonus
  rangedStrength: number; // ranged strength
  magicDamagePct: number; // e.g. 15 means +15%

  // Attack speed
  speedTicks: number; // 2..7 typically

  // Modifiers
  meleePrayer: MeleePrayer;
  rangedPrayer: RangedPrayer;
  magicPrayer: MagicPrayer;
  potion: Potion;

  // Target
  targetHp: number;
  targetDefLevel: number;
  targetDefBonus: number; // relevant defense bonus vs your style
};

// ---------- Helper clamp ----------
export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// ---------- Prayer multipliers ----------
function meleePrayerMult(p: MeleePrayer) {
  // Strength prayer multiplier
  switch (p) {
    case "burst_of_strength":
      return 1.05;
    case "superhuman_strength":
      return 1.10;
    case "ultimate_strength":
      return 1.15;
    case "chivalry":
      return 1.18;
    case "piety":
      return 1.23;
    default:
      return 1.0;
  }
}

function meleeAttackPrayerMult(p: MeleePrayer) {
  // Attack prayer multiplier (piety/chivalry also boost attack)
  switch (p) {
    case "chivalry":
      return 1.15;
    case "piety":
      return 1.20;
    default:
      return 1.0;
  }
}

function rangedPrayerMult(p: RangedPrayer) {
  switch (p) {
    case "sharp_eye":
      return 1.05;
    case "hawk_eye":
      return 1.10;
    case "eagle_eye":
      return 1.15;
    case "rigour":
      return 1.23;
    default:
      return 1.0;
  }
}

function magicPrayerMult(p: MagicPrayer) {
  switch (p) {
    case "mystic_will":
      return 1.05;
    case "mystic_lore":
      return 1.10;
    case "mystic_might":
      return 1.15;
    case "augury":
      return 1.25;
    default:
      return 1.0;
  }
}

// ---------- Potion boosts (baseline) ----------
// NOTE: These are simplified but standard-feeling.
// You can refine with exact OSRS formulas later.
function boostedMeleeAtk(base: number, pot: Potion) {
  if (pot === "super_combat" || pot === "divine_super_combat") return Math.floor(base * 1.15 + 5);
  return base;
}
function boostedMeleeStr(base: number, pot: Potion) {
  if (pot === "super_combat" || pot === "divine_super_combat") return Math.floor(base * 1.15 + 5);
  return base;
}
function boostedRanged(base: number, pot: Potion) {
  if (pot === "ranging" || pot === "divine_ranging") return Math.floor(base * 1.10 + 4);
  return base;
}
function boostedMagic(base: number, pot: Potion) {
  if (pot === "magic" || pot === "divine_magic") return Math.floor(base * 1.10 + 4);
  return base;
}

// ---------- Effective level (OSRS-ish) ----------
function effectiveLevel(baseLevel: number, prayerMult: number, styleBonus: number) {
  // OSRS typically: floor(level * prayer) + styleBonus + 8
  const boosted = Math.floor(baseLevel * prayerMult);
  return boosted + styleBonus + 8;
}

// ---------- Accuracy: attack roll vs defense roll ----------
export function hitChance(attackRoll: number, defenseRoll: number) {
  if (attackRoll <= 0 || defenseRoll <= 0) return 0;
  if (attackRoll > defenseRoll) {
    return 1 - (defenseRoll + 2) / (2 * (attackRoll + 1));
  }
  return attackRoll / (2 * (defenseRoll + 1));
}

// ---------- Max hit formulas (baseline) ----------
function meleeMaxHit(effStr: number, strBonus: number) {
  // floor(0.5 + effStr * (strBonus + 64) / 640)
  return Math.floor(0.5 + (effStr * (strBonus + 64)) / 640);
}

function rangedMaxHit(effRng: number, rangedStr: number) {
  // floor(0.5 + effRng * (rangedStr + 64) / 640)
  return Math.floor(0.5 + (effRng * (rangedStr + 64)) / 640);
}

function magicMaxHitPoweredStaff(baseSpellLikeMax: number, magicDmgPct: number) {
  // This is a "powered staff baseline" approach:
  // You supply baseSpellLikeMax (we will derive from magic level as a rough baseline)
  // Then apply % magic damage
  const mult = 1 + magicDmgPct / 100;
  return Math.floor(baseSpellLikeMax * mult);
}

// Rough baseline "powered staff max hit" from magic level (placeholder):
function poweredStaffBaseMaxHitFromMagicLevel(magLevel: number) {
  // Not a real weapon formula — just a sane baseline curve.
  // Replace later per-staff (Trident/Sang/Shadow/etc).
  // Level 75 -> ~20, Level 99 -> ~25
  const clamped = clamp(magLevel, 1, 120);
  return Math.floor(10 + clamped * 0.15);
}

// ---------- Main calc ----------
export function computeOsrsDps(input: Inputs) {
  const styleBonusAcc = 0; // v1: keep simple (you can add accurate/aggressive/etc later)
  const styleBonusDmg = 0;

  // Boost levels via potions
  const atk = boostedMeleeAtk(input.atkLevel, input.potion);
  const str = boostedMeleeStr(input.strLevel, input.potion);
  const rng = boostedRanged(input.rngLevel, input.potion);
  const mag = boostedMagic(input.magLevel, input.potion);

  let effAcc = 0;
  let effDmg = 0;
  let maxHit = 0;

  // Attack & defense rolls
  let attackRoll = 0;
  let defenseRoll = 0;

  if (input.style === "melee") {
    const accPrayer = meleeAttackPrayerMult(input.meleePrayer);
    const dmgPrayer = meleePrayerMult(input.meleePrayer);

    effAcc = effectiveLevel(atk, accPrayer, styleBonusAcc);
    effDmg = effectiveLevel(str, dmgPrayer, styleBonusDmg);

    attackRoll = effAcc * (input.attackBonus + 64);
    defenseRoll = (input.targetDefLevel + 9) * (input.targetDefBonus + 64); // baseline

    maxHit = meleeMaxHit(effDmg, input.strengthBonus);
  }

  if (input.style === "ranged") {
    const pray = rangedPrayerMult(input.rangedPrayer);

    effAcc = effectiveLevel(rng, pray, styleBonusAcc);
    effDmg = effectiveLevel(rng, pray, styleBonusDmg);

    attackRoll = effAcc * (input.attackBonus + 64);
    defenseRoll = (input.targetDefLevel + 9) * (input.targetDefBonus + 64);

    maxHit = rangedMaxHit(effDmg, input.rangedStrength);
  }

  if (input.style === "magic") {
    const pray = magicPrayerMult(input.magicPrayer);

    effAcc = effectiveLevel(mag, pray, styleBonusAcc);
    effDmg = effAcc; // for this baseline model, tie damage scaling to effective magic

    attackRoll = effAcc * (input.attackBonus + 64);
    defenseRoll = (input.targetDefLevel + 9) * (input.targetDefBonus + 64);

    const base = poweredStaffBaseMaxHitFromMagicLevel(mag);
    maxHit = magicMaxHitPoweredStaff(base, input.magicDamagePct);
  }

  const pHit = clamp(hitChance(attackRoll, defenseRoll), 0, 1);

  // Average hit per successful hit: maxHit/2 (uniform 0..max)
  const avgHitOnSuccess = maxHit / 2;

  // Expected damage per swing = pHit * avgHitOnSuccess
  const expectedPerSwing = pHit * avgHitOnSuccess;

  const secondsPerAttack = (input.speedTicks * 0.6);
  const dps = secondsPerAttack > 0 ? expectedPerSwing / secondsPerAttack : 0;

  const ttkSeconds = dps > 0 ? input.targetHp / dps : Infinity;

  return {
    attackRoll,
    defenseRoll,
    pHit,
    effAcc,
    effDmg,
    maxHit,
    avgHitOnSuccess,
    expectedPerSwing,
    secondsPerAttack,
    dps,
    ttkSeconds,
  };
}
