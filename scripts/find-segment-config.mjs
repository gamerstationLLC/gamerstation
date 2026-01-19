import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "app");
const CONFIG_KEYS = new Set([
  "revalidate",
  "runtime",
  "dynamic",
  "dynamicParams",
  "fetchCache",
  "preferredRegion",
  "maxDuration",
]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(ent.name)) out.push(p);
  }
  return out;
}

const files = walk(ROOT);

let found = 0;

for (const file of files) {
  const txt = fs.readFileSync(file, "utf8");
  const lines = txt.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s*export\s+const\s+([A-Za-z0-9_]+)\s*=/);
    if (!m) continue;

    const key = m[1];
    if (!CONFIG_KEYS.has(key)) continue;

    found++;
    console.log(`${file}:${i + 1}  ${line.trim()}`);
  }
}

if (!found) {
  console.log("No segment config exports found under /app.");
}
