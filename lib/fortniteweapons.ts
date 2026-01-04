// lib/fortniteweapons.ts
import fs from "node:fs";
import path from "node:path";

export type FortniteWeaponRow = {
  weapon_id: string;
  name: string;
  rarity?: string;
  category?: string;
  damage?: number;
  fire_rate?: number;
  mag_size?: number;
  reload_time?: number;
  headshot_multiplier?: number;
};

function toNum(v: string | undefined) {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function parseCsvLine(line: string): string[] {
  // Simple CSV parser that supports quoted fields
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // handle escaped quote ""
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out.map((s) => s.trim());
}

export function readFortniteWeaponsCsv(): FortniteWeaponRow[] {
  // If you keep it at project root instead, change this to path.join(process.cwd(), "fortnite_ttk_weapons.csv")
  const filePath = path.join(process.cwd(), "data", "fortnite_ttk_weapons.csv");

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());

  const idx = (key: string) => headers.indexOf(key);

  const i_weapon_id = idx("weapon_id");
  const i_name = idx("name");
  const i_rarity = idx("rarity");
  const i_category = idx("category");
  const i_damage = idx("damage");
  const i_fire_rate = idx("fire_rate");
  const i_mag_size = idx("mag_size");
  const i_reload_time = idx("reload_time");
  const i_hs = idx("headshot_multiplier");

  const rows: FortniteWeaponRow[] = [];

  for (let li = 1; li < lines.length; li++) {
    const cols = parseCsvLine(lines[li]);

    const weapon_id = i_weapon_id >= 0 ? cols[i_weapon_id] : "";
    const name = i_name >= 0 ? cols[i_name] : "";

    if (!weapon_id || !name) continue;

    rows.push({
      weapon_id,
      name,
      rarity: i_rarity >= 0 ? cols[i_rarity] : undefined,
      category: i_category >= 0 ? cols[i_category] : undefined,
      damage: i_damage >= 0 ? toNum(cols[i_damage]) : undefined,
      fire_rate: i_fire_rate >= 0 ? toNum(cols[i_fire_rate]) : undefined,
      mag_size: i_mag_size >= 0 ? toNum(cols[i_mag_size]) : undefined,
      reload_time: i_reload_time >= 0 ? toNum(cols[i_reload_time]) : undefined,
      headshot_multiplier: i_hs >= 0 ? toNum(cols[i_hs]) : undefined,
    });
  }

  return rows;
}
