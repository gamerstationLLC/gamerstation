// lib/codweapons.ts

export type CodWeaponRow = {
  weapon_name: string;
  weapon_type: string;
  rpm?: number;
  headshot_mult?: number;
  fire_mode?: string;
  damage_profile?: { meters: number; damage: number }[];
};

function toNum(v: string): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function csvToRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];

    if (ch === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && csv[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  row.push(cur);
  rows.push(row);

  // Remove any fully empty trailing rows
  return rows.filter((r) => r.some((c) => String(c ?? "").trim().length > 0));
}

type DamagePoint = { meters: number; damage: number };

function parseDamageProfile(headers: string[], row: string[]) {
  const points: DamagePoint[] = [];

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].trim().toLowerCase();
    const m = h.match(/^dmg_(\d+)$/); // dmg_10, dmg_25, dmg_50
    if (!m) continue;

    const meters = Number(m[1]);
    const dmg = toNum(String(row[i] ?? "").trim());
    if (dmg !== undefined && Number.isFinite(meters)) {
      points.push({ meters, damage: dmg });
    }
  }

  points.sort((a, b) => a.meters - b.meters);
  return points;
}

export async function getCodWeapons(): Promise<CodWeaponRow[]> {
  const url = process.env.COD_WEAPONS_CSV_URL;
  if (!url) throw new Error("Missing COD_WEAPONS_CSV_URL");

  // Instant updates while you edit the sheet
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch CSV (${res.status})`);

  const csv = await res.text();
  const table = csvToRows(csv);
  if (table.length < 2) return [];

  const headers = table[0].map((h) => h.trim());

  const idx = (name: string) => {
    const i = headers.indexOf(name);
    if (i === -1) return -1;
    return i;
  };

  const get = (r: string[], name: string) => {
    const i = idx(name);
    if (i === -1) return "";
    return String(r[i] ?? "").trim();
  };

  return table
    .slice(1)
    .map((r) => ({
      weapon_name: get(r, "weapon_name"),
      weapon_type: get(r, "weapon_type"),
      rpm: toNum(get(r, "rpm")),
      headshot_mult: toNum(get(r, "headshot_mult")),
      fire_mode: get(r, "fire_mode") || undefined,
      damage_profile: parseDamageProfile(headers, r),
    }))
    .filter((w) => w.weapon_name.length > 0);
}
