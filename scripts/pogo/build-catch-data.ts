// scripts/pogo/build-catch-data.ts
/* eslint-disable no-console */

import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type PogoMon = {
  id: string;
  form: string; // canonical: `${id}_${FORM}`
  name: string;
  baseCaptureRate: number | null; // 0..1
  baseFleeRate: number | null; // 0..1
  type1?: string | null;
  type2?: string | null;
};

type CpRow = { level: number; cpm: number };

const REPO_URL = "https://github.com/pokemongo-dev-contrib/pokemongo-game-master.git";

/**
 * Forms we consider "real gameplay variants" (not costumes).
 * Keep these even if they look unusual.
 */
const ALWAYS_KEEP_FORMS = new Set([
  "NORMAL",
  "SHADOW",
  "PURIFIED",
  "ALOLA",
  "GALARIAN",
  "HISUIAN",
  "PALDEA",
  "PALDEAN",
  "ORIGIN",
  "ALTERED",
  "ARMORED",
  "THERIAN",
  "INCARNATE",
  "SKY",
  "LAND",
  "FAN",
  "FROST",
  "HEAT",
  "MOW",
  "WASH",
  "ATTACK",
  "DEFENSE",
  "SPEED",
  "10",
  "50",
  "COMPLETE",
  "ZEN",
  "SUNNY",
  "RAINY",
  "SNOWY",
]);

function titleCaseFromId(id: string) {
  return id
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
    .replace(/\bMr\b/g, "Mr")
    .replace(/\bMime\b/g, "Mime");
}

function asNumberOrNull(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function pickPokemonSettings(t: any) {
  if (!t || typeof t !== "object") return null;
  if (t.pokemonSettings) return t.pokemonSettings;

  for (const k of Object.keys(t)) {
    const v = (t as any)[k];
    if (v?.pokemonSettings) return v.pokemonSettings;
  }
  return null;
}

/**
 * Encounter rates are not always on pokemonSettings.{baseCaptureRate,baseFleeRate}.
 * They can be nested under encounter/encounterSettings/etc depending on decode shape.
 */
function pickEncounterRates(ps: any): { baseCaptureRate: number | null; baseFleeRate: number | null } {
  const directCapture = asNumberOrNull(ps?.baseCaptureRate);
  const directFlee = asNumberOrNull(ps?.baseFleeRate);

  const encounter =
    ps?.encounter ??
    ps?.encounterSettings ??
    ps?.encounterAttributes ??
    ps?.encounterData ??
    ps?.encounterInfo ??
    null;

  const nestedCapture = asNumberOrNull(encounter?.baseCaptureRate);
  const nestedFlee = asNumberOrNull(encounter?.baseFleeRate);

  return {
    baseCaptureRate: directCapture ?? nestedCapture ?? null,
    baseFleeRate: directFlee ?? nestedFlee ?? null,
  };
}

function extractItemTemplates(root: any): any[] {
  if (Array.isArray(root)) return root;
  if (root && typeof root === "object") {
    if (Array.isArray((root as any).itemTemplates)) return (root as any).itemTemplates;
    if (Array.isArray((root as any).templates)) return (root as any).templates;
  }
  return [];
}

function deepFindCpMultiplier(obj: any): number[] | null {
  const stack: any[] = [obj];
  const seen = new Set<any>();
  let steps = 0;
  const MAX_STEPS = 140000;

  while (stack.length && steps++ < MAX_STEPS) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (seen.has(cur)) continue;
    seen.add(cur);

    const arr = (cur as any).cpMultiplier;
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "number") {
      return arr as number[];
    }

    for (const k of Object.keys(cur)) {
      const v = (cur as any)[k];
      if (v && typeof v === "object") stack.push(v);
    }
  }
  return null;
}

/**
 * Canonicalize forms so we never get duplicates like:
 *   form="NORMAL" and form="PIKACHU_NORMAL" both showing as "NORMAL" in UI.
 *
 * Output form is ALWAYS `${id}_${FORM}`.
 */
function canonicalizeForm(id: string, rawForm: any): string {
  const fallback = `${id}_NORMAL`;

  if (!rawForm || typeof rawForm !== "string") return fallback;

  const f = rawForm.trim();
  if (!f) return fallback;

  // Already canonical like "PIKACHU_COPY_2019" or "ABOMASNOW_NORMAL"
  if (f.startsWith(`${id}_`)) return f;

  // Plain enum like "NORMAL", "SHADOW", etc → prefix id
  return `${id}_${f}`;
}

/**
 * Extract the short form label (without the `${id}_` prefix).
 * e.g. form="PIKACHU_FALL_2019" => "FALL_2019"
 */
function shortForm(id: string, canonicalForm: string): string {
  const prefix = `${id}_`;
  if (canonicalForm.startsWith(prefix)) return canonicalForm.slice(prefix.length);
  return canonicalForm;
}

/**
 * Detect "costume/event forms" like COPY_2019 / FALL_2019 / PARTY_HAT, etc.
 * These are typically cosmetic and do not change catch/flee rates.
 */
function isCostumeOrEventForm(sf: string): boolean {
  const s = (sf || "").toUpperCase();

  // Always keep core forms
  if (ALWAYS_KEEP_FORMS.has(s)) return false;

  // Any year suffix/presence (2018/2019/2020/2021/2022/2023/2024/2025/2026…)
  if (/\b20\d{2}\b/.test(s) || /_(20\d{2})$/.test(s) || /_(20\d{2})_/.test(s)) return true;

  // Common GO costume/event tokens
  const tokens = [
    "COPY",
    "FALL",
    "SPRING",
    "SUMMER",
    "WINTER",
    "HOLIDAY",
    "CHRISTMAS",
    "NEW_YEAR",
    "HALLOWEEN",
    "ANNIVERSARY",
    "BIRTHDAY",
    "FESTIVAL",
    "FASHION",
    "SAFARI",
    "TOUR",
    "GOFEST",
    "COMMUNITY",
    "PARTY",
    "CELEBRATION",
    "COSTUME",
    "HAT",
    "CAP",
    "CROWN",
    "FLOWER",
    "BOW",
    "SCARF",
    "GLASSES",
    "VISOR",
    "RIBBON",
    "BALLOON",
    "MASK",
    "BANDANA",
    "SANTA",
    "WITCH",
    "PUMPKIN",
    "REINDEER",
    "SNOWMAN",
    "LUNAR",
    "DRAGON",
    "KARIYUSHI",
    "CHAMPION",
    "WORLD",
    "KANTO_HAT",
    "JOHTO_HAT",
    "HOENN_HAT",
    "SINNOH_HAT",
    "UNOVA_HAT",
    "KALOS_HAT",
    "ALOLA_HAT",
    "GALARIAN_HAT",
  ];

  for (const t of tokens) {
    if (s.includes(t)) return true;
  }

  return false;
}

async function ensureRepo(cacheDir: string) {
  const gitDir = path.join(cacheDir, ".git");

  if (!existsSync(cacheDir) || !existsSync(gitDir)) {
    console.log(`Cloning GAME_MASTER repo into ${cacheDir}…`);
    await fs.mkdir(path.dirname(cacheDir), { recursive: true });
    await execFileAsync("git", ["clone", "--depth", "1", REPO_URL, cacheDir], { windowsHide: true });
    return;
  }

  console.log("Updating cached GAME_MASTER repo (git pull)…");
  await execFileAsync("git", ["-C", cacheDir, "pull", "--ff-only"], { windowsHide: true });
}

type Candidate = {
  rel: string;
  full: string;
  size: number;
  itemTemplatesCount: number;
  monsWithAnyEncounterRate: number;
  monsWithBcr: number;
  monsWithBfr: number;
  cpmCount: number;
};

async function scoreCandidate(cacheDir: string, rel: string): Promise<Candidate | null> {
  const full = path.join(cacheDir, rel);

  try {
    const stat = await fs.stat(full);

    // Too small => likely old/partial
    if (stat.size < 2_000_000) return null;

    // Quick head scan for marker (avoid parsing junk)
    const fh = await fs.open(full, "r");
    const chunkSize = 2 * 1024 * 1024;
    const buf = Buffer.alloc(chunkSize);
    const { bytesRead } = await fh.read(buf, 0, chunkSize, 0);
    await fh.close();

    const head = buf.subarray(0, bytesRead).toString("utf8");
    if (!head.includes("itemTemplates")) return null;

    const raw = await fs.readFile(full, "utf8");
    const gm = JSON.parse(raw);
    const itemTemplates = extractItemTemplates(gm);

    // Modern decoded GMs are huge; avoid ancient ones
    if (itemTemplates.length < 5000) return null;

    // Estimate encounter coverage (dedupe by canonical (id,form))
    const seenKeys = new Set<string>();
    let monsWithAnyEncounterRate = 0;
    let monsWithBcr = 0;
    let monsWithBfr = 0;

    for (const it of itemTemplates) {
      const t = it?.template ?? it;
      const ps = pickPokemonSettings(t);
      if (!ps) continue;

      const id: string | undefined = ps.pokemonId ?? ps.pokemonID ?? ps.pokemon;
      if (!id || typeof id !== "string") continue;

      const rawForm: string = (ps.form && typeof ps.form === "string" ? ps.form : "NORMAL") || "NORMAL";
      const form = canonicalizeForm(id, rawForm);
      const key = `${id}__${form}`;
      if (seenKeys.has(key)) continue;

      const { baseCaptureRate, baseFleeRate } = pickEncounterRates(ps);
      const hasAny = baseCaptureRate != null || baseFleeRate != null;

      if (hasAny) {
        monsWithAnyEncounterRate++;
        if (baseCaptureRate != null) monsWithBcr++;
        if (baseFleeRate != null) monsWithBfr++;
      }

      seenKeys.add(key);
    }

    // CP multipliers
    let cpmArr: number[] | null = null;
    for (const it of itemTemplates) {
      cpmArr = deepFindCpMultiplier(it);
      if (cpmArr) break;
    }
    const cpmCount = cpmArr?.length ?? 0;

    // If encounter data coverage is basically zero, skip this GM (not useful for catch calc)
    if (monsWithAnyEncounterRate < 200) return null;

    return {
      rel,
      full,
      size: stat.size,
      itemTemplatesCount: itemTemplates.length,
      monsWithAnyEncounterRate,
      monsWithBcr,
      monsWithBfr,
      cpmCount,
    };
  } catch {
    return null;
  }
}

async function findBestDecodedGameMaster(cacheDir: string): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cacheDir, "ls-files", "versions"], {
    windowsHide: true,
    maxBuffer: 30 * 1024 * 1024,
  });

  const files = stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .filter((f) => /game_master/i.test(f) || /V2_GAME_MASTER/i.test(f))
    // avoid wrapper "latest" status file(s)
    .filter((f) => !/versions\/latest\//i.test(f.replace(/\\/g, "/")));

  // Prefer V2 + newer timestamp folders first, but final choice is content-based via score
  const sorted = files.sort((a, b) => {
    const aa = a.replace(/\\/g, "/");
    const bb = b.replace(/\\/g, "/");

    const aV2 = /V2_GAME_MASTER\.json$/i.test(aa) ? 0 : 1;
    const bV2 = /V2_GAME_MASTER\.json$/i.test(bb) ? 0 : 1;
    if (aV2 !== bV2) return aV2 - bV2;

    const aNum = parseInt(aa.match(/versions\/(\d+)\//i)?.[1] ?? "0", 10);
    const bNum = parseInt(bb.match(/versions\/(\d+)\//i)?.[1] ?? "0", 10);
    return bNum - aNum;
  });

  const candidates: Candidate[] = [];
  for (const rel of sorted) {
    const c = await scoreCandidate(cacheDir, rel);
    if (c) candidates.push(c);

    // Early stop if we got a very strong candidate
    if (c && c.itemTemplatesCount > 20000 && c.monsWithAnyEncounterRate > 1500 && c.cpmCount >= 100) {
      break;
    }
  }

  if (!candidates.length) {
    throw new Error(
      "Could not locate a modern decoded GAME_MASTER JSON with encounter rates in versions/. " +
        "Repo structure may have changed or decoded files are missing."
    );
  }

  // Rank by: encounter coverage > templates > CPM > size
  candidates.sort((a, b) => {
    if (b.monsWithAnyEncounterRate !== a.monsWithAnyEncounterRate)
      return b.monsWithAnyEncounterRate - a.monsWithAnyEncounterRate;
    if (b.itemTemplatesCount !== a.itemTemplatesCount) return b.itemTemplatesCount - a.itemTemplatesCount;
    if (b.cpmCount !== a.cpmCount) return b.cpmCount - a.cpmCount;
    return b.size - a.size;
  });

  const best = candidates[0];
  console.log(
    `Best decoded GM: ${best.rel}\n` +
      `  size: ${(best.size / 1024 / 1024).toFixed(1)} MB\n` +
      `  itemTemplates: ${best.itemTemplatesCount}\n` +
      `  mons w/ any rate: ${best.monsWithAnyEncounterRate}\n` +
      `  mons w/ BCR: ${best.monsWithBcr}\n` +
      `  mons w/ BFR: ${best.monsWithBfr}\n` +
      `  cpm rows: ${best.cpmCount}`
  );

  return best.full;
}

function inheritEncounterRatesAcrossForms(mons: PogoMon[]) {
  // For each species id, pick best available BCR/BFR; prefer NORMAL if it has values.
  const bestBySpecies = new Map<string, { bcr: number | null; bfr: number | null }>();

  for (const m of mons) {
    const cur = bestBySpecies.get(m.id) ?? { bcr: null, bfr: null };

    const isNormal = /(^|_)NORMAL$/i.test(m.form);

    if (isNormal) {
      if (m.baseCaptureRate != null) cur.bcr = m.baseCaptureRate;
      if (m.baseFleeRate != null) cur.bfr = m.baseFleeRate;
    } else {
      if (cur.bcr == null && m.baseCaptureRate != null) cur.bcr = m.baseCaptureRate;
      if (cur.bfr == null && m.baseFleeRate != null) cur.bfr = m.baseFleeRate;
    }

    bestBySpecies.set(m.id, cur);
  }

  for (const m of mons) {
    const best = bestBySpecies.get(m.id);
    if (!best) continue;
    if (m.baseCaptureRate == null) m.baseCaptureRate = best.bcr;
    if (m.baseFleeRate == null) m.baseFleeRate = best.bfr;
  }

  return bestBySpecies;
}

/**
 * Filter out costume/event forms IF (and only if) they share the same encounter rates
 * as the species baseline. If a form actually has different BCR/BFR, keep it.
 */
function filterCostumeForms(mons: PogoMon[], bestBySpecies: Map<string, { bcr: number | null; bfr: number | null }>) {
  const kept: PogoMon[] = [];
  let removed = 0;

  for (const m of mons) {
    const sf = shortForm(m.id, m.form);

    // Always keep core (real) variants explicitly
    const sfUpper = sf.toUpperCase();
    if (ALWAYS_KEEP_FORMS.has(sfUpper)) {
      kept.push(m);
      continue;
    }

    // If it's not a costume/event form, keep it
    if (!isCostumeOrEventForm(sf)) {
      kept.push(m);
      continue;
    }

    // Costume/event: only remove if it matches baseline encounter rates
    const best = bestBySpecies.get(m.id) ?? { bcr: null, bfr: null };
    const sameBcr =
      (m.baseCaptureRate == null && best.bcr == null) || m.baseCaptureRate === best.bcr;
    const sameBfr =
      (m.baseFleeRate == null && best.bfr == null) || m.baseFleeRate === best.bfr;

    if (sameBcr && sameBfr) {
      removed++;
      continue;
    }

    // If encounter differs, keep it (rare, but safest)
    kept.push(m);
  }

  return { kept, removed };
}

async function main() {
  const cacheDir = path.join(process.cwd(), "scripts", "pogo", ".cache", "pokemongo-game-master");
  await ensureRepo(cacheDir);

  console.log("Locating BEST decoded GAME_MASTER JSON in repo…");
  const gmFile = await findBestDecodedGameMaster(cacheDir);

  const raw = await fs.readFile(gmFile, "utf8");
  const gm = JSON.parse(raw);

  const itemTemplates = extractItemTemplates(gm);
  console.log(`Loaded itemTemplates: ${itemTemplates.length}`);

  // Pokémon encounter settings (dedupe by canonical form)
  const monsMap = new Map<string, PogoMon>();

  for (const it of itemTemplates) {
    const t = it?.template ?? it;
    const ps = pickPokemonSettings(t);
    if (!ps) continue;

    const id: string | undefined = ps.pokemonId ?? ps.pokemonID ?? ps.pokemon;
    if (!id || typeof id !== "string") continue;

    const rawForm: string = (ps.form && typeof ps.form === "string" ? ps.form : "NORMAL") || "NORMAL";
    const form = canonicalizeForm(id, rawForm);

    const { baseCaptureRate, baseFleeRate } = pickEncounterRates(ps);

    const type1 =
      typeof ps.type === "string"
        ? ps.type
        : typeof ps.type1 === "string"
          ? ps.type1
          : null;

    const type2 =
      typeof ps.type2 === "string"
        ? ps.type2
        : typeof ps.typeSecondary === "string"
          ? ps.typeSecondary
          : null;

    const key = `${id}__${form}`;

    // If we see multiple templates for same (id,form), prefer the one with encounter rates.
    const prev = monsMap.get(key);
    if (prev) {
      const prevHas = prev.baseCaptureRate != null || prev.baseFleeRate != null;
      const nextHas = baseCaptureRate != null || baseFleeRate != null;
      if (prevHas && !nextHas) continue;
      if (!prevHas && nextHas) {
        monsMap.set(key, {
          id,
          form,
          name: titleCaseFromId(id),
          baseCaptureRate,
          baseFleeRate,
          type1,
          type2,
        });
      }
      continue;
    }

    monsMap.set(key, {
      id,
      form,
      name: titleCaseFromId(id),
      baseCaptureRate,
      baseFleeRate,
      type1,
      type2,
    });
  }

  let mons = Array.from(monsMap.values());

  // Inherit missing encounter rates across forms (so costumes inherit NORMAL rates)
  const bestBySpecies = inheritEncounterRatesAcrossForms(mons);

  // Now safely filter costume/event forms (only if they match baseline rates)
  const before = mons.length;
  const filtered = filterCostumeForms(mons, bestBySpecies);
  mons = filtered.kept;

  // Sort after filtering
  mons.sort((a, b) => {
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return a.form.localeCompare(b.form);
  });

  console.log(`Filtered costume/event forms: removed ${filtered.removed} (from ${before} → ${mons.length})`);

  // CP multipliers
  let cpmArr: number[] | null = null;
  for (const it of itemTemplates) {
    cpmArr = deepFindCpMultiplier(it);
    if (cpmArr) break;
  }
  if (!cpmArr) {
    throw new Error("Could not locate cpMultiplier array in GAME_MASTER.");
  }

  const cp: CpRow[] = cpmArr.map((cpm, i) => ({
    level: 1 + i * 0.5,
    cpm,
  }));

  // Write outputs
  const outDir = path.join(process.cwd(), "public", "data", "pogo");
  await fs.mkdir(outDir, { recursive: true });

  const outMons = path.join(outDir, "pokemon_encounter.json");
  const outCpm = path.join(outDir, "cp_multiplier.json");

  await fs.writeFile(outMons, JSON.stringify({ updatedAt: Date.now(), mons }, null, 2), "utf8");
  await fs.writeFile(outCpm, JSON.stringify({ updatedAt: Date.now(), cp }, null, 2), "utf8");

  const withAny = mons.filter((m) => m.baseCaptureRate != null || m.baseFleeRate != null).length;
  const withBcr = mons.filter((m) => m.baseCaptureRate != null).length;
  const withBfr = mons.filter((m) => m.baseFleeRate != null).length;

  console.log(`Wrote: ${outMons} (${mons.length} rows)`);
  console.log(`  rows w/ any rate: ${withAny}, w/ BCR: ${withBcr}, w/ BFR: ${withBfr}`);
  console.log(`Wrote: ${outCpm} (${cp.length} rows)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
