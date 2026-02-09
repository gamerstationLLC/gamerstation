// scripts/wow/build-wow-static.ts
import fs from "node:fs/promises";
import path from "node:path";

type FullItem = {
  id: number;
  name: any;
  slot?: any;
  ilvl?: any;
};

type ItemIndexRow = {
  id: number;
  name: any;
  slot?: any;
  ilvl?: any;
};

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public", "data", "wow");

const ITEMS_BY_ID_PATH = path.join(OUT_DIR, "items_by_id.json");
const ITEMS_INDEX_PATH = path.join(OUT_DIR, "items_index.json");

async function readJson<T>(p: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(p: string, data: any) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(data, null, 2), "utf-8");
}

function toNumber(x: any): number | null {
  if (x == null) return null;
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

function buildIndex(itemsById: Record<string, FullItem>): ItemIndexRow[] {
  const rows: ItemIndexRow[] = [];

  for (const v of Object.values(itemsById)) {
    if (!v || typeof v.id !== "number") continue;
    rows.push({
      id: v.id,
      name: v.name,
      slot: v.slot,
      ilvl: toNumber(v.ilvl) ?? v.ilvl,
    });
  }

  // Sort by name then id for stable diffs
  rows.sort((a, b) => {
    const an = String(a?.name ?? "").toLowerCase();
    const bn = String(b?.name ?? "").toLowerCase();
    if (an < bn) return -1;
    if (an > bn) return 1;
    return a.id - b.id;
  });

  return rows;
}

async function main() {
  // Canonical: items_by_id.json
  const itemsById = await readJson<Record<string, FullItem>>(ITEMS_BY_ID_PATH, {});
  const itemsIndex = buildIndex(itemsById);

  await writeJson(ITEMS_INDEX_PATH, itemsIndex);

  console.log(`✅ Wrote ${itemsIndex.length.toLocaleString()} rows -> ${path.relative(ROOT, ITEMS_INDEX_PATH)}`);
  console.log(`ℹ️ items_by_id keys: ${Object.keys(itemsById).length.toLocaleString()} -> ${path.relative(ROOT, ITEMS_BY_ID_PATH)}`);
}

main().catch((err) => {
  console.error("❌ wow static build failed:", err);
  process.exit(1);
});
