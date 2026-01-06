// lib/codweapons.ts

export type CodWeaponRow = {
  weapon_id: string;
  weapon_name: string;
  weapon_type: string;
  rpm?: number;
  headshot_mult?: number;
  fire_mode?: string;

  // ✅ ship the only values you actually use
  dmg10?: number;
  dmg25?: number;
  dmg50?: number;
};

function toNumU(v: string): number | undefined {
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
      if (row.some((c) => String(c ?? "").trim().length > 0)) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  row.push(cur);
  if (row.some((c) => String(c ?? "").trim().length > 0)) rows.push(row);

  return rows;
}

export async function getCodWeapons(): Promise<CodWeaponRow[]> {
  const url = process.env.COD_WEAPONS_CSV_URL;
  if (!url) throw new Error("Missing COD_WEAPONS_CSV_URL");

  // ✅ stop no-store; cache on the server
  // Revalidate hourly (change if you update sheets more often)
  const res = await fetch(url, {
    next: { revalidate: 60 * 60 },
  });

  if (!res.ok) throw new Error(`Failed to fetch CSV (${res.status})`);

  const csv = await res.text();
  const table = csvToRows(csv);
  if (table.length < 2) return [];

  const headers = table[0].map((h) => h.trim().toLowerCase());

  // ✅ index map (faster than repeated headers.indexOf)
  const index: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) index[headers[i]] = i;

  const get = (r: string[], key: string) => String(r[index[key]] ?? "").trim();

  return table
    .slice(1)
    .map((r) => {
      const weapon_id = get(r, "weapon_id");
      const weapon_name = get(r, "weapon_name");
      if (!weapon_id || !weapon_name) return null;

      return {
        weapon_id,
        weapon_name,
        weapon_type: get(r, "weapon_type"),
        rpm: toNumU(get(r, "rpm")),
        headshot_mult: toNumU(get(r, "headshot_mult")),
        fire_mode: get(r, "fire_mode") || undefined,

        // ✅ pull these directly (assuming your CSV has dmg_10,dmg_25,dmg_50 columns)
        dmg10: toNumU(get(r, "dmg_10")),
        dmg25: toNumU(get(r, "dmg_25")),
        dmg50: toNumU(get(r, "dmg_50")),
      } satisfies CodWeaponRow;
    })
    .filter(Boolean) as CodWeaponRow[];
}
