// lib/codattachments.ts

export type CodAttachmentRow = {
  attachment_id: string;
  attachment_name: string;
  slot: string; // "barrel", etc (lowercase)
  applies_to: string; // lowercased
  dmg10_add: number;
  dmg25_add: number;
  dmg50_add: number;
};

function toNumber(v: string | undefined) {
  const n = Number((v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

// Your CSV parser is fine for this size; keep it.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    cell += ch;
  }

  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export async function getCodAttachments(): Promise<CodAttachmentRow[]> {
  const url = process.env.COD_ATTACHMENTS_CSV_URL;
  if (!url) return [];

  // ✅ IMPORTANT: stop no-store (that makes it feel sluggish)
  // Revalidate hourly (tweak as you like)
  const res = await fetch(url, {
    next: { revalidate: 60 * 60 },
  });

  if (!res.ok) return [];

  const csv = await res.text();
  const table = parseCsv(csv);
  if (table.length < 2) return [];

  const header = table[0].map((h) => h.trim().toLowerCase());
  const index: Record<string, number> = {};
  for (let i = 0; i < header.length; i++) index[header[i]] = i;

  const get = (line: string[], key: string) => line[index[key]] ?? "";

  const out: CodAttachmentRow[] = [];

  for (const line of table.slice(1)) {
    const slot = get(line, "slot").trim().toLowerCase();
    if (!slot) continue;

    // ✅ Filter here so the client never sees non-barrels
    if (slot !== "barrel") continue;

    const attachment_id = get(line, "attachment_id").trim();
    if (!attachment_id) continue;

    out.push({
      attachment_id,
      attachment_name: get(line, "attachment_name").trim(),
      slot,
      applies_to: get(line, "applies_to").trim().toLowerCase(),
      dmg10_add: toNumber(get(line, "dmg10_add")),
      dmg25_add: toNumber(get(line, "dmg25_add")),
      dmg50_add: toNumber(get(line, "dmg50_add")),
    });
  }

  return out;
}
