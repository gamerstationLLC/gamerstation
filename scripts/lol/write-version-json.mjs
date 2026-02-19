import fs from "node:fs/promises";
import path from "node:path";

const PATCH_NOTES_INDEX =
  "https://www.leagueoflegends.com/en-us/news/tags/patch-notes/";
const DDRAGON_VERSIONS = "https://ddragon.leagueoflegends.com/api/versions.json";

async function fetchLatestPatchNotesNumber() {
  const res = await fetch(PATCH_NOTES_INDEX, {
    cache: "no-store",
    headers: { "user-agent": "gamerstation-lol-patch/1.0" },
  });
  if (!res.ok) throw new Error(`Patch notes index HTTP ${res.status}`);
  const html = await res.text();

  // First visible match on the page is usually the latest patch notes card
  const m = html.match(/Patch\s+(\d+\.\d+)\b/i);
  return m?.[1] ?? null;
}

async function fetchLatestDdragonVersion() {
  const res = await fetch(DDRAGON_VERSIONS, {
    cache: "no-store",
    headers: { "user-agent": "gamerstation-lol-patch/1.0" },
  });
  if (!res.ok) throw new Error(`DDragon versions HTTP ${res.status}`);
 const versions = await res.json();

if (!Array.isArray(versions) || typeof versions[0] !== "string") {
  throw new Error("Unexpected ddragon versions.json shape");
}
return String(versions[0]).trim();

}

async function main() {
  const [patch, ddragon] = await Promise.all([
    fetchLatestPatchNotesNumber(),
    fetchLatestDdragonVersion(),
  ]);

  if (!patch) throw new Error("Could not parse patch number from patch notes index");
  if (!ddragon) throw new Error("Could not read latest ddragon version");

  const payload = {
    // ✅ what you SHOW users
    patch, // e.g. "26.4"

    // ✅ what you use for CDN champion JSON/images
    ddragon, // e.g. "16.4.1"

    // (optional legacy aliases; keep if other code expects them)
    version: patch,

    updatedAt: new Date().toISOString(),
    source: "patch-notes-index + ddragon-versions",
  };

  const outPath = path.join(process.cwd(), "public", "data", "lol", "version.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2) + "\n", "utf-8");

  console.log("Wrote version.json:", payload);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
