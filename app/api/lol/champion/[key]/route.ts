// app/api/lol/champion/[key]/route.ts
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

type AnyObj = Record<string, any>;

function asArray(x: any): any[] {
  return Array.isArray(x) ? x : [];
}

function normalizeSpellType(spell: AnyObj): "phys" | "magic" | "true" | "mixed" {
  const dt =
    (spell?.damageType as string | undefined) ||
    (spell?.damage_type as string | undefined) ||
    (spell?.damageTypeName as string | undefined) ||
    "";

  const d = String(dt).toLowerCase();
  if (d.includes("physical")) return "phys";
  if (d.includes("magic")) return "magic";
  if (d.includes("true")) return "true";
  return "mixed";
}

function extractBaseByRankFromSpell(spell: AnyObj): number[] | null {
  // Best-effort extraction across common CommunityDragon structures
  const candidates: AnyObj[] = [];

  if (spell?.spellCalculations && typeof spell.spellCalculations === "object") {
    candidates.push(spell.spellCalculations);
  }
  if (spell?.calculations && typeof spell.calculations === "object") {
    candidates.push(spell.calculations);
  }
  if (spell?.mSpell && typeof spell.mSpell === "object") {
    if (spell.mSpell.spellCalculations)
      candidates.push(spell.mSpell.spellCalculations);
    if (spell.mSpell.calculations) candidates.push(spell.mSpell.calculations);
  }

  const effectAmounts = asArray(spell?.effectAmounts);
  const valuesObj =
    spell?.values && typeof spell.values === "object" ? spell.values : null;

  function pickFromCalcObject(obj: AnyObj): number[] | null {
    let best: { arr: number[]; score: number } | null = null;

    for (const [k, v] of Object.entries(obj)) {
      if (!v || typeof v !== "object") continue;

      const vals = Array.isArray((v as any).values) ? (v as any).values : null;
      const eff = Array.isArray((v as any).effect) ? (v as any).effect : null;

      const arr = (vals ?? eff) as any[] | null;
      if (!arr || arr.length < 2) continue;

      const nums = arr.map((n) => Number(n));
      if (!nums.every((n) => Number.isFinite(n))) continue;

      // avoid obvious non-damage
      const lk = k.toLowerCase();
      if (
        lk.includes("cooldown") ||
        lk.includes("cost") ||
        lk.includes("mana") ||
        lk.includes("cd")
      )
        continue;

      const looksDamage =
        lk.includes("damage") ||
        (v as any).name?.toLowerCase?.().includes?.("damage") ||
        (v as any).formula?.toLowerCase?.().includes?.("damage");

      const nonZero = nums.some((n) => n !== 0);
      if (!nonZero) continue;

      const score = nums.length + (looksDamage ? 10 : 0);

      if (!best || score > best.score) best = { arr: nums, score };
    }

    return best?.arr ?? null;
  }

  for (const obj of candidates) {
    const picked = pickFromCalcObject(obj);
    if (picked) return picked;
  }

  if (valuesObj) {
    const picked = pickFromCalcObject(valuesObj);
    if (picked) return picked;
  }

  for (const maybe of effectAmounts) {
    if (!Array.isArray(maybe)) continue;
    const nums = maybe.map((n) => Number(n));
    if (
      nums.every((n) => Number.isFinite(n)) &&
      nums.length >= 3 &&
      nums.some((n) => n !== 0)
    ) {
      return nums;
    }
  }

  return null;
}

/**
 * If Next fails to inject params, this fallback still works.
 * URL: /api/lol/champion/266  -> key = "266"
 */
function keyFromUrl(req: Request): string | null {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    // ... / api / lol / champion / {key}
    const idx = parts.findIndex((p) => p === "champion");
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  } catch {}
  return null;
}



let OVERRIDES_CACHE: Record<string, any> | null = null;

async function loadOverrides(): Promise<Record<string, any>> {
  // During dev, always re-read so edits apply instantly.
  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev && OVERRIDES_CACHE) return OVERRIDES_CACHE;

  // ✅ Your actual location + filename:
  const p = path.join(process.cwd(), "public", "data", "lol", "spells_overrides.json");

  try {
    const raw = await fs.readFile(p, "utf-8");
    const parsed = JSON.parse(raw);
    if (!isDev) OVERRIDES_CACHE = parsed;
    return parsed;
  } catch {
    // IMPORTANT: don't cache empty in dev; allow it to be created later.
    if (!isDev) OVERRIDES_CACHE = {};
    return {};
  }
}


function applyOverrides(
  normalized: AnyObj,
  key: string,
  overrides: Record<string, any>
) {
  const champOverrides = overrides?.[String(key)];
  if (!champOverrides || typeof champOverrides !== "object") return;

  for (const slot of ["Q", "W", "E", "R"] as const) {
    const o = champOverrides?.[slot];
    if (!o || typeof o !== "object") continue;

    if (!normalized.spellDamage[slot]) {
      normalized.spellDamage[slot] = {
        name: slot,
        type: "mixed",
        base: null,
        maxRank: slot === "R" ? 3 : 5,
      };
    }

    // Merge; override wins.
    normalized.spellDamage[slot] = {
      ...normalized.spellDamage[slot],
      ...o,
      base: Array.isArray(o.base)
        ? o.base.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n))
        : normalized.spellDamage[slot].base,
      maxRank:
        typeof o.maxRank === "number"
          ? o.maxRank
          : normalized.spellDamage[slot].maxRank,
    };
  }
}

export async function GET(
  req: Request,
  context: { params?: { key?: string } }
) {
  const key = context?.params?.key ?? keyFromUrl(req);

  if (!key) {
    return NextResponse.json(
      { error: "Missing champion key", params: context?.params ?? null },
      { status: 400 }
    );
  }

  const url = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/${encodeURIComponent(
    key
  )}.json`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: "CommunityDragon fetch failed", status: res.status, url },
        { status: 502 }
      );
    }

    const champ = (await res.json()) as AnyObj;

    const spells = asArray(champ?.spells);

    const normalized: AnyObj = {
      id: champ?.id,
      name: champ?.name,
      alias: champ?.alias,
      title: champ?.title,
      key: Number(key),
      spellDamage: {} as AnyObj,
    };

    for (const sp of spells) {
      const sk = String(sp?.spellKey ?? "").toUpperCase(); // "Q","W","E","R"
      if (!["Q", "W", "E", "R"].includes(sk)) continue;

      const base = extractBaseByRankFromSpell(sp);

      normalized.spellDamage[sk] = {
        name: sp?.name ?? sk,
        type: normalizeSpellType(sp),
        base: base ?? null,
        maxRank: sp?.maxLevel ?? sp?.maxrank ?? (sk === "R" ? 3 : 5),
      };
    }

    // ✅ Apply overrides last (Option C)
    const overrides = await loadOverrides();
    applyOverrides(normalized, key, overrides);

    return NextResponse.json({ normalized, raw: champ });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ? String(e.message) : "Unknown error", url },
      { status: 500 }
    );
  }
}
