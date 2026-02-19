import fs from "node:fs/promises";
import path from "node:path";

const PATCH_NOTES_INDEX = "https://www.leagueoflegends.com/en-us/news/tags/patch-notes/";

async function fetchLatestPatchNotesNumber() {
  const res = await fetch(PATCH_NOTES_INDEX, {
    cache: "no-store",
    headers: { "user-agent": "gamerstation-lol-patch/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const m = html.match(/Patch\s+(\d+\.\d+)\b/i);
  return m?.[1] ?? null;
}

async function main() {
  const patch = await fetchLatestPatchNotesNumber();
  if (!patch) throw new Error("Could not parse patch number");

  const payload = {
    patch,
    version: patch, // 🔥 version now equals 26.x
    updatedAt: new Date().toISOString(),
    source: "patch-notes-index",
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
