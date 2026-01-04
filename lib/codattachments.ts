// lib/codattachments.ts
import { readFile } from "fs/promises";
import path from "path";

export type CodAttachmentRow = {
  attachment_id: string;
  attachment_name: string;
  slot: string; // "barrel", "conversion_kit", etc
  applies_to: string; // weapon_id like "ak_27" (or "ALL")
  dmg10_add: number;
  dmg25_add: number;
  dmg50_add: number;
};

function toNumber(v: string | undefined) {
  const n = Number((v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

// CSV parser (handles quotes + commas)
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
      if (ch === "\r" && next === "\n") i++; // CRLF
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
  // MUST match your repo tree exactly
  const csvPath = path.join(process.cwd(), "attachments_global.csv");

  let csv: string;
  try {
    csv = await readFile(csvPath, "utf8");
  } catch (err) {
    console.error("[COD ATTACHMENTS] Failed to read CSV:", csvPath);
    return [];
  }

  const table = parseCsv(csv);
  if (table.length < 2) return [];

  const header = table[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name.toLowerCase());

  const i_attachment_id = idx("attachment_id");
  const i_attachment_name = idx("attachment_name");
  const i_slot = idx("slot");
  const i_applies_to = idx("applies_to");
  const i_dmg10_add = idx("dmg10_add");
  const i_dmg25_add = idx("dmg25_add");
  const i_dmg50_add = idx("dmg50_add");

  if ([i_attachment_id, i_attachment_name, i_slot, i_applies_to].some((i) => i < 0)) {
    console.error("[COD ATTACHMENTS] Missing required columns:", header);
    return [];
  }

  return table.slice(1).map((line) => ({
    attachment_id: (line[i_attachment_id] ?? "").trim(),
    attachment_name: (line[i_attachment_name] ?? "").trim(),
    slot: (line[i_slot] ?? "").trim().toLowerCase(),        // 🔑 normalize
    applies_to: (line[i_applies_to] ?? "").trim().toLowerCase(), // 🔑 normalize
    dmg10_add: i_dmg10_add >= 0 ? toNumber(line[i_dmg10_add]) : 0,
    dmg25_add: i_dmg25_add >= 0 ? toNumber(line[i_dmg25_add]) : 0,
    dmg50_add: i_dmg50_add >= 0 ? toNumber(line[i_dmg50_add]) : 0,
  }));
}
