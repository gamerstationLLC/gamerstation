// lib/codattachments.ts
export type CodAttachmentRow = {
  attachment_id: string;
  attachment_name: string;
  slot: string;
  applies_to: string;
  dmg10_add: number;
  dmg25_add: number;
  dmg50_add: number;
};

function toNumber(v: string | undefined) {
  const n = Number((v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

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
      if (row.some(c => c.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    cell += ch;
  }

  row.push(cell);
  if (row.some(c => c.trim() !== "")) rows.push(row);
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

  const header = table[0].map(h => h.trim().toLowerCase());
  const idx = (n: string) => header.indexOf(n);

  return table.slice(1).map(line => ({
    attachment_id: line[idx("attachment_id")]?.trim() ?? "",
    attachment_name: line[idx("attachment_name")]?.trim() ?? "",
    slot: line[idx("slot")]?.trim().toLowerCase() ?? "",
    applies_to: line[idx("applies_to")]?.trim().toLowerCase() ?? "",
    dmg10_add: toNumber(line[idx("dmg10_add")]),
    dmg25_add: toNumber(line[idx("dmg25_add")]),
    dmg50_add: toNumber(line[idx("dmg50_add")]),
  }));
}
