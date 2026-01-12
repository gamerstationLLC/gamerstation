// lib/wow/statWeights.ts

export const WOW_STAT_WEIGHTS_VERSION = "v1-starter";

export type ContentType = "raid_st" | "mplus_aoe";

export type SpecKey =
  // Death Knight
  | "dk_frost"
  | "dk_unholy"
  // Demon Hunter
  | "dh_havoc"
  // Druid
  | "druid_balance"
  | "druid_feral"
  // Evoker
  | "evoker_devastation"
  | "evoker_augmentation"
  // Hunter
  | "hunter_bm"
  | "hunter_mm"
  | "hunter_sv"
  // Mage
  | "mage_arcane"
  | "mage_fire"
  | "mage_frost"
  // Monk
  | "monk_windwalker"
  // Paladin
  | "paladin_retribution"
  // Priest
  | "priest_shadow"
  // Rogue
  | "rogue_assassination"
  | "rogue_outlaw"
  | "rogue_subtlety"
  // Shaman
  | "shaman_elemental"
  | "shaman_enhancement"
  // Warlock
  | "warlock_affliction"
  | "warlock_demonology"
  | "warlock_destruction"
  // Warrior
  | "warrior_arms"
  | "warrior_fury";

export type StatWeights = {
  haste: number;
  crit: number;
  mastery: number;
  vers: number;
};

export type SpecDef = {
  label: string;
  group: string;
  raid_st: StatWeights;
  mplus_aoe: StatWeights;
};

/**
 * Patch update checklist:
 * 1) Update numbers below
 * 2) Bump WOW_STAT_WEIGHTS_VERSION
 * 3) Commit + push (Vercel deploy)
 */
export const SPEC_DEFS: Record<SpecKey, SpecDef> = {
  // Death Knight
  dk_frost: {
    group: "Death Knight",
    label: "Frost",
    raid_st: { haste: 0.85, crit: 0.9, mastery: 1.0, vers: 0.85 },
    mplus_aoe: { haste: 0.95, crit: 0.85, mastery: 1.0, vers: 0.9 },
  },
  dk_unholy: {
    group: "Death Knight",
    label: "Unholy",
    raid_st: { haste: 1.0, crit: 0.85, mastery: 0.95, vers: 0.85 },
    mplus_aoe: { haste: 1.05, crit: 0.8, mastery: 0.95, vers: 0.9 },
  },

  // Demon Hunter
  dh_havoc: {
    group: "Demon Hunter",
    label: "Havoc",
    raid_st: { haste: 0.9, crit: 1.0, mastery: 0.85, vers: 0.85 },
    mplus_aoe: { haste: 0.95, crit: 0.95, mastery: 0.85, vers: 0.9 },
  },

  // Druid
  druid_balance: {
    group: "Druid",
    label: "Balance",
    raid_st: { haste: 0.9, crit: 0.9, mastery: 1.0, vers: 0.85 },
    mplus_aoe: { haste: 0.95, crit: 0.85, mastery: 1.05, vers: 0.9 },
  },
  druid_feral: {
    group: "Druid",
    label: "Feral",
    raid_st: { haste: 0.85, crit: 1.0, mastery: 0.9, vers: 0.85 },
    mplus_aoe: { haste: 0.9, crit: 0.95, mastery: 0.95, vers: 0.9 },
  },

  // Evoker
  evoker_devastation: {
    group: "Evoker",
    label: "Devastation",
    raid_st: { haste: 0.9, crit: 0.95, mastery: 1.0, vers: 0.85 },
    mplus_aoe: { haste: 0.95, crit: 0.9, mastery: 1.05, vers: 0.9 },
  },
  evoker_augmentation: {
    group: "Evoker",
    label: "Augmentation",
    raid_st: { haste: 1.0, crit: 0.9, mastery: 0.95, vers: 0.85 },
    mplus_aoe: { haste: 1.05, crit: 0.85, mastery: 0.95, vers: 0.9 },
  },

  // Hunter
  hunter_bm: {
    group: "Hunter",
    label: "Beast Mastery",
    raid_st: { haste: 1.05, crit: 0.8, mastery: 0.9, vers: 0.85 },
    mplus_aoe: { haste: 1.1, crit: 0.75, mastery: 0.95, vers: 0.85 },
  },
  hunter_mm: {
    group: "Hunter",
    label: "Marksmanship",
    raid_st: { haste: 0.75, crit: 1.05, mastery: 0.95, vers: 0.8 },
    mplus_aoe: { haste: 0.85, crit: 0.95, mastery: 1.0, vers: 0.85 },
  },
  hunter_sv: {
    group: "Hunter",
    label: "Survival",
    raid_st: { haste: 0.95, crit: 0.9, mastery: 0.9, vers: 0.85 },
    mplus_aoe: { haste: 1.0, crit: 0.85, mastery: 0.95, vers: 0.9 },
  },

  // Mage
  mage_arcane: {
    group: "Mage",
    label: "Arcane",
    raid_st: { haste: 0.85, crit: 0.85, mastery: 1.05, vers: 0.85 },
    mplus_aoe: { haste: 0.9, crit: 0.8, mastery: 1.05, vers: 0.9 },
  },
  mage_fire: {
    group: "Mage",
    label: "Fire",
    raid_st: { haste: 0.9, crit: 1.05, mastery: 0.65, vers: 0.8 },
    mplus_aoe: { haste: 1.0, crit: 0.85, mastery: 0.55, vers: 0.85 },
  },
  mage_frost: {
    group: "Mage",
    label: "Frost",
    raid_st: { haste: 0.85, crit: 0.75, mastery: 1.05, vers: 0.8 },
    mplus_aoe: { haste: 0.95, crit: 0.7, mastery: 0.95, vers: 0.85 },
  },

  // Monk
  monk_windwalker: {
    group: "Monk",
    label: "Windwalker",
    raid_st: { haste: 0.85, crit: 0.95, mastery: 0.95, vers: 0.85 },
    mplus_aoe: { haste: 0.9, crit: 0.9, mastery: 1.0, vers: 0.9 },
  },

  // Paladin
  paladin_retribution: {
    group: "Paladin",
    label: "Retribution",
    raid_st: { haste: 0.9, crit: 0.95, mastery: 1.0, vers: 0.85 },
    mplus_aoe: { haste: 0.95, crit: 0.9, mastery: 1.0, vers: 0.9 },
  },

  // Priest
  priest_shadow: {
    group: "Priest",
    label: "Shadow",
    raid_st: { haste: 1.0, crit: 0.85, mastery: 0.95, vers: 0.85 },
    mplus_aoe: { haste: 1.05, crit: 0.8, mastery: 0.95, vers: 0.9 },
  },

  // Rogue
  rogue_assassination: {
    group: "Rogue",
    label: "Assassination",
    raid_st: { haste: 0.9, crit: 1.0, mastery: 0.9, vers: 0.85 },
    mplus_aoe: { haste: 0.95, crit: 0.95, mastery: 0.95, vers: 0.9 },
  },
  rogue_outlaw: {
    group: "Rogue",
    label: "Outlaw",
    raid_st: { haste: 1.0, crit: 0.9, mastery: 0.75, vers: 0.85 },
    mplus_aoe: { haste: 1.05, crit: 0.85, mastery: 0.7, vers: 0.9 },
  },
  rogue_subtlety: {
    group: "Rogue",
    label: "Subtlety",
    raid_st: { haste: 0.85, crit: 1.0, mastery: 0.95, vers: 0.85 },
    mplus_aoe: { haste: 0.9, crit: 0.95, mastery: 1.0, vers: 0.9 },
  },

  // Shaman
  shaman_elemental: {
    group: "Shaman",
    label: "Elemental",
    raid_st: { haste: 0.9, crit: 0.9, mastery: 1.0, vers: 0.85 },
    mplus_aoe: { haste: 0.95, crit: 0.85, mastery: 1.05, vers: 0.9 },
  },
  shaman_enhancement: {
    group: "Shaman",
    label: "Enhancement",
    raid_st: { haste: 0.95, crit: 0.9, mastery: 0.95, vers: 0.85 },
    mplus_aoe: { haste: 1.0, crit: 0.85, mastery: 1.0, vers: 0.9 },
  },

  // Warlock
  warlock_affliction: {
    group: "Warlock",
    label: "Affliction",
    raid_st: { haste: 1.0, crit: 0.85, mastery: 0.95, vers: 0.85 },
    mplus_aoe: { haste: 1.05, crit: 0.8, mastery: 1.0, vers: 0.9 },
  },
  warlock_demonology: {
    group: "Warlock",
    label: "Demonology",
    raid_st: { haste: 0.9, crit: 0.85, mastery: 1.05, vers: 0.85 },
    mplus_aoe: { haste: 0.95, crit: 0.8, mastery: 1.05, vers: 0.9 },
  },
  warlock_destruction: {
    group: "Warlock",
    label: "Destruction",
    raid_st: { haste: 0.85, crit: 1.0, mastery: 0.95, vers: 0.85 },
    mplus_aoe: { haste: 0.9, crit: 0.95, mastery: 1.0, vers: 0.9 },
  },

  // Warrior
  warrior_arms: {
    group: "Warrior",
    label: "Arms",
    raid_st: { haste: 0.7, crit: 0.95, mastery: 1.05, vers: 0.85 },
    mplus_aoe: { haste: 0.8, crit: 0.9, mastery: 1.0, vers: 0.9 },
  },
  warrior_fury: {
    group: "Warrior",
    label: "Fury",
    raid_st: { haste: 1.05, crit: 0.9, mastery: 0.8, vers: 0.85 },
    mplus_aoe: { haste: 1.1, crit: 0.85, mastery: 0.75, vers: 0.9 },
  },
};
