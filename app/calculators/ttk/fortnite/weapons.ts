// ======================
// CATEGORIES
// ======================
export const CATEGORIES = [
  { value: "assault_rifle", label: "Assault Rifles" },
  { value: "lmg", label: "LMGs" },
  { value: "smg", label: "SMGs" },
  { value: "shotgun", label: "Shotguns" },
  { value: "pistol", label: "Pistols" },
  { value: "sniper_dmr", label: "Sniper / DMR" },
] as const;

export type Category = (typeof CATEGORIES)[number]["value"];

// ======================
// RARITIES
// ======================
export const RARITIES = [
  { value: "common", label: "Common" },
  { value: "uncommon", label: "Uncommon" },
  { value: "rare", label: "Rare" },
  { value: "epic", label: "Epic" },
  { value: "legendary", label: "Legendary" },
  { value: "mythic", label: "Mythic" },
] as const;

export type Rarity = (typeof RARITIES)[number]["value"];

// ======================
// TYPES
// ======================
export type FortniteWeapon = {
  id: string;
  name: string;
  class: Category; // must match CATEGORIES.value
  fireRate: number; // shots/sec
  headshotMultiplier: number;
  damage: Record<Rarity, number>;
};

// ======================
// WEAPONS
// ======================
export const FORTNITE_WEAPONS: FortniteWeapon[] = [
  // ======================
  // ASSAULT RIFLES
  // ======================
  {
    id: "ar_standard",
    name: "Assault Rifle",
    class: "assault_rifle",
    fireRate: 5.5,
    headshotMultiplier: 2.0,
    damage: {
      common: 30,
      uncommon: 31,
      rare: 33,
      epic: 35,
      legendary: 36,
      mythic: 37,
    },
  },
  {
    id: "ar_heavy",
    name: "Heavy Assault Rifle",
    class: "assault_rifle",
    fireRate: 3.75,
    headshotMultiplier: 2.0,
    damage: {
      common: 33,
      uncommon: 35,
      rare: 37,
      epic: 39,
      legendary: 41,
      mythic: 44,
    },
  },
  {
    id: "ar_burst",
    name: "Burst Assault Rifle",
    class: "assault_rifle",
    fireRate: 4.0,
    headshotMultiplier: 2.0,
    damage: {
      common: 27,
      uncommon: 29,
      rare: 30,
      epic: 32,
      legendary: 33,
      mythic: 0,
    },
  },

  // Added ARs you sent
  {
    id: "ar_suppressed",
    name: "Suppressed Assault Rifle",
    class: "assault_rifle",
    fireRate: 5.5,
    headshotMultiplier: 2.0,
    damage: {
      common: 0,
      uncommon: 0,
      rare: 30,
      epic: 32,
      legendary: 33,
      mythic: 0,
    },
  },
  {
    id: "ar_scoped",
    name: "Scoped Assault Rifle",
    class: "assault_rifle",
    fireRate: 4.5,
    headshotMultiplier: 2.0,
    damage: {
      common: 0,
      uncommon: 32,
      rare: 34,
      epic: 36,
      legendary: 37,
      mythic: 0,
    },
  },
  {
    id: "ar_thermal_scoped",
    name: "Thermal Scoped Assault Rifle",
    class: "assault_rifle",
    fireRate: 4.5,
    headshotMultiplier: 2.0,
    damage: {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 36,
      legendary: 37,
      mythic: 0,
    },
  },
  {
    id: "ar_infantry",
    name: "Infantry Rifle",
    class: "assault_rifle",
    fireRate: 4.0,
    headshotMultiplier: 2.0,
    damage: {
      common: 36,
      uncommon: 38,
      rare: 40,
      epic: 42,
      legendary: 44,
      mythic: 0,
    },
  },
  {
    id: "ar_tactical",
    name: "Tactical Assault Rifle",
    class: "assault_rifle",
    fireRate: 7.0,
    headshotMultiplier: 2.0,
    damage: {
      common: 0,
      uncommon: 0,
      rare: 22,
      epic: 23,
      legendary: 24,
      mythic: 0,
    },
    // Note: No damage dropoff to structures (per your list)
  },

  // ======================
  // LMGs
  // ======================
  {
    id: "lmg_standard",
    name: "Light Machine Gun",
    class: "lmg",
    fireRate: 7.0,
    headshotMultiplier: 2.0,
    damage: {
      common: 0,
      uncommon: 0,
      rare: 25,
      epic: 26,
      legendary: 0,
      mythic: 0,
    },
  },
  {
    id: "minigun",
    name: "Minigun",
    class: "lmg",
    fireRate: 12.0,
    headshotMultiplier: 1.5,
    damage: {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 20,
      legendary: 21,
      mythic: 21,
    },
    // Structure damage per bullet (not modeled in this type):
    // Epic 32 | Legendary 33 | Mythic 33
  },
  {
    id: "drum_gun",
    name: "Drum Gun",
    class: "lmg",
    fireRate: 8.0,
    headshotMultiplier: 2.0,
    damage: {
      common: 0,
      uncommon: 22,
      rare: 23,
      epic: 0,
      legendary: 0,
      mythic: 25,
    },
  },

  // ======================
  // SMGs
  // ======================
  {
    id: "smg_standard",
    name: "Submachine Gun",
    class: "smg",
    fireRate: 12.0,
    headshotMultiplier: 2.0,
    damage: {
      common: 17,
      uncommon: 18,
      rare: 19,
      epic: 20,
      legendary: 21,
      mythic: 0,
    },
  },
  {
    id: "smg_suppressed",
    name: "Suppressed Submachine Gun",
    class: "smg",
    fireRate: 12.0,
    headshotMultiplier: 1.75,
    damage: {
      common: 20,
      uncommon: 21,
      rare: 22,
      epic: 0,
      legendary: 0,
      mythic: 0,
    },
  },
  {
    id: "smg_rapid_fire",
    name: "Rapid Fire SMG",
    class: "smg",
    fireRate: 12.0,
    headshotMultiplier: 1.75,
    damage: {
      common: 0,
      uncommon: 14,
      rare: 15,
      epic: 16,
      legendary: 17,
      mythic: 0,
    },
  },
  {
    id: "smg_tactical",
    name: "Tactical Submachine Gun",
    class: "smg",
    fireRate: 12.0,
    headshotMultiplier: 2.0,
    damage: {
      common: 0,
      uncommon: 18,
      rare: 19,
      epic: 20,
      legendary: 21,
      mythic: 0,
    },
    // Note: Structure damage has no damage dropoff (per your list)
  },
  {
    id: "smg_compact",
    name: "Compact SMG",
    class: "smg",
    fireRate: 12.0,
    headshotMultiplier: 2.0,
    damage: {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 20,
      legendary: 21,
      mythic: 0,
    },
  },
  {
    id: "smg_burst",
    name: "Burst SMG",
    class: "smg",
    fireRate: 12.0,
    headshotMultiplier: 1.75,
    damage: {
      common: 24,
      uncommon: 25,
      rare: 26,
      epic: 0,
      legendary: 0,
      mythic: 0,
    },
  },

  // ======================
  // SHOTGUNS
  // ======================
  {
    id: "sg_pump",
    name: "Pump Shotgun",
    class: "shotgun",
    fireRate: 0.7,
    headshotMultiplier: 2.0,
    damage: {
      common: 70,
      uncommon: 80,
      rare: 90,
      epic: 100,
      legendary: 110,
      mythic: 0,
    },
    // Pellet structure damage (not modeled): Common 45 | Uncommon 48 | Rare 50 | Epic 53 | Legendary 55
  },
  {
    id: "sg_tactical",
    name: "Tactical Shotgun",
    class: "shotgun",
    fireRate: 1.3,
    headshotMultiplier: 2.0,
    damage: {
      common: 71,
      uncommon: 75,
      rare: 79,
      epic: 83,
      legendary: 87,
      mythic: 0,
    },
    // Pellet structure damage (not modeled): Common 50 | Uncommon 52.5 | Rare 55 | Epic 75 | Legendary 78
  },
  {
    id: "sg_heavy",
    name: "Heavy Shotgun",
    class: "shotgun",
    fireRate: 1.0,
    headshotMultiplier: 2.5,
    damage: {
      common: 0,
      uncommon: 0,
      rare: 70,
      epic: 74,
      legendary: 77,
      mythic: 0,
    },
    // Pellet structure damage (not modeled): Rare 75 | Epic 79 | Legendary 83
  },
  {
    id: "sg_double_barrel",
    name: "Double Barrel Shotgun",
    class: "shotgun",
    fireRate: 1.2,
    headshotMultiplier: 1.25,
    damage: {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 114,
      legendary: 120,
      mythic: 0,
    },
    // Pellet structure damage (not modeled): Epic 86.5 | Legendary 90
  },
  {
    id: "sg_combat",
    name: "Combat Shotgun",
    class: "shotgun",
    fireRate: 1.7,
    headshotMultiplier: 1.5,
    damage: {
      common: 0,
      uncommon: 0,
      rare: 73,
      epic: 77,
      legendary: 80,
      mythic: 0,
    },
    // Pellet structure damage (not modeled): Rare 43 | Epic 45 | Legendary 48
  },
  {
    id: "sg_drum",
    name: "Drum Shotgun",
    class: "shotgun",
    fireRate: 2.0,
    headshotMultiplier: 1.25,
    damage: {
      common: 45,
      uncommon: 48,
      rare: 50,
      epic: 0,
      legendary: 0,
      mythic: 0,
    },
  },

  // ======================
  // PISTOLS
  // ======================
  {
    id: "pistol_standard",
    name: "Pistol",
    class: "pistol",
    fireRate: 6.75,
    headshotMultiplier: 2.0,
    damage: {
      common: 24,
      uncommon: 25,
      rare: 26,
      epic: 28,
      legendary: 29,
      mythic: 0,
    },
  },
  {
    id: "hand_cannon",
    name: "Hand Cannon",
    class: "pistol",
    fireRate: 1.8,
    headshotMultiplier: 2.0,
    damage: {
      common: 0,
      uncommon: 0,
      rare: 71,
      epic: 75,
      legendary: 78,
      mythic: 0,
    },
  },

  // ======================
  // SNIPER / DMR
  // ======================
  {
    id: "sniper_heavy",
    name: "Heavy Sniper Rifle",
    class: "sniper_dmr",
    fireRate: 0.33,
    headshotMultiplier: 2.5,
    damage: {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 150,
      legendary: 157,
      mythic: 0,
    },
  },
  {
    id: "sniper_bolt",
    name: "Bolt-Action Sniper Rifle",
    class: "sniper_dmr",
    fireRate: 0.6,
    headshotMultiplier: 2.5,
    damage: {
      common: 95,
      uncommon: 100,
      rare: 105,
      epic: 110,
      legendary: 116,
      mythic: 0,
    },
  },
];
