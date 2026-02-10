// scripts/wow/build-item-db.ts
// Builds a searchable WoW item DB for the site from an existing local source JSON.
// Output:
//  - public/data/wow/items/index.json
//  - public/data/wow/items/packs/items.pack.000.json (and more)
//
// "Current Content Mode A" defaults:
//  - Only equippable
//  - Only Armor + Weapon item classes
//  - Only equip inventory types (no NON_EQUIP)
//  - required_level >= 70 OR item_level >= 400 (configurable)

import fs from "node:fs/promises";
import path from "node:path";

type ItemIndexRow = {
  id: number;
  name: string;
  nameNorm: string;
  tokens: string[];
  quality?: string;
  itemClass?: string;
  itemSubclass?: string;
  inventoryType?: string;
  inventoryTypeKey?: string; // "HEAD", "TRINKET", etc
  isEquippable: boolean;
  itemLevel?: number;
  requiredLevel?: number;
  pack: number;
};

type IndexFile = {
  builtAt: string;
  mode: string;
  minRequiredLevel: number;
  minItemLevel: number;
  packSize: number;
  total: number;
  packs: number;
  maxIlvl: number;
  minKeepIlvl: number;
  items: ItemIndexRow[];
};

type PackedItem = { id: number; detail: any };

const ROOT = process.cwd();

function envNum(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(String(raw).trim());
  return Number.isFinite(n) ? n : fallback;
}

function envStr(name: string, fallback = "") {
  const raw = process.env[name];
  return raw ? String(raw).trim() : fallback;
}

function toPosix(p: string) {
  return p.split(path.sep).join("/");
}

async function readJson<T>(absPath: string): Promise<T | null> {
  try {
    const buf = await fs.readFile(absPath, "utf8");
    return JSON.parse(buf) as T;
  } catch {
    return null;
  }
}

async function ensureDir(absDir: string) {
  await fs.mkdir(absDir, { recursive: true });
}

function normalizeName(name: string) {
  return (name || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(nameNorm: string) {
  if (!nameNorm) return [];
  return nameNorm.split(/\s+/g).map((t) => t.trim()).filter(Boolean);
}

// Map Blizzard inventory_type.type to your UI slot keys.
function invKeyFromInventoryType(type: string | undefined | null): string | undefined {
  const t = String(type || "").toUpperCase();

  // direct keys you already use in client
  const direct = new Set([
    "HEAD",
    "NECK",
    "SHOULDER",
    "CHEST",
    "ROBE",
    "WAIST",
    "LEGS",
    "FEET",
    "WRIST",
    "HANDS",
    "FINGER",
    "TRINKET",
    "CLOAK",
    "BACK",

    "MAIN_HAND",
    "OFF_HAND",
    "ONE_HAND",
    "TWO_HAND",

    "WEAPONMAINHAND",
    "WEAPONOFFHAND",

    "HOLDABLE",
    "SHIELD",
    "RANGED",
    "RANGEDRIGHT",
    "RELIC",
  ]);

  if (direct.has(t)) return t;

  // common aliases
  if (t === "BODY") return "CHEST";
  if (t === "TABARD") return undefined;
  if (t === "NON_EQUIP") return undefined;

  return t || undefined;
}

function isArmorOrWeapon(detail: any) {
  // Blizzard item_class id: Weapon = 2, Armor = 4 (classic schema)
  const id = Number(detail?.item_class?.id);
  if (id === 2 || id === 4) return true;

  // fallback by name
  const name = String(detail?.item_class?.name || "").toLowerCase();
  if (name.includes("weapon") || name.includes("armor")) return true;

  return false;
}

function getItemLevel(detail: any): number {
  // Prefer preview_item.level.value then top-level level
  const v =
    Number(detail?.preview_item?.level?.value) ||
    Number(detail?.level) ||
    Number(detail?.item_level) ||
    0;
  return Number.isFinite(v) ? v : 0;
}

function getRequiredLevel(detail: any): number {
  const v =
    Number(detail?.preview_item?.requirements?.level?.value) ||
    Number(detail?.required_level) ||
    0;
  return Number.isFinite(v) ? v : 0;
}

function isEquippable(detail: any): boolean {
  const v = detail?.is_equippable;
  if (typeof v === "boolean") return v;
  // fallback: has a meaningful inventory_type and armor/weapon class
  const inv = String(detail?.inventory_type?.type || "");
  if (!inv || inv.toUpperCase() === "NON_EQUIP") return false;
  return isArmorOrWeapon(detail);
}

function shouldKeepItem(detail: any, minReqLevel: number, minIlvl: number) {
  if (!detail) return false;
  if (!isEquippable(detail)) return false;
  if (!isArmorOrWeapon(detail)) return false;

  const invType = String(detail?.inventory_type?.type || "").toUpperCase();
  const invKey = invKeyFromInventoryType(invType);
  if (!invKey) return false;

  const req = getRequiredLevel(detail);
  const ilvl = getItemLevel(detail);

  // Current Content Mode A: keep if either threshold satisfied.
  if (req >= minReqLevel) return true;
  if (ilvl >= minIlvl) return true;

  return false;
}

function qualityName(detail: any) {
  return (
    String(detail?.preview_item?.quality?.name || "") ||
    String(detail?.quality?.name || "") ||
    undefined
  );
}

function itemClassName(detail: any) {
  return String(detail?.item_class?.name || "") || undefined;
}

function itemSubclassName(detail: any) {
  return String(detail?.item_subclass?.name || "") || undefined;
}

function inventoryTypeName(detail: any) {
  return String(detail?.inventory_type?.name || "") || undefined;
}

async function main() {
  const MODE = envStr("WOW_MODE", "current_a");
  const MIN_REQUIRED_LEVEL = envNum("WOW_MIN_REQUIRED_LEVEL", 70);
  const MIN_ILVL = envNum("WOW_MIN_ILVL", 400);
  const PACK_SIZE = envNum("WOW_PACK_SIZE", 2000);

  const outDir = path.join(ROOT, "public", "data", "wow", "items");
  const packsDir = path.join(outDir, "packs");
  await ensureDir(outDir);
  await ensureDir(packsDir);

  // Input sources (already present in your repo from other scripts)
  const srcByIdPath = path.join(ROOT, "public", "data", "wow", "items_by_id.json");
  const srcIndexPath = path.join(ROOT, "public", "data", "wow", "items_index.json");

  const byId = await readJson<Record<string, any>>(srcByIdPath);
  const idxArr = await readJson<any[]>(srcIndexPath);

  let details: Array<{ id: number; detail: any }> = [];

  if (byId && typeof byId === "object") {
    for (const [k, v] of Object.entries(byId)) {
      const id = Number(k);
      if (!Number.isFinite(id)) continue;
      details.push({ id, detail: v });
    }
  } else if (Array.isArray(idxArr)) {
    // tolerate either {id, detail} or raw detail with id
    for (const it of idxArr) {
      const id = Number(it?.id ?? it?.detail?.id);
      const detail = it?.detail ?? it;
      if (!Number.isFinite(id) || !detail) continue;
      details.push({ id, detail });
    }
  } else {
    throw new Error(
      `No source found. Expected either:\n` +
        ` - public/data/wow/items_by_id.json\n` +
        ` - public/data/wow/items_index.json\n` +
        `Run your Blizzard crawl/build script first (the one that produces items_by_id.json).`
    );
  }

  // Filter
  const kept: Array<{ id: number; detail: any }> = [];
  let maxIlvl = 0;
  let minKeepIlvl = Number.POSITIVE_INFINITY;

  for (const it of details) {
    if (!shouldKeepItem(it.detail, MIN_REQUIRED_LEVEL, MIN_ILVL)) continue;

    const ilvl = getItemLevel(it.detail);
    if (ilvl > maxIlvl) maxIlvl = ilvl;
    if (ilvl > 0 && ilvl < minKeepIlvl) minKeepIlvl = ilvl;

    kept.push(it);
  }

  // Sort by ilvl desc then name
  kept.sort((a, b) => {
    const ia = getItemLevel(a.detail);
    const ib = getItemLevel(b.detail);
    if (ib !== ia) return ib - ia;
    const na = String(a.detail?.name || "");
    const nb = String(b.detail?.name || "");
    return na.localeCompare(nb);
  });

  // Pack + index rows
  const packs: PackedItem[][] = [];
  const items: ItemIndexRow[] = [];

  for (let i = 0; i < kept.length; i += PACK_SIZE) {
    packs.push(kept.slice(i, i + PACK_SIZE).map((x) => ({ id: x.id, detail: x.detail })));
  }

  // Write packs
  for (let p = 0; p < packs.length; p++) {
    const packNo = String(p).padStart(3, "0");
    const packRel = `public/data/wow/items/packs/items.pack.${packNo}.json`;
    const packAbs = path.join(ROOT, ...packRel.split("/"));
    const content = JSON.stringify(packs[p], null, 2);
    await fs.writeFile(packAbs, content, "utf8");
  }

  // Build index rows with correct pack number
  for (let p = 0; p < packs.length; p++) {
    for (const row of packs[p]) {
      const d = row.detail;
      const name = String(d?.name || "").trim();
      if (!name) continue;

      const nameNorm = normalizeName(name);
      const tokens = tokenize(nameNorm);

      const invTypeKey = invKeyFromInventoryType(d?.inventory_type?.type);
      const requiredLevel = getRequiredLevel(d);
      const itemLevel = getItemLevel(d);

      items.push({
        id: row.id,
        name,
        nameNorm,
        tokens,
        quality: qualityName(d),
        itemClass: itemClassName(d),
        itemSubclass: itemSubclassName(d),
        inventoryType: inventoryTypeName(d),
        inventoryTypeKey: invTypeKey,
        isEquippable: true,
        itemLevel: itemLevel || undefined,
        requiredLevel: requiredLevel || undefined,
        pack: p,
      });
    }
  }

  const index: IndexFile = {
    builtAt: new Date().toISOString(),
    mode: MODE,
    minRequiredLevel: MIN_REQUIRED_LEVEL,
    minItemLevel: MIN_ILVL,
    packSize: PACK_SIZE,
    total: items.length,
    packs: packs.length,
    maxIlvl: maxIlvl || 0,
    minKeepIlvl: Number.isFinite(minKeepIlvl) ? minKeepIlvl : 0,
    items,
  };

  const indexAbs = path.join(outDir, "index.json");
  await fs.writeFile(indexAbs, JSON.stringify(index, null, 2), "utf8");

  console.log(`[wow] build-item-db done`);
  console.log(` - kept items: ${items.length}`);
  console.log(` - packs: ${packs.length}`);
  console.log(` - wrote: ${toPosix(path.relative(ROOT, indexAbs))}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
