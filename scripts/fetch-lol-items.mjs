// scripts/fetch-lol-items.mjs
import fs from "node:fs/promises";
import path from "node:path";

const OUT_PATH = path.join(process.cwd(), "data", "lol", "items.json");

async function getLatestPatch() {
  const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  if (!res.ok) throw new Error(`versions.json failed: ${res.status}`);
  const versions = await res.json();
  return versions[0]; // latest patch string
}

async function main() {
  const patch = await getLatestPatch();

  const url = `https://ddragon.leagueoflegends.com/cdn/${patch}/data/en_US/item.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`item.json failed: ${res.status}`);

  const json = await res.json();

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(
    OUT_PATH,
    JSON.stringify({ version: patch, ...json }, null, 2),
    "utf-8"
  );

  console.log(`✅ Saved items -> ${OUT_PATH} (patch ${patch})`);
  console.log(`Items: ${Object.keys(json.data || {}).length}`);
}

main().catch((e) => {
  console.error("❌ fetch-lol-items failed:", e);
  process.exit(1);
});
