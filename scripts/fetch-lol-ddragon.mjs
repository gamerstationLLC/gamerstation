// scripts/lol-fetch.js
// ✅ FIXED: keeps full Data Dragon spell objects AND adds CommunityDragon spell data
// ✅ FIXED: does NOT overwrite public/data/lol/version.json (your display patch file)
// Instead writes public/data/lol/ddragon.json for the real Data Dragon asset version.

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
  const versions = await fetchJson("https://ddragon.leagueoflegends.com/api/versions.json");
  const ddragon = String(versions?.[0] ?? "").trim();
  if (!ddragon) throw new Error("Failed to read Data Dragon version");
  console.log("[lol:fetch] Using Data Dragon version:", ddragon);

  console.log("[lol:fetch] Fetching Riot champion index...");
  const index = await fetchJson(
    `https://ddragon.leagueoflegends.com/cdn/${ddragon}/data/en_US/champion.json`
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
      `https://ddragon.leagueoflegends.com/cdn/${ddragon}/data/en_US/champion/${c.id}.json`
    );
    const dd = Object.values(detail.data)[0];

    // --- CommunityDragon champion detail (has resolvable spell numbers) ---
    let cd = null;
    try {
      cd = await fetchJson(
        `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/${c.key}.json`
      );
    } catch {
      console.warn(
        `[lol:fetch] WARN: CommunityDragon fetch failed for ${c.id} (${c.key})`
      );
      cd = null;
    }

    const cdSpells =
      cd?.spells?.map((s) => ({
        id: s?.spellKey || s?.name || "",
        key: s?.spellKey || "",
        name: pickEnglishName(s?.name),
        tooltip: pickEnglishName(s?.tooltip),
        _raw: s,
      })) ?? null;

    full.push({
      id: dd.id,
      key: dd.key,
      name: dd.name,
      title: dd.title,
      tags: dd.tags,
      partype: dd.partype,
      stats: dd.stats,

      // ✅ Keep FULL Data Dragon spells
      spells: dd.spells,
      passive: dd.passive,

      // ✅ Helpful metadata
      ddragon,

      // ✅ CommunityDragon add-on
      cdragon: cd
        ? {
            id: cd?.id ?? null,
            alias: cd?.alias ?? null,
            spells: cdSpells,
            rawChampion: cd,
          }
        : null,
    });
  }

  // ✅ Write ddragon version to its own file (DO NOT overwrite version.json)
  await fs.writeFile(
    path.join(OUT_DIR, "ddragon.json"),
    JSON.stringify({ ddragon, updatedAt: new Date().toISOString() }, null, 2) + "\n"
  );

  await fs.writeFile(
    path.join(OUT_DIR, "champions_index.json"),
    JSON.stringify({ ddragon, champions: champs }, null, 2) + "\n"
  );

  await fs.writeFile(
    path.join(OUT_DIR, "champions_full.json"),
    JSON.stringify({ ddragon, champions: full }, null, 2) + "\n"
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