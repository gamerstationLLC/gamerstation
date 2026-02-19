// scripts/blob/upload-spells-overrides.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

const LOCAL_PATH =
  process.env.SPELLS_OVERRIDES_LOCAL_PATH ||
  path.join(process.cwd(), "public", "data", "lol", "spells_overrides.json");

const BLOB_PATH =
  process.env.SPELLS_OVERRIDES_BLOB_PATH || "data/lol/spells_overrides.json";

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error("Missing BLOB_READ_WRITE_TOKEN env var.");
    process.exit(1);
  }

  const buf = await fs.readFile(LOCAL_PATH);

  // quick sanity: ensure it's valid JSON
  JSON.parse(buf.toString("utf-8"));

  const res = await put(BLOB_PATH, buf, {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    token,
  });

  console.log("✅ Uploaded spells overrides to Blob:");
  console.log("Path:", BLOB_PATH);
  console.log("URL :", res.url);
}

main().catch((err) => {
  console.error("❌ Upload failed:", err?.message ?? err);
  process.exit(1);
});
