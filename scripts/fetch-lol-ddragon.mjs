// scripts/lol-fetch.js (or whatever filename you use)
// ✅ FIXED: keeps full Data Dragon spell objects AND adds CommunityDragon spell data
// so Q/W/E/R damage variables like {{ qdamage }} actually resolve to real numbers.

import fs from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "data", "lol");

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "GamerStation (LoL data fetch)" },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
  return res.json();
}

function pickEnglishName(obj) {
  // CommunityDragon "name" can be an object of localized strings
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj.en_us || obj.en_US || obj.en || "";
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log("[lol:fetch] Fetching Riot versions...");
  const versions = await fetchJson(
    "https://ddragon.leagueoflegends.com/api/versions.json"
  );
  const version = versions[0];
  console.log("[lol:fetch] Using Riot patch:", version);

  console.log("[lol:fetch] Fetching Riot champion index...");
  const index = await fetchJson(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
  );

  const champs = Object.values(index.data).map((c) => ({
    id: c.id, // e.g., "Aatrox"
    key: c.key, // e.g., "266"
    name: c.name,
    title: c.title,
    tags: c.tags,
    partype: c.partype,
  }));

  console.log("[lol:fetch] Champions in index:", champs.length);

  const full = [];
  let i = 0;

  for (const c of champs) {
    i += 1;
    if (i % 10 === 0) console.log(`[lol:fetch] ${i}/${champs.length}...`);

    // --- Riot Data Dragon champion detail ---
    const detail = await fetchJson(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion/${c.id}.json`
    );
    const dd = Object.values(detail.data)[0];

    // --- CommunityDragon champion detail (has resolvable spell numbers) ---
    // Uses champion numeric key (e.g., 266.json)
    let cd = null;
    try {
      cd = await fetchJson(
        `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/${c.key}.json`
      );
    } catch (e) {
      // Don’t fail the whole build if CDragon misses a champ; just log it.
      console.warn(
        `[lol:fetch] WARN: CommunityDragon fetch failed for ${c.id} (${c.key})`
      );
      cd = null;
    }

    // Normalize CommunityDragon spells to a small, useful shape (optional)
    // Keeping the full object is fine too, but this makes the JSON lighter.
    const cdSpells =
      cd?.spells?.map((s) => ({
        // CDragon spell keys differ a bit by file, so keep a few identifiers:
        id: s?.spellKey || s?.name || "",
        key: s?.spellKey || "", // "q", "w", "e", "r" (commonly)
        name: pickEnglishName(s?.name),
        tooltip: pickEnglishName(s?.tooltip),
        // Raw values / calculations live here (varies by spell):
        // Keeping the entire "spell" object is the safest path:
        _raw: s,
      })) ?? null;

    full.push({
      // Base fields
      id: dd.id,
      key: dd.key,
      name: dd.name,
      title: dd.title,
      tags: dd.tags,
      partype: dd.partype,
      stats: dd.stats,

      // ✅ Keep FULL Data Dragon spells (do NOT prune)
      // Even if effect/effectBurn are 0, this includes names/tooltip/ranges/images etc.
      spells: dd.spells,

      // ✅ Keep passive too
      passive: dd.passive,

      // ✅ NEW: CommunityDragon data for ability math
      // Your client should prefer this for Q/W/E/R damage values.
      cdragon: cd
        ? {
            id: cd?.id ?? null,
            alias: cd?.alias ?? null,
            spells: cdSpells,
            // Also keep the raw champion object in case you want to compute from it later.
            // If you want lighter JSON, remove rawChampion below.
            rawChampion: cd,
          }
        : null,
    });
  }

  // Write files
  await fs.writeFile(
    path.join(OUT_DIR, "version.json"),
    JSON.stringify({ version }, null, 2)
  );

  await fs.writeFile(
    path.join(OUT_DIR, "champions_index.json"),
    JSON.stringify({ version, champions: champs }, null, 2)
  );

  await fs.writeFile(
    path.join(OUT_DIR, "champions_full.json"),
    JSON.stringify({ version, champions: full }, null, 2)
  );

  console.log("[lol:fetch] DONE ✅ saved to:", OUT_DIR);
  console.log(
    "[lol:fetch] champions_full.json size:",
    (await fs.stat(path.join(OUT_DIR, "champions_full.json"))).size,
    "bytes"
  );
}

main().catch((err) => {
  console.error("[lol:fetch] ERROR ❌", err);
  process.exit(1);
});
