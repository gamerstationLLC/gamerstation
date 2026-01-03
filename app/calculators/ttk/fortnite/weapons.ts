export const CATEGORIES = [
  { value: "assault_rifle", label: "Assault Rifles" },
  { value: "smg", label: "SMGs" },
  { value: "shotgun", label: "Shotguns" },
  { value: "sniper_dmr", label: "Sniper / DMR" },
] as const;

export type Category = (typeof CATEGORIES)[number]["value"];

export const RARITIES = [
  { value: "common", label: "Common" },
  { value: "uncommon", label: "Uncommon" },
  { value: "rare", label: "Rare" },
  { value: "epic", label: "Epic" },
  { value: "legendary", label: "Legendary" },
  { value: "mythic", label: "Mythic" },
] as const;

export type Rarity = (typeof RARITIES)[number]["value"];

export type FortniteWeapon = {
  id: string;
  name: string;
  class: Category; // must match CATEGORIES.value
  fireRate: number; // shots/sec
  headshotMultiplier: number;
  damage: Record<Rarity, number>; // ✅ damage per rarity
};

// NOTE: Damage values are baseline placeholders; structure is what matters.
// You can tune these later as you get more accurate data.
export const FORTNITE_WEAPONS: FortniteWeapon[] = [
  // ======================
  // ASSAULT RIFLES (3)
  // ======================
  {
    id: "ar_standard",
    name: "Assault Rifle (Standard)",
    class: "assault_rifle",
    fireRate: 5.5,
    headshotMultiplier: 1.65,
    damage: {
      common: 30,
      uncommon: 31,
      rare: 32,
      epic: 33,
      legendary: 34,
      mythic: 35,
    },
  },
  {
    id: "ar_redeye",
    name: "Red-Eye Assault Rifle",
    class: "assault_rifle",
    fireRate: 4.0,
    headshotMultiplier: 1.75,
    damage: {
      common: 34,
      uncommon: 35,
      rare: 36,
      epic: 37,
      legendary: 38,
      mythic: 39,
    },
  },
  {
    id: "ar_twinmag",
    name: "Twin Mag AR",
    class: "assault_rifle",
    fireRate: 5.6,
    headshotMultiplier: 1.65,
    damage: {
      common: 31,
      uncommon: 32,
      rare: 33,
      epic: 34,
      legendary: 35,
      mythic: 36,
    },
  },

  // ======================
  // SMGs (3)
  // ======================
  {
    id: "smg_thunder",
    name: "Thunder SMG",
    class: "smg",
    fireRate: 12.0,
    headshotMultiplier: 1.5,
    damage: {
      common: 18,
      uncommon: 19,
      rare: 20,
      epic: 21,
      legendary: 22,
      mythic: 23,
    },
  },
  {
    id: "smg_stinger",
    name: "Stinger SMG",
    class: "smg",
    fireRate: 13.0,
    headshotMultiplier: 1.5,
    damage: {
      common: 17,
      uncommon: 18,
      rare: 19,
      epic: 20,
      legendary: 21,
      mythic: 22,
    },
  },
  {
    id: "smg_suppressed",
    name: "Suppressed SMG",
    class: "smg",
    fireRate: 10.0,
    headshotMultiplier: 1.5,
    damage: {
      common: 18,
      uncommon: 19,
      rare: 20,
      epic: 21,
      legendary: 22,
      mythic: 23,
    },
  },

  // ======================
  // SHOTGUNS (3)
  // ======================
  {
    id: "sg_pump",
    name: "Pump Shotgun",
    class: "shotgun",
    fireRate: 0.9,
    headshotMultiplier: 1.75,
    damage: {
      common: 85,
      uncommon: 90,
      rare: 95,
      epic: 100,
      legendary: 105,
      mythic: 110,
    },
  },
  {
    id: "sg_tactical",
    name: "Tactical Shotgun",
    class: "shotgun",
    fireRate: 1.3,
    headshotMultiplier: 1.5,
    damage: {
      common: 65,
      uncommon: 68,
      rare: 71,
      epic: 74,
      legendary: 77,
      mythic: 80,
    },
  },
  {
    id: "sg_auto",
    name: "Auto Shotgun",
    class: "shotgun",
    fireRate: 1.15,
    headshotMultiplier: 1.6,
    damage: {
      common: 70,
      uncommon: 73,
      rare: 76,
      epic: 79,
      legendary: 82,
      mythic: 85,
    },
  },

  // ======================
  // SNIPER / DMR (3)
  // ======================
  {
    id: "snp_heavy",
    name: "Heavy Sniper",
    class: "sniper_dmr",
    fireRate: 0.6,
    headshotMultiplier: 2.5,
    damage: {
      common: 120,
      uncommon: 125,
      rare: 130,
      epic: 135,
      legendary: 140,
      mythic: 145,
    },
  },
  {
    id: "dmr_cobra",
    name: "Cobra DMR",
    class: "sniper_dmr",
    fireRate: 3.5,
    headshotMultiplier: 1.75,
    damage: {
      common: 37,
      uncommon: 39,
      rare: 41,
      epic: 43,
      legendary: 45,
      mythic: 47,
    },
  },
  {
    id: "dmr_hunt",
    name: "Hunting Rifle (DMR style)",
    class: "sniper_dmr",
    fireRate: 1.2,
    headshotMultiplier: 2.25,
    damage: {
      common: 78,
      uncommon: 82,
      rare: 86,
      epic: 90,
      legendary: 94,
      mythic: 98,
    },
  },
];
