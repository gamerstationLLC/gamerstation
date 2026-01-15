// scripts/fetch-lol-items.mjs
import fs from "node:fs/promises";
import path from "node:path";

const OUT_PATH = path.join(process.cwd(), "public", "data", "lol", "items.json");
const SR_MAP_ID = "11"; // Summoner's Rift

async function getLatestPatch() {
  const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  if (!res.ok) throw new Error(`versions.json failed: ${res.status}`);
  const versions = await res.json();
  return versions[0]; // latest patch string
}

function isAllowedOnSR(item) {
  // Data Dragon:
  // - item.maps is an object like { "11": true, "12": false, ... }
  // - item.inStore false => removed/hidden/legacy (often causes duplicates/confusion)
  const allowedByMap = item.maps?.[SR_MAP_ID] !== false; // missing maps => treat as allowed
  const allowedInStore = item.inStore !== false;
  return allowedByMap && allowedInStore;
}

function buildFilteredData(dataObj) {
  // dataObj is json.data: { [itemId]: item }
  const out = {};
  for (const [id, item] of Object.entries(dataObj || {})) {
    if (!item) continue;
    if (!isAllowedOnSR(item)) continue;
    out[id] = item;
  }
  return out;
}

async function main() {
  const patch = await getLatestPatch();

  const url = `https://ddragon.leagueoflegends.com/cdn/${patch}/data/en_US/item.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`item.json failed: ${res.status}`);

  const json = await res.json();

  // ✅ SR-only filter happens here
  const filtered = {
    ...json,
    data: buildFilteredData(json.data),
    // optional: keep a hint in the file so you remember later
    gamerstation_meta: {
      mode: "summoners_rift",
      mapId: SR_MAP_ID,
      filtered_out_inStore_false: true,
    },
  };

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(
    OUT_PATH,
    JSON.stringify({ version: patch, ...filtered }, null, 2),
    "utf-8"
  );

  console.log(`✅ Saved SR-only items -> ${OUT_PATH} (patch ${patch})`);
  console.log(`Items (raw): ${Object.keys(json.data || {}).length}`);
  console.log(`Items (SR filtered): ${Object.keys(filtered.data || {}).length}`);
}

main().catch((e) => {
  console.error("❌ fetch-lol-items failed:", e);
  process.exit(1);
});
