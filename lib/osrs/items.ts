export const OSRS_SLOTS = [
  { key: "head", label: "Head" },
  { key: "body", label: "Body" },
  { key: "legs", label: "Legs" },
  { key: "feet", label: "Feet" },
  { key: "neck", label: "Neck" },
  { key: "cape", label: "Cape" },
  { key: "hands", label: "Hands" },
  { key: "ring", label: "Ring" },
  { key: "weapon", label: "Weapon" },
  { key: "ammo", label: "Ammo" },
  { key: "shield", label: "Shield" },
] as const;

export type OsrsSlot = (typeof OSRS_SLOTS)[number]["key"];

export type OsrsItemRow = {
  id: number;
  name: string;
  slot: OsrsSlot;
  attackBonus?: number;
  strengthBonus?: number;
  rangedStrength?: number;
  magicDamagePct?: number;
  speedTicks?: number;
  members?: boolean;
  tradeable?: boolean;
};
