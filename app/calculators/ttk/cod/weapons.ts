// app/calculators/ttk/cod/weapons.ts

export type WeaponClass = "ar" | "smg" | "lmg";

export type CodWeapon = {
  id: string;
  name: string;
  class: WeaponClass;

  /**
   * Base fire rate in rounds per minute.
   * NOTE: Replace these placeholders with verified BO7 values.
   */
  rpm: number;

  /**
   * Base body damage per bullet (no attachments).
   * NOTE: Replace these placeholders with verified BO7 values.
   */
  damage: number;

  /**
   * Optional: label for where you got/verified the numbers.
   */
  source?: string;

  /**
   * Optional: mark as “meta / popular” so it can show first.
   */
  meta?: boolean;
};

export const COD_CLASSES: { value: WeaponClass; label: string }[] = [
  { value: "ar", label: "Assault Rifles" },
  { value: "smg", label: "SMGs" },
  { value: "lmg", label: "LMGs" },
];

/**
 * STARTER LIST (Meta/Popular)
 * These are *names + placeholder stats* so the app works now.
 * Swap rpm/damage as you verify BO7 numbers.
 */
export const BO7_WEAPONS: CodWeapon[] = [
  // AR
  { id: "m15-mod0", name: "M15 MOD 0", class: "ar", rpm: 720, damage: 32, meta: true },
  { id: "ak-27", name: "AK-27", class: "ar", rpm: 650, damage: 35, meta: true },
  { id: "warden-308", name: "Warden 308", class: "ar", rpm: 520, damage: 42, meta: true },

  // SMG
  { id: "dravec-45", name: "Dravec 45", class: "smg", rpm: 900, damage: 27, meta: true },
  { id: "rk-9", name: "RK-9", class: "smg", rpm: 950, damage: 26, meta: true },

  // LMG
  { id: "xr-3-ion", name: "XR-3 ION", class: "lmg", rpm: 700, damage: 30, meta: true },

  // Add more (examples / placeholders)
  { id: "ar-1", name: "AR-Alpha (placeholder)", class: "ar", rpm: 780, damage: 30 },
  { id: "smg-1", name: "SMG-Vector (placeholder)", class: "smg", rpm: 980, damage: 24 },
  { id: "lmg-1", name: "LMG-Titan (placeholder)", class: "lmg", rpm: 620, damage: 33 },
];

export function getWeaponsByClass(cls: WeaponClass) {
  const list = BO7_WEAPONS.filter((w) => w.class === cls);
  // show meta first, then alphabetical
  return list.sort((a, b) => {
    const am = a.meta ? 1 : 0;
    const bm = b.meta ? 1 : 0;
    if (am !== bm) return bm - am;
    return a.name.localeCompare(b.name);
  });
}
