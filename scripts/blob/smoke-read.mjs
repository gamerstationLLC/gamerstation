// scripts/blob/smoke-read.mjs
const base = process.env.NEXT_PUBLIC_BLOB_BASE_URL || process.env.BLOB_BASE_URL;
if (!base) {
  console.error("Missing NEXT_PUBLIC_BLOB_BASE_URL / BLOB_BASE_URL");
  process.exit(1);
}

const path = process.argv[2] || "data/wow/items/index.json";
const url = `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

console.log("URL:", url);

const res = await fetch(url, { cache: "no-store" });
console.log("Status:", res.status);

if (!res.ok) {
  const txt = await res.text().catch(() => "");
  console.log("Body (first 200):", txt.slice(0, 200));
  process.exit(1);
}

const json = await res.json();
console.log("JSON keys:", Object.keys(json).slice(0, 20));
console.log("OK ✅");
