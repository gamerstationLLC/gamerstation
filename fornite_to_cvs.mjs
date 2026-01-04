import fs from "node:fs";

const API_KEY = process.env.FORTNITEAPI_IO_KEY;
if (!API_KEY) {
  console.error("Missing env var FORTNITEAPI_IO_KEY");
  process.exit(1);
}

// FortniteAPI.io loot list endpoint (basic stats)
// https://fortniteapi.io/v1/loot/list?lang=en :contentReference[oaicite:2]{index=2}
const LIST_URL = "https://fortniteapi.io/v1/loot/list?lang=en";

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function pick(obj, paths) {
  for (const p of paths) {
    const parts = p.split(".");
    let cur = obj;
    let ok = true;
    for (const k of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, k)) cur = cur[k];
      else {
        ok = false;
        break;
      }
    }
    if (ok && cur != null) return cur;
  }
  return "";
}

async function main() {
  const res = await fetch(LIST_URL, {
    headers: { Authorization: API_KEY },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Loot list failed ${res.status}: ${txt}`);
  }

  const json = await res.json();

  // FortniteAPI.io uses "weapons" sometimes, and historically "loot" / "items"
  const items = json.weapons || json.loot || json.items || json.data || [];
  if (!Array.isArray(items) || items.length === 0) {
    console.error("No items found in response keys:", Object.keys(json));
    process.exit(1);
  }

  // Minimal extraction: DO NOT store raw JSON blobs.
  const rows = [];
  rows.push([
    "weapon_id",
    "name",
    "rarity",
    "category",
    "damage",
    "fire_rate",
    "mag_size",
    "reload_time",
    "headshot_multiplier",
  ]);

  for (const it of items) {
    // These field paths cover common shapes; we’ll adapt once you run it and show me 1 sample.
    const weapon_id = pick(it, ["id", "itemId", "weaponId", "gameplayId"]);
    const name = pick(it, ["name", "displayName"]);
    const rarity = pick(it, ["rarity.name", "rarity", "tier"]);
    const category = pick(it, ["type.name", "type", "category", "weaponType"]);

    const damage = pick(it, ["stats.damage", "weapon.stats.damage", "damage"]);
    const fire_rate = pick(it, ["stats.fireRate", "weapon.stats.fireRate", "fireRate", "rateOfFire"]);
    const mag_size = pick(it, ["stats.magSize", "weapon.stats.magSize", "magSize", "clipSize"]);
    const reload_time = pick(it, ["stats.reloadTime", "weapon.stats.reloadTime", "reloadTime"]);
    const headshot_multiplier = pick(it, ["stats.headshotMultiplier", "weapon.stats.headshotMultiplier", "headshotMultiplier"]);

    // Skip non-weapons if the list includes lots of loot
    const catLower = String(category).toLowerCase();
    const nameLower = String(name).toLowerCase();
    const looksWeapon =
      catLower.includes("weapon") ||
      catLower.includes("rifle") ||
      catLower.includes("shotgun") ||
      catLower.includes("smg") ||
      catLower.includes("pistol") ||
      catLower.includes("sniper") ||
      nameLower.includes("rifle") ||
      nameLower.includes("shotgun") ||
      nameLower.includes("smg") ||
      nameLower.includes("pistol") ||
      nameLower.includes("sniper");

    if (!looksWeapon) continue;

    rows.push([
      weapon_id,
      name,
      rarity,
      category,
      damage,
      fire_rate,
      mag_size,
      reload_time,
      headshot_multiplier,
    ]);
  }

  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/fortnite_weapons.csv", csv, "utf8");

  console.log(`Wrote ${rows.length - 1} weapons to data/fortnite_weapons.csv`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
