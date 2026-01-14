/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const WIKI_API = "https://blox-fruits.fandom.com/api.php";

const CATEGORY_MAP = [
  { category: "Accessories", type: "accessory" },
  { category: "Swords", type: "sword" },
  { category: "Guns", type: "gun" },
  { category: "Blox_Fruits", type: "fruit" },
  { category: "Materials", type: "material" },
];

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function api(params) {
  const url = new URL(WIKI_API);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "GamerStation/1.0 (items builder)" },
  });
  if (!res.ok) throw new Error(`Wiki API error ${res.status}: ${url}`);
  return res.json();
}

async function getCategoryMembers(category) {
  const titles = [];
  let cmcontinue;

  while (true) {
    const data = await api({
      action: "query",
      format: "json",
      formatversion: "2",
      list: "categorymembers",
      cmtitle: `Category:${category}`,
      cmlimit: "500",
      ...(cmcontinue ? { cmcontinue } : {}),
    });

    const members = data?.query?.categorymembers ?? [];
    for (const m of members) if (typeof m?.title === "string") titles.push(m.title);

    cmcontinue = data?.continue?.cmcontinue;
    if (!cmcontinue) break;
  }

  return titles.filter(
    (t) =>
      !t.startsWith("Category:") &&
      !t.startsWith("File:") &&
      !t.startsWith("Template:") &&
      !t.includes("/")
  );
}

// pageprops.infoboxes is a JSON string on Fandom portable infobox pages.
async function getInfoboxesForTitles(titles) {
  const out = new Map();
  if (!titles.length) return out;

  const data = await api({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "pageprops",
    titles: titles.join("|"),
  });

  const pages = data?.query?.pages ?? [];
  for (const p of pages) {
    const title = p?.title;
    const s = p?.pageprops?.infoboxes;
    if (!title) continue;

    if (typeof s === "string" && s.trim().startsWith("[")) {
      try {
        out.set(title, JSON.parse(s));
      } catch {
        out.set(title, []);
      }
    } else {
      out.set(title, []);
    }
  }

  return out;
}

async function getParsedHtml(title) {
  const data = await api({
    action: "parse",
    format: "json",
    formatversion: "2",
    page: title,
    prop: "text",
  });

  const html = data?.parse?.text ?? "";
  if (!html) throw new Error(`No HTML returned for ${title}`);
  return html;
}

function stripHtmlToText(html) {
  const $ = cheerio.load(`<div id="x">${html}</div>`);
  return $("#x").text().replace(/\s+/g, " ").trim();
}

function firstNumber(text) {
  const m = String(text).match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!m?.[1]) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function parsePercent(text) {
  const m = String(text).match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  if (!m?.[1]) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function speedWordToHps(word) {
  const w = String(word).toLowerCase();
  if (w.includes("very fast")) return 3.0;
  if (w.includes("fast")) return 2.5;
  if (w.includes("above average")) return 2.2;
  if (w.includes("average")) return 2.0;
  if (w.includes("below average")) return 1.8;
  if (w.includes("very slow")) return 1.2;
  if (w.includes("slow")) return 1.5;
  return undefined;
}

function extractFromInfobox(infoboxes) {
  const buffs = {};
  const combat = {};
  const combatNotes = [];
  const entries = [];

  for (const box of infoboxes ?? []) {
    for (const node of box?.data ?? []) {
      if (node?.type !== "data") continue;
      const labelRaw = node?.data?.label;
      const valueRaw = node?.data?.value;
      if (typeof labelRaw !== "string" || typeof valueRaw !== "string") continue;

      const label = stripHtmlToText(labelRaw);
      const valueText = stripHtmlToText(valueRaw);
      if (!label || !valueText) continue;

      entries.push({ label, valueText });
    }
  }

  const findByLabel = (re) => entries.find((e) => re.test(e.label));

  const dmgEntry =
    findByLabel(/\b(m1\s*)?damage\b/i) ||
    findByLabel(/\bclick\s*damage\b/i) ||
    findByLabel(/\bdmg\b/i);

  if (dmgEntry) {
    const n = firstNumber(dmgEntry.valueText);
    if (typeof n === "number") {
      combat.baseDamage = n;
      combatNotes.push(`baseDamage from infobox "${dmgEntry.label}"`);
    }
  }

  const speedEntry =
    findByLabel(/\b(click|attack|fire)\s*speed\b/i) ||
    findByLabel(/\battack\s*rate\b/i) ||
    findByLabel(/\bfire\s*rate\b/i) ||
    findByLabel(/\brate\b/i);

  if (speedEntry) {
    const n = firstNumber(speedEntry.valueText);
    if (typeof n === "number" && n > 0 && n < 20) {
      combat.hitsPerSecond = n;
      combatNotes.push(`hitsPerSecond numeric from infobox "${speedEntry.label}"`);
    } else {
      const hps = speedWordToHps(speedEntry.valueText);
      if (typeof hps === "number") {
        combat.hitsPerSecond = hps;
        combatNotes.push(`hitsPerSecond mapped from infobox "${speedEntry.label}"`);
      }
    }
  }

  // Buffs from infobox if present (be conservative)
  const dmgPctEntry = findByLabel(/\b(damage\s*boost|damage\s*increase|damage)\b/i);
  if (dmgPctEntry) {
    const p = parsePercent(dmgPctEntry.valueText);
    if (typeof p === "number" && Math.abs(p) <= 500) buffs.damagePct = p;
  }

  const defEntry = findByLabel(/\b(defense|damage\s*reduction)\b/i);
  if (defEntry) {
    const p = parsePercent(defEntry.valueText);
    if (typeof p === "number" && Math.abs(p) <= 500) buffs.defensePct = p;
  }

  const spdEntry = findByLabel(/\b(movement\s*)?speed\b/i);
  if (spdEntry) {
    const p = parsePercent(spdEntry.valueText);
    if (typeof p === "number" && Math.abs(p) <= 500) buffs.speedPct = p;
  }

  const energyEntry = findByLabel(/\benergy\b/i);
  if (energyEntry) {
    const p = parsePercent(energyEntry.valueText);
    if (typeof p === "number" && Math.abs(p) <= 500) buffs.energyPct = p;
  }

  const cdEntry = findByLabel(/\b(cooldown|cd)\b/i);
  if (cdEntry) {
    const p = parsePercent(cdEntry.valueText);
    if (typeof p === "number" && Math.abs(p) <= 500) buffs.cooldownPct = p;
  }

  const xpEntry = findByLabel(/\b(xp|experience)\b/i);
  if (xpEntry) {
    const p = parsePercent(xpEntry.valueText);
    if (typeof p === "number" && Math.abs(p) <= 500) buffs.xpPct = p;
  }

  if (combatNotes.length) combat.notes = combatNotes.join("; ");

  return {
    buffs: Object.keys(buffs).length ? buffs : undefined,
    combat: Object.keys(combat).length ? combat : undefined,
  };
}

// ✅ NEW: HTML fallback for combat (table scan)
function extractCombatFromParsedHtml(html) {
  const $ = cheerio.load(html);

  const pairs = [];
  $("table tr").each((_, tr) => {
    const cells = $(tr).find("th, td");
    if (cells.length < 2) return;

    const label = $(cells[0]).text().replace(/\s+/g, " ").trim();
    const value = $(cells[1]).text().replace(/\s+/g, " ").trim();
    if (!label || !value) return;

    pairs.push({ label, value });
  });

  const find = (re) => pairs.find((p) => re.test(p.label))?.value;

  const damageRaw =
    find(/\b(m1\s*)?damage\b/i) ||
    find(/\bclick\s*damage\b/i) ||
    find(/\bdmg\b/i);

  const speedRaw =
    find(/\b(attack|click|fire)\s*speed\b/i) ||
    find(/\battack\s*rate\b/i) ||
    find(/\bfire\s*rate\b/i) ||
    find(/\brate\b/i);

  const combat = {};
  const notes = [];

  if (damageRaw) {
    const n = firstNumber(damageRaw);
    if (typeof n === "number") {
      combat.baseDamage = n;
      notes.push(`baseDamage from html table`);
    }
  }

  if (speedRaw) {
    const n = firstNumber(speedRaw);
    if (typeof n === "number" && n > 0 && n < 20) {
      combat.hitsPerSecond = n;
      notes.push(`hitsPerSecond numeric from html table`);
    } else {
      const hps = speedWordToHps(speedRaw);
      if (typeof hps === "number") {
        combat.hitsPerSecond = hps;
        notes.push(`hitsPerSecond mapped from "${speedRaw}"`);
      }
    }
  }

  if (notes.length) combat.notes = notes.join("; ");

  return Object.keys(combat).length ? combat : undefined;
}

function extractBuffsFromHtml(html) {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ").trim();

  const buffs = {};
  const patterns = [
    { key: "damagePct", re: /([+-]?\d+(?:\.\d+)?)%\s*(?:more\s*)?(?:damage|dmg)\b/i },
    { key: "defensePct", re: /([+-]?\d+(?:\.\d+)?)%\s*(?:damage\s*reduction|defense|def)\b/i },
    { key: "speedPct", re: /([+-]?\d+(?:\.\d+)?)%\s*(?:movement\s*)?speed\b/i },
    { key: "energyPct", re: /([+-]?\d+(?:\.\d+)?)%\s*(?:energy|energy\s*regen|regen)\b/i },
    { key: "cooldownPct", re: /([+-]?\d+(?:\.\d+)?)%\s*(?:cooldown|cd)\b/i },
    { key: "xpPct", re: /([+-]?\d+(?:\.\d+)?)%\s*(?:xp|experience)\b/i },
  ];

  for (const p of patterns) {
    const m = text.match(p.re);
    if (m?.[1]) {
      const val = Number(m[1]);
      if (Number.isFinite(val)) buffs[p.key] = val;
    }
  }

  return Object.keys(buffs).length ? buffs : undefined;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const outDir = path.join(process.cwd(), "public", "data", "roblox", "bloxfruits");
  fs.mkdirSync(outDir, { recursive: true });

  const items = [];
  const seen = new Set();

  for (const { category, type } of CATEGORY_MAP) {
    console.log(`\n[Category] ${category}`);
    const titles = await getCategoryMembers(category);

    const filtered = titles.filter((t) => {
      if (seen.has(t)) return false;
      if (/\b(Wiki|Update|Patch|History|Gallery|Trivia)\b/i.test(t)) return false;
      return true;
    });

    for (const t of filtered) seen.add(t);

    const batches = chunk(filtered, 50);

    for (let bi = 0; bi < batches.length; bi++) {
      const batchTitles = batches[bi];
      console.log(`  [Infobox batch] ${bi + 1}/${batches.length} (${batchTitles.length} pages)`);

      let infoboxMap = new Map();
      try {
        infoboxMap = await getInfoboxesForTitles(batchTitles);
      } catch (e) {
        console.warn(`  - Infobox batch failed: ${e?.message ?? e}`);
      }

      for (let i = 0; i < batchTitles.length; i++) {
        const title = batchTitles[i];

        const infoboxes = infoboxMap.get(title) ?? [];
        const fromInfobox = extractFromInfobox(infoboxes);

        // ✅ One HTML fetch per page (used for both buffs + combat fallbacks)
        let html = "";
        try {
          html = await getParsedHtml(title);
        } catch {
          html = "";
        }

        const buffs = fromInfobox.buffs ?? (html ? extractBuffsFromHtml(html) : undefined);

        // ✅ NEW: combat fallback from html if infobox didn't have it
        const htmlCombat = html ? extractCombatFromParsedHtml(html) : undefined;
        const combat = fromInfobox.combat ?? htmlCombat;

        const wikiPage = `https://blox-fruits.fandom.com/wiki/${encodeURIComponent(
          title.replace(/ /g, "_")
        )}`;

        items.push({
          id: slugify(title),
          name: title.replace(/_/g, " "),
          type,
          buffs,
          combat,
          source: { wikiPage },
        });

        await new Promise((r) => setTimeout(r, 120));
      }
    }
  }

  const file = path.join(outDir, "items.v2.json");
  fs.writeFileSync(file, JSON.stringify(items, null, 2), "utf8");

  const withDamage = items.filter((x) => typeof x?.combat?.baseDamage === "number").length;
  const withRate = items.filter((x) => typeof x?.combat?.hitsPerSecond === "number").length;

  console.log(`\n✅ Wrote ${items.length} items to ${file}`);
  console.log(`   • items with baseDamage: ${withDamage}`);
  console.log(`   • items with hitsPerSecond: ${withRate}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
