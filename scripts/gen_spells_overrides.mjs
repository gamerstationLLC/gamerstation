#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const OUT = "public/data/lol/spells_overrides.json";
const INPUT_PATH = "data_sources/meraki/champion-abilities.json";

const SLOT_KEYS = ["Q", "W", "E", "R"];

function normBase(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const out = values.map((v) => Number(v));
  if (!out.every((n) => Number.isFinite(n))) return null;
  // reject arrays that are all zero/NaN-ish placeholders
  if (!out.some((n) => n !== 0)) return null;
  return out;
}

function typeFromDamageType(damageType) {
  const t = String(damageType || "").toUpperCase();
  if (t.includes("PHYSICAL")) return "phys";
  if (t.includes("MAGIC")) return "magic";
  if (t.includes("TRUE")) return "true";
  return undefined;
}

function textLooksLikeDamage(s) {
  const t = String(s || "").toLowerCase();
  if (t.includes("damage")) return true;
  if (t.includes("dealing")) return true;
  if (t.includes("deals")) return true;
  return false;
}

function penaltyForAttribute(attr) {
  // We want "main hit" damage, not sweetspot/minion/total/misc if possible.
  const a = String(attr || "").toLowerCase();
  let p = 0;
  if (a.includes("sweetspot")) p += 5;
  if (a.includes("minion")) p += 4;
  if (a.includes("monster")) p += 3;
  if (a.includes("maximum")) p += 3;
  if (a.includes("total")) p += 2; // sometimes ok, but prefer base hit
  return p;
}

/**
 * Pick a single "best" flat base array from a spell object:
 * spell.effects[].leveling[].modifiers[].values with units == "" (flat)
 *
 * Heuristic:
 * - Prefer leveling blocks whose attribute includes "damage" (or description does)
 * - Prefer flat modifier (units are "" across ranks)
 * - Avoid sweetspot/minion/etc when possible
 */
function extractPrimaryFlatBase(spell) {
  if (!spell || typeof spell !== "object") return null;
  const effects = Array.isArray(spell.effects) ? spell.effects : [];

  let best = null;
  let bestScore = Infinity;

  for (const eff of effects) {
    const leveling = Array.isArray(eff.leveling) ? eff.leveling : [];
    const effDesc = String(eff.description || "");

    for (const lvl of leveling) {
      const attr = String(lvl.attribute || "");
      const mods = Array.isArray(lvl.modifiers) ? lvl.modifiers : [];

      for (const mod of mods) {
        const values = normBase(mod?.values);
        if (!values) continue;

        // must be a "flat" array: units are "" (or missing) for each rank
        const units = Array.isArray(mod?.units) ? mod.units : [];
        const isFlat =
          units.length === 0 || units.every((u) => String(u ?? "") === "");
        if (!isFlat) continue;

        // score: lower is better
        let score = 0;

        const looksDamage = textLooksLikeDamage(attr) || textLooksLikeDamage(effDesc);
        if (!looksDamage) score += 10;

        score += penaltyForAttribute(attr);

        // Prefer arrays that look like spell ranks (3 or 5)
        if (values.length === 5) score -= 1;
        if (values.length === 3) score -= 1;

        if (score < bestScore) {
          bestScore = score;
          best = values;
        }
      }
    }
  }

  return best;
}

const raw = JSON.parse(fs.readFileSync(INPUT_PATH, "utf-8"));

// ✅ Your file is: { "Aatrox": {...}, "Ahri": {...} }
const champs =
  Array.isArray(raw) ? raw :
  raw && typeof raw === "object" ? Object.values(raw) :
  [];

const out = {};

for (const c of champs) {
  if (!c || typeof c !== "object") continue;

  const numericKey = String(c.id ?? "").trim();      // "266"
  const champId = String(c.key ?? "").trim();        // "Aatrox"
  if (!numericKey || !champId) continue;

  const entry = { id: champId };
  let any = false;

  const abilities = c.abilities && typeof c.abilities === "object" ? c.abilities : null;

  for (const slot of SLOT_KEYS) {
    const arr = abilities?.[slot] ?? abilities?.[slot.toLowerCase()];
    if (!Array.isArray(arr) || !arr.length) continue;

    const spell = arr[0]; // baseline form
    if (!spell) continue;

    const base = extractPrimaryFlatBase(spell);
    if (!base) continue;

    const type = typeFromDamageType(spell.damageType);

    entry[slot] = {
      ...(type ? { type } : {}),
      base,
    };

    any = true;
  }

  if (!any) continue;

  // ✅ numeric key version includes id
  out[numericKey] = entry;

  // ✅ champ id version excludes id field (your preferred style)
  out[champId] = Object.fromEntries(
    SLOT_KEYS.filter((k) => entry[k]).map((k) => [k, entry[k]])
  );
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf-8");

console.log(`✅ Generated ${Object.keys(out).length} entries → ${OUT}`);
