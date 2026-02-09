// scripts/fix-blob-everything.mjs
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

// ✅ Put your Blob base here once so the codemod can rip out hardcoded URLs safely.
// (This does NOT get committed into code at runtime; it's only for rewrites.)
const KNOWN_BLOB_BASE =
  process.env.KNOWN_BLOB_BASE ||
  "https://or3vgdqybw6oou7j.public.blob.vercel-storage.com";

const EXT_OK = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "out",
  ".vercel",
  "coverage",
]);

// ✅ Files you want to be blob-managed on the client/server by URL.
// Add/remove as you wish.
const BLOB_MANAGED = [
  "data/lol/meta_builds_ranked.json",
  "data/lol/meta_builds_casual.json",
  "data/lol/champion_tiers.json",
  // If you blob leaderboards later, add patterns/paths here.
];

function normSlashes(p) {
  return p.replace(/\\/g, "/");
}

async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      out.push(...(await walk(path.join(dir, e.name))));
    } else {
      const ext = path.extname(e.name);
      if (!EXT_OK.has(ext)) continue;
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

function hasUseClient(src) {
  // allow whitespace/comments before "use client"
  return /^\s*["']use client["'];/m.test(src);
}

function ensureLibFiles() {
  const blobTs = `// lib/blob.ts
import fs from "node:fs/promises";
import path from "node:path";

function normalizePath(p: string) {
  return String(p ?? "").trim().replace(/^\\/+/, "");
}
function normalizeBase(b: string) {
  return String(b ?? "").trim().replace(/\\/+$/, "");
}

/**
 * Returns absolute public Blob URL if a base is configured.
 * Otherwise returns "/<pathname>".
 */
export function blobUrl(pathnameInput: string): string {
  const pathname = normalizePath(pathnameInput);
  if (!pathname) return "/";

  const base =
    process.env.BLOB_BASE_URL ||
    process.env.NEXT_PUBLIC_BLOB_BASE_URL ||
    "";

  if (!base) return \`/\${pathname}\`;
  return \`\${normalizeBase(base)}/\${pathname}\`;
}

export const blob = blobUrl;

/**
 * Disk-first in DEV → Blob fallback.
 * Blob-first in PROD (Vercel/production) → Disk fallback.
 *
 * This lets you keep local dev fast, while production pulls from Blob
 * for high-churn JSON.
 */
export async function readPublicJson<T = any>(pathnameInput: string): Promise<T> {
  const pathname = normalizePath(pathnameInput);
  if (!pathname) throw new Error("Invalid path");

  const hasBlobBase = Boolean(
    process.env.BLOB_BASE_URL || process.env.NEXT_PUBLIC_BLOB_BASE_URL
  );

  const preferBlob =
    hasBlobBase &&
    (process.env.VERCEL === "1" || process.env.NODE_ENV === "production");

  const localPath = path.join(process.cwd(), "public", pathname);
  const url = blobUrl(pathname);

  // 1) Blob first in prod
  if (preferBlob) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return (await res.json()) as T;
    } catch {
      // fall through
    }
  }

  // 2) Disk fallback
  try {
    const raw = await fs.readFile(localPath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    // fall through
  }

  // 3) Blob fallback (dev or disk missing)
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(\`Failed to load JSON from disk or Blob: \${pathname} (\${res.status})\`);
  }
  return (await res.json()) as T;
}
`;

  const blobClientTs = `// lib/blob-client.ts
function normalizePath(p: string) {
  return String(p ?? "").trim().replace(/^\\/+/, "");
}
function normalizeBase(b: string) {
  return String(b ?? "").trim().replace(/\\/+$/, "");
}

/**
 * Client-safe Blob URL builder (NO fs/node imports).
 * If no base is configured, returns "/<pathname>".
 */
export function blobUrl(pathnameInput: string): string {
  const pathname = normalizePath(pathnameInput);
  if (!pathname) return "/";

  // In the browser, Next exposes NEXT_PUBLIC_* only.
  const base =
    process.env.NEXT_PUBLIC_BLOB_BASE_URL ||
    process.env.BLOB_BASE_URL ||
    "";

  if (!base) return \`/\${pathname}\`;
  return \`\${normalizeBase(base)}/\${pathname}\`;
}

export const blob = blobUrl;
`;

  const blobFetchTs = `// lib/blob-fetch.ts
import { blobUrl } from "@/lib/blob";

export async function fetchPublicJson<T = any>(pathnameInput: string): Promise<T> {
  const url = blobUrl(pathnameInput);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(\`Failed to fetch: \${url} (\${res.status})\`);
  return (await res.json()) as T;
}
`;

  return { blobTs, blobClientTs, blobFetchTs };
}

function stripKnownBlobBaseToBlobUrl(src) {
  let changed = false;
  let out = src;

  // Replace hardcoded base: "https://.../data/xyz.json" -> blobUrl("data/xyz.json")
  const base = KNOWN_BLOB_BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hardcodedRe = new RegExp(
    `(["'\`])${base}/([^"'\`]+)\\1`,
    "g"
  );

  out = out.replace(hardcodedRe, (_m, quote, p1) => {
    changed = true;
    const clean = String(p1).replace(new RegExp("^/+"), "");


    return `blobUrl("${clean}")`;
  });

  return { out, changed };
}

function rewriteFetchesForBlobManaged(src) {
  let changed = false;
  let out = src;

  for (const p of BLOB_MANAGED) {
    const pEsc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // fetch("/data/lol/..json") OR fetch('data/lol/..json') -> fetch(blobUrl("data/lol/..json"))
    const re1 = new RegExp(`fetch\\(\\s*["']\\/?${pEsc}["']`, "g");
    out = out.replace(re1, `fetch(blobUrl("${p}")`);
    // safeFetchJson("/data/...") -> safeFetchJson(blobUrl("data/..."))
    const re2 = new RegExp(`safeFetchJson\\(<[^>]+>\\s*\\(\\s*["']\\/?${pEsc}["']\\s*\\)`, "g");
    out = out.replace(re2, (m) => {
      changed = true;
      return m.replace(/["'][^"']+["']/, `blobUrl("${p}")`);
    });

    // also catch safeFetchJson("...") without generics
    const re3 = new RegExp(`safeFetchJson\\(\\s*["']\\/?${pEsc}["']\\s*\\)`, "g");
    out = out.replace(re3, `safeFetchJson(blobUrl("${p}"))`);

    // For direct string assignment const url = "/data/..." -> const url = blobUrl("data/..")
    const re4 = new RegExp(`(["'])(\\/?${pEsc})\\1`, "g");
    // Only replace when it looks like a URL-ish constant (heuristic: near "URL" or "url")
    out = out.replace(re4, (m, _q, v, idx) => {
      const window = out.slice(Math.max(0, idx - 40), idx + m.length + 40);
      if (/\\b(url|URL|href|src)\\b/.test(window)) {
        changed = true;
        return `blobUrl("${String(v).replace(/^\\/+/, "")}")`;
      }
      return m;
    });

    if (out !== src) changed = true;
    src = out;
  }

  return { out, changed };
}

function fixBlobImports(src) {
  let changed = false;
  let out = src;

  const client = hasUseClient(out);

  // Remove double semicolon like: import { blobUrl } ... ; ;
  out = out.replace(/;\s*;\s*/g, ";\n");

  // If client component: ensure blobUrl import comes from blob-client
  // If server file: ensure blobUrl import comes from blob (or blob-fetch) — we standardize to "@/lib/blob"
  const want = client ? "@/lib/blob-client" : "@/lib/blob";

  // Replace any existing blobUrl import from wrong module
  out = out.replace(
    /import\s*\{\s*blobUrl\s*(?:,\s*blob\s*)?\}\s*from\s*["']@\/lib\/blob(?:-client)?["'];?/g,
    () => {
      changed = true;
      return `import { blobUrl } from "${want}";`;
    }
  );

  // If blobUrl is used but no import exists, add it near top (after "use client" if present).
  const usesBlobUrl = /\bblobUrl\s*\(/.test(out);
  const hasImportAlready = /import\s*\{\s*blobUrl\s*\}\s*from\s*["']@\/lib\/blob(?:-client)?["']/.test(out);

  if (usesBlobUrl && !hasImportAlready) {
    changed = true;
    if (client) {
      // insert after "use client";
      out = out.replace(
        /^(\s*["']use client["'];\s*)/m,
        `$1\nimport { blobUrl } from "${want}";\n`
      );
    } else {
      // insert at very top
      out = `import { blobUrl } from "${want}";\n` + out;
    }
  }

  return { out, changed };
}

async function writeFileSafe(fp, content) {
  await fs.writeFile(fp, content, "utf8");
}

async function backupOnce(fp) {
  const bak = fp + ".bak";
  try {
    await fs.access(bak);
    // already backed up
  } catch {
    const orig = await fs.readFile(fp, "utf8");
    await fs.writeFile(bak, orig, "utf8");
  }
}

async function main() {
  // 0) Ensure lib files exist + are correct
  const { blobTs, blobClientTs, blobFetchTs } = ensureLibFiles();
  const libDir = path.join(ROOT, "lib");
  await fs.mkdir(libDir, { recursive: true });

  const blobPath = path.join(libDir, "blob.ts");
  const blobClientPath = path.join(libDir, "blob-client.ts");
  const blobFetchPath = path.join(libDir, "blob-fetch.ts");

  // Backup existing if present, then overwrite
  for (const p of [blobPath, blobClientPath, blobFetchPath]) {
    try {
      await fs.access(p);
      await backupOnce(p);
    } catch {}
  }

  await writeFileSafe(blobPath, blobTs);
  await writeFileSafe(blobClientPath, blobClientTs);
  await writeFileSafe(blobFetchPath, blobFetchTs);

  console.log(`[ok] wrote lib/blob.ts (+.bak if existed)`);
  console.log(`[ok] wrote lib/blob-client.ts (+.bak if existed)`);
  console.log(`[ok] wrote lib/blob-fetch.ts (+.bak if existed)`);

  // 1) Walk & rewrite
  const files = await walk(ROOT);

  let touched = 0;

  for (const fp of files) {
    // skip generated lib files we just wrote
    const rel = normSlashes(path.relative(ROOT, fp));
    if (rel === "lib/blob.ts" || rel === "lib/blob-client.ts" || rel === "lib/blob-fetch.ts") continue;

    const src = await fs.readFile(fp, "utf8");
    let cur = src;
    let changed = false;

    // Replace hardcoded blob base URLs with blobUrl("path")
    {
      const r = stripKnownBlobBaseToBlobUrl(cur);
      cur = r.out;
      changed = changed || r.changed;
    }

    // Rewrite fetches for blob-managed JSON
    {
      const r = rewriteFetchesForBlobManaged(cur);
      cur = r.out;
      changed = changed || r.changed;
    }

    // Fix imports based on "use client"
    {
      const r = fixBlobImports(cur);
      cur = r.out;
      changed = changed || r.changed;
    }

    if (changed && cur !== src) {
      await backupOnce(fp);
      await fs.writeFile(fp, cur, "utf8");
      touched++;
      console.log(`[fix] ${rel}`);
    }
  }

  console.log("");
  console.log(`✅ Done. Touched ${touched} file(s). Backups saved as *.bak`);
  console.log("");
  console.log("NEXT STEPS:");
  console.log("1) Ensure Vercel env vars:");
  console.log("   - NEXT_PUBLIC_BLOB_BASE_URL = " + KNOWN_BLOB_BASE);
  console.log("   - BLOB_BASE_URL             = " + KNOWN_BLOB_BASE);
  console.log("2) Deploy (and disable build cache once).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
