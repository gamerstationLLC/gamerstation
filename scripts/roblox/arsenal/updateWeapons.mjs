/**
 * scripts/roblox/arsenal/updateWeapons.mjs
 *
 * Generates:
 *   public/data/roblox/arsenal/weapons.v1.json
 *
 * Source:
 *   https://robloxarsenal.fandom.com/wiki/Category:Weapons
 *
 * What this version adds:
 *  - More resilient parsing (doesn't rely only on the "Other Functions" row layout)
 *  - Derives missing RPM when possible from:
 *      1) attackInterval (seconds/shot): RPM = 60 / attackInterval
 *      2) timeToEmptyMag (seconds): RPM = (magSize / timeToEmpty) * 60
 *      3) shotsPerSecond: RPM = shotsPerSecond * 60
 *  - Derives missing reloadSec when possible from reload time strings
 *  - Stores sources for inferred values (rpmSource, reloadSource)
 *
 * Run:
 *   node scripts/roblox/arsenal/updateWeapons.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const WIKI_BASE = "https://robloxarsenal.fandom.com";
const API = `${WIKI_BASE}/api.php`;

const OUT_PATH = path.join(
  process.cwd(),
  "public",
  "data",
  "roblox",
  "arsenal",
  "weapons.v1.json"
);

const USER_AGENT =
  "GamerStationArsenalUpdater/1.3 (+https://gamerstation.gg; contact: you@example.com)";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugifyId(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumOrNull(x) {
  if (x === null || x === undefined) return null;
  const s = String(x).trim();
  if (!s) return null;
  const n = Number(s.replace(/[^\d.]+/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normalizeFireMode(s) {
  const v = (s || "").toLowerCase();
  if (v.includes("automatic")) return "auto";
  if (v.includes("semi")) return "semi";
  if (v.includes("burst")) return "burst";
  if (v.includes("auto")) return "auto";
  return v ? "other" : null;
}

function findFieldValue(text, label) {
  // Finds a single-line field like: "Damage 20-30 (40-60)"
  const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${safeLabel}\\s+([^\\n]+)`, "i");
  const m = text.match(re);
  if (!m) return null;
  return m[1].trim();
}

function findFirstNumberAfterLabel(text, label) {
  const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${safeLabel}\\s*[:]?\\s*([-]?\\d+(?:\\.\\d+)?)`, "i");
  const m = text.match(re);
  return m ? Number(m[1]) : null;
}

function findFirstNumberInParensAfterLabel(text, label) {
  const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${safeLabel}[\\s\\S]{0,60}?\\(\\s*([-]?\\d+(?:\\.\\d+)?)\\s*\\)`, "i");
  const m = text.match(re);
  return m ? Number(m[1]) : null;
}

function isLikelyNonWeaponTitle(title) {
  const t = (title || "").toLowerCase();
  const badContains = [
    "category:",
    "template:",
    "help:",
    "user:",
    "gallery",
    "update",
    "patch",
    "changelog",
    "overview",
    "trivia",
    "list of",
    "removed",
    "unused",
  ];
  if (badContains.some((b) => t.includes(b))) return true;
  return false;
}

/**
 * Parse damage ranges.
 * Best-effort:
 *  - "A-B (C-D)" => bodyClose=A, bodyFar=B, headClose=C, headFar=D
 *  - "A-B" => bodyClose=A, bodyFar=B
 *  - "A" => bodyClose=A
 */
function parseDamageLine(damageLine) {
  if (!damageLine) return null;
  const raw = damageLine;
  const nums = raw.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  const out = { raw };

  if (raw.includes("(") && nums.length >= 4) {
    out.bodyClose = nums[0];
    out.bodyFar = nums[1];
    out.headClose = nums[2];
    out.headFar = nums[3];
  } else if (nums.length >= 2) {
    out.bodyClose = nums[0];
    out.bodyFar = nums[1];
  } else if (nums.length === 1) {
    out.bodyClose = nums[0];
  }

  return out;
}

/**
 * Robust stat extraction that does NOT depend on a specific "Other Functions" table layout.
 * We look for several known phrases the wiki uses.
 */
function extractStatsFromText(plain) {
  // Magazine size
  let magSize = null;
  let magSource = null;

  // Many pages have: "Magazine Ammo 40 120" (reserve after it)
  const magLine = findFieldValue(plain, "Magazine Ammo");
  if (magLine) {
    const nums = magLine.match(/\d+/g)?.map(Number) ?? [];
    if (nums.length >= 1) {
      magSize = nums[0];
      magSource = "Magazine Ammo";
    }
  }

  // Fallback: "Mag Size 40" or "Magazine 40"
  if (magSize === null) {
    const ms =
      findFirstNumberAfterLabel(plain, "Mag Size") ??
      findFirstNumberAfterLabel(plain, "Magazine") ??
      findFirstNumberAfterLabel(plain, "Magazine Size");
    if (typeof ms === "number" && Number.isFinite(ms)) {
      magSize = ms;
      magSource = "Mag Size (fallback)";
    }
  }

  // Reload
  let reloadSec = null;
  let reloadSource = null;

  // Common: "Reload Time 2.3"
  const rt =
    findFirstNumberAfterLabel(plain, "Reload Time") ??
    findFirstNumberAfterLabel(plain, "Reload") ??
    findFirstNumberAfterLabel(plain, "Reloading Time") ??
    findFirstNumberAfterLabel(plain, "Reload speed");
  if (typeof rt === "number" && Number.isFinite(rt)) {
    reloadSec = rt;
    reloadSource = "Reload Time";
  } else {
    // Some pages embed "(2.3s)" near reload
    const rp =
      findFirstNumberInParensAfterLabel(plain, "Reload") ??
      findFirstNumberInParensAfterLabel(plain, "Reload Time");
    if (typeof rp === "number" && Number.isFinite(rp)) {
      reloadSec = rp;
      reloadSource = "Reload (paren)";
    }
  }

  // Attack interval (seconds/shot) -> RPM
  let attackInterval = null;
  let attackIntervalSource = null;

  const ai =
    findFirstNumberAfterLabel(plain, "Attack Interval") ??
    findFirstNumberAfterLabel(plain, "Attack interval") ??
    findFirstNumberAfterLabel(plain, "Fire Interval") ??
    findFirstNumberAfterLabel(plain, "Shot Interval") ??
    findFirstNumberAfterLabel(plain, "Interval");
  if (typeof ai === "number" && Number.isFinite(ai) && ai > 0) {
    attackInterval = ai;
    attackIntervalSource = "Attack Interval";
  }

  // Sometimes the wiki has "Shots per second 12.5"
  let shotsPerSec = null;
  let shotsPerSecSource = null;
  const sps =
    findFirstNumberAfterLabel(plain, "Shots per second") ??
    findFirstNumberAfterLabel(plain, "Shots/sec") ??
    findFirstNumberAfterLabel(plain, "Shots / sec") ??
    findFirstNumberAfterLabel(plain, "Shots Per Second");
  if (typeof sps === "number" && Number.isFinite(sps) && sps > 0) {
    shotsPerSec = sps;
    shotsPerSecSource = "Shots per second";
  }

  // Time to empty magazine (seconds)
  let timeToEmpty = null;
  let timeToEmptySource = null;
  const tte =
    findFirstNumberAfterLabel(plain, "Time to empty") ??
    findFirstNumberAfterLabel(plain, "Time To Empty") ??
    findFirstNumberAfterLabel(plain, "Time to empty magazine") ??
    findFirstNumberAfterLabel(plain, "Time to Empty Magazine") ??
    findFirstNumberAfterLabel(plain, "Time to empty mag") ??
    findFirstNumberAfterLabel(plain, "Empty time") ??
    findFirstNumberAfterLabel(plain, "Time to empty the magazine");
  if (typeof tte === "number" && Number.isFinite(tte) && tte > 0) {
    timeToEmpty = tte;
    timeToEmptySource = "Time to empty";
  }

  // Direct RPM label
  let rpm = null;
  let rpmSource = null;

  // Some pages contain "### RPM"
  const mRpmInline = plain.match(/(\d{2,5})\s*RPM/i);
  if (mRpmInline) {
    const v = toNumOrNull(mRpmInline[1]);
    if (v !== null) {
      rpm = v;
      rpmSource = "RPM (inline)";
    }
  }

  // Or "Firing rate 12.5" (often in shots/sec)
  if (rpm === null) {
    const fr =
      findFirstNumberAfterLabel(plain, "Firing rate") ??
      findFirstNumberAfterLabel(plain, "Fire rate") ??
      findFirstNumberAfterLabel(plain, "Rate of Fire");
    if (typeof fr === "number" && Number.isFinite(fr) && fr > 0) {
      // If page says "Firing rate 12.5", it's likely shots/sec not rpm.
      // We only treat it as shots/sec if it looks small.
      if (fr <= 40) {
        shotsPerSec = shotsPerSec ?? fr;
        shotsPerSecSource = shotsPerSecSource ?? "Fire rate (as shots/sec)";
      } else {
        rpm = fr;
        rpmSource = "Fire rate (as RPM)";
      }
    }
  }

  return {
    magSize,
    magSource,
    reloadSec,
    reloadSource,
    attackInterval,
    attackIntervalSource,
    shotsPerSec,
    shotsPerSecSource,
    timeToEmpty,
    timeToEmptySource,
    rpm,
    rpmSource,
  };
}

function deriveRpm({
  rpm,
  rpmSource,
  attackInterval,
  shotsPerSec,
  timeToEmpty,
  magSize,
}) {
  if (rpm !== null && Number.isFinite(rpm) && rpm > 0) {
    return { rpm, rpmSource: rpmSource || "provided" };
  }

  // 1) From attackInterval (sec/shot)
  if (typeof attackInterval === "number" && Number.isFinite(attackInterval) && attackInterval > 0) {
    const derived = 60 / attackInterval;
    if (Number.isFinite(derived) && derived > 0) {
      return { rpm: derived, rpmSource: "derived: 60/attackInterval" };
    }
  }

  // 2) From shots/sec
  if (typeof shotsPerSec === "number" && Number.isFinite(shotsPerSec) && shotsPerSec > 0) {
    const derived = shotsPerSec * 60;
    if (Number.isFinite(derived) && derived > 0) {
      return { rpm: derived, rpmSource: "derived: shotsPerSec*60" };
    }
  }

  // 3) From time to empty mag
  if (
    typeof timeToEmpty === "number" &&
    Number.isFinite(timeToEmpty) &&
    timeToEmpty > 0 &&
    typeof magSize === "number" &&
    Number.isFinite(magSize) &&
    magSize > 0
  ) {
    const derived = (magSize / timeToEmpty) * 60;
    if (Number.isFinite(derived) && derived > 0) {
      return { rpm: derived, rpmSource: "derived: (magSize/timeToEmpty)*60" };
    }
  }

  return { rpm: null, rpmSource: null };
}

function deriveReload({ reloadSec, reloadSource }) {
  if (reloadSec !== null && Number.isFinite(reloadSec) && reloadSec > 0) {
    return { reloadSec, reloadSource: reloadSource || "provided" };
  }
  return { reloadSec: null, reloadSource: null };
}

function normalizeWeapon({ title, htmlText }) {
  const plain = stripTags(htmlText);

  // Main, readable fields
  const damageLine = findFieldValue(plain, "Damage");
  const firingModeLine = findFieldValue(plain, "Firing Mode");

  // Parse damage
  const rawRange = parseDamageLine(damageLine);

  // Normalize close-range damage
  const base =
    rawRange && typeof rawRange.bodyClose === "number" ? rawRange.bodyClose : null;

  const headMultiplier =
    rawRange &&
    typeof rawRange.bodyClose === "number" &&
    typeof rawRange.headClose === "number" &&
    rawRange.bodyClose > 0
      ? rawRange.headClose / rawRange.bodyClose
      : null;

  // Extract a bunch of possible stat sources
  const extracted = extractStatsFromText(plain);

  // Derive RPM more aggressively (but still purely mathematical / from page text)
  const { rpm, rpmSource } = deriveRpm({
    rpm: extracted.rpm,
    rpmSource: extracted.rpmSource,
    attackInterval: extracted.attackInterval,
    shotsPerSec: extracted.shotsPerSec,
    timeToEmpty: extracted.timeToEmpty,
    magSize: extracted.magSize,
  });

  // Derive reload
  const { reloadSec, reloadSource } = deriveReload({
    reloadSec: extracted.reloadSec,
    reloadSource: extracted.reloadSource,
  });

  const weapon = {
    id: slugifyId(title),
    name: title.replace(/_/g, " "),
    category: null,
    fireMode: normalizeFireMode(firingModeLine || ""),
    rpm,
    rpmSource,
    magSize: extracted.magSize,
    magSource: extracted.magSource,
    reloadSec,
    reloadSource,
    damage: {
      base,
      headMultiplier,
      rawRange,
      source: base !== null ? "close-range" : "unknown",
    },
    // Keep useful debug fields for us (not shown on UI)
    other: {
      attackInterval: extracted.attackInterval,
      attackIntervalSource: extracted.attackIntervalSource,
      shotsPerSec: extracted.shotsPerSec,
      shotsPerSecSource: extracted.shotsPerSecSource,
      timeToEmpty: extracted.timeToEmpty,
      timeToEmptySource: extracted.timeToEmptySource,
    },
  };

  // Valid if we got at least some meaningful numbers
  const valid =
    !!title &&
    (weapon.damage.base !== null ||
      weapon.magSize !== null ||
      weapon.reloadSec !== null ||
      weapon.rpm !== null ||
      weapon.other.attackInterval !== null ||
      weapon.other.shotsPerSec !== null);

  return { valid, weapon };
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchParsedHtmlForTitle(title) {
  const url =
    `${API}?action=parse&format=json&formatversion=2` +
    `&page=${encodeURIComponent(title)}` +
    `&prop=text&redirects=1`;

  const json = await fetchJson(url);
  const html = json?.parse?.text;
  if (!html) throw new Error(`No parse.text for "${title}"`);
  return html;
}

async function listAllWeaponTitlesFromCategory() {
  const titles = [];
  let cmcontinue = null;

  for (;;) {
    const url =
      `${API}?action=query&format=json&formatversion=2` +
      `&list=categorymembers&cmtitle=${encodeURIComponent("Category:Weapons")}` +
      `&cmlimit=500&cmnamespace=0` +
      (cmcontinue ? `&cmcontinue=${encodeURIComponent(cmcontinue)}` : "");

    const json = await fetchJson(url);
    const members = json?.query?.categorymembers ?? [];

    for (const m of members) {
      if (m?.title) titles.push(m.title);
    }

    cmcontinue = json?.continue?.cmcontinue ?? null;
    if (!cmcontinue) break;

    await sleep(350);
  }

  return Array.from(new Set(titles)).filter((t) => !isLikelyNonWeaponTitle(t));
}

async function ensureOutDir() {
  const dir = path.dirname(OUT_PATH);
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  console.log("Arsenal updater: listing weapon pages…");
  const titles = await listAllWeaponTitlesFromCategory();
  console.log(`Found ${titles.length} candidate pages after filtering.`);

  const weapons = [];
  const failures = [];

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];

    try {
      const html = await fetchParsedHtmlForTitle(title);
      const { valid, weapon } = normalizeWeapon({ title, htmlText: html });

      if (valid) weapons.push(weapon);
      else failures.push({ title, reason: "Missing expected stats" });
    } catch (e) {
      failures.push({ title, reason: String(e?.message || e) });
    }

    if (i % 10 === 0) console.log(`Processed ${i + 1}/${titles.length}…`);
    await sleep(180);
  }

  weapons.sort((a, b) => a.name.localeCompare(b.name));

  // Helpful counts for how much we filled
  const counts = {
    total: weapons.length,
    withBaseDamage: weapons.filter((w) => typeof w?.damage?.base === "number").length,
    withHeadMult: weapons.filter((w) => typeof w?.damage?.headMultiplier === "number").length,
    withMag: weapons.filter((w) => typeof w?.magSize === "number").length,
    withReload: weapons.filter((w) => typeof w?.reloadSec === "number").length,
    withRpm: weapons.filter((w) => typeof w?.rpm === "number").length,
    rpmDerived: weapons.filter((w) => typeof w?.rpm === "number" && String(w?.rpmSource || "").startsWith("derived:")).length,
    reloadDerived: weapons.filter((w) => typeof w?.reloadSec === "number" && String(w?.reloadSource || "").includes("(")).length,
  };

  const out = {
    version: 1,
    updatedAt: new Date().toISOString().slice(0, 10),
    source: {
      name: "Arsenal Wiki (Fandom)",
      url: `${WIKI_BASE}/wiki/Category:Weapons`,
    },
    notes: [
      "Generated by scripts/roblox/arsenal/updateWeapons.mjs",
      "Damage normalized to close-range base + headMultiplier when available.",
      "RPM is read if present; otherwise derived from attackInterval, shots/sec, or time-to-empty-mag when available.",
      "Reload time is read from the page when present; otherwise left blank (no guessing).",
    ],
    counts,
    weapons,
    _debug: {
      totalTitles: titles.length,
      parsedWeapons: weapons.length,
      failuresCount: failures.length,
      failures,
    },
  };

  await ensureOutDir();
  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2), "utf8");

  console.log(`✅ Wrote ${weapons.length} weapons to: ${OUT_PATH}`);
  console.log(`📊 Coverage:`, counts);
  console.log(`⚠️  Failures: ${failures.length} (see _debug.failures in the JSON)`);
}

main().catch((e) => {
  console.error("❌ Arsenal updater failed:", e);
  process.exit(1);
});
