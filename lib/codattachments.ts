// lib/codAttachments.ts
export type CodAttachmentRow = {
  attachment_id: string;
  attachment_name: string;
  slot: string; // "barrel", "conversion_kit", etc
  applies_to: string; // weapon_id like "ak_27" (or "ALL" if you ever use it)
  dmg10_add: number;
  dmg25_add: number;
  dmg50_add: number;
};

function toNumber(v: string | undefined) {
  const n = Number((v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

// Simple CSV parser that supports quoted commas and escaped quotes ("")
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      // escaped quote
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
      if (ch === "\r" && next === "\n") i++; // handle CRLF

      row.push(cell);
      cell = "";

      // ignore completely empty lines
      const nonEmpty = row.some((c) => (c ?? "").trim() !== "");
      if (nonEmpty) rows.push(row);

      row = [];
      continue;
    }

    cell += ch;
  }

  // last cell
  row.push(cell);
  const nonEmpty = row.some((c) => (c ?? "").trim() !== "");
  if (nonEmpty) rows.push(row);

  return rows;
}

export async function getCodAttachments(): Promise<CodAttachmentRow[]> {
  const url = process.env.COD_ATTACHMENTS_CSV_URL;
  if (!url) return [];

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) return [];

  const csv = await res.text();
  const table = parseCsv(csv);
  if (table.length < 2) return [];

  const header = table[0].map((h) => (h ?? "").trim());
  const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const i_attachment_id = idx("attachment_id");
  const i_attachment_name = idx("attachment_name");
  const i_slot = idx("slot");
  const i_applies_to = idx("applies_to");
  const i_dmg10_add = idx("dmg10_add");
  const i_dmg25_add = idx("dmg25_add");
  const i_dmg50_add = idx("dmg50_add");

  // if required columns are missing, just return empty instead of crashing
  const required = [i_attachment_id, i_attachment_name, i_slot, i_applies_to];
  if (required.some((i) => i < 0)) return [];

  const out: CodAttachmentRow[] = [];

  for (let r = 1; r < table.length; r++) {
    const line = table[r];
    const attachment_id = (line[i_attachment_id] ?? "").trim();
    if (!attachment_id) continue;

    out.push({
      attachment_id,
      attachment_name: (line[i_attachment_name] ?? "").trim(),
      slot: (line[i_slot] ?? "").trim(),
      applies_to: (line[i_applies_to] ?? "").trim(),
      dmg10_add: i_dmg10_add >= 0 ? toNumber(line[i_dmg10_add]) : 0,
      dmg25_add: i_dmg25_add >= 0 ? toNumber(line[i_dmg25_add]) : 0,
      dmg50_add: i_dmg50_add >= 0 ? toNumber(line[i_dmg50_add]) : 0,
    });
  }

  return out;
}
