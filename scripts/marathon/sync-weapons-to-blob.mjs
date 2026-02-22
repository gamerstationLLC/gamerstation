import { put } from "@vercel/blob";

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!TOKEN) throw new Error("Missing env var: BLOB_READ_WRITE_TOKEN");

// Upstream (GitHub raw)
const SOURCE =
  "https://raw.githubusercontent.com/lax20attack/marathon-manifest/main/data/weapons.json";

// Where YOU will store it in your Blob
const OUT_PATH = "data/marathon/weapons_raw.json";

async function main() {
  console.log("Fetching:", SOURCE);

  const res = await fetch(SOURCE, {
    headers: { "User-Agent": "GamerStation" },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

  const data = await res.json();

  const payload = {
    source: SOURCE,
    fetchedAt: new Date().toISOString(),
    data,
  };

  await put(OUT_PATH, JSON.stringify(payload), {
    access: "public",
    token: TOKEN,
    contentType: "application/json",
  });

  console.log("Uploaded to Blob:", OUT_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});