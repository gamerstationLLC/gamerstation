// scripts/wow/build-item-db.ts
//
// Build a full searchable WoW Item DB (index + chunked packs) from Blizzard Game Data API.
// ✅ Regionless UX: hardcode US host + static-us namespace
// ✅ Dynamic smart filtering: keep items in a window of (maxIlvl - window)
// ✅ Avoid garbage: requiredLevel >= minReqLevel, allowed qualities, equippable only
//
// Env (server-only):
//   BNET_CLIENT_ID
//   BNET_CLIENT_SECRET
//
// Output (default):
//   public/data/wow/items/index.json
//   public/data/wow/items/packs/items.pack.000.json
//   ...
//
// Usage:
//   npx tsx scripts/wow/build-item-db.ts
//
// Flags:
//   --out public/data/wow/items
//   --locale en_US
//   --pageSize 100
//   --maxPages 999999
//   --packSize 500
//   --sleepMs 35
//   --resumeFromId 0
//   --onlyEquippable true
//   --logEvery 250
//
// Smart filters:
//   --minReqLevel 70
//   --allowedQualities rare,epic,legendary
//   --ilvlWindow 40        (keeps ilvl >= maxIlvl - 40; set 0 to disable)
//   --allowedSlots HEAD,NECK,... (optional; if omitted, keep any inventory_type)

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

type Args = {
  outDir: string;
  locale: string;
  pageSize: number;
  maxPages: number;
  packSize: number;
  sleepMs: number;
  resumeFromId: number;
  onlyEquippable: boolean;
  logEvery: number;

  // filters
  minReqLevel: number;
  allowedQualities: Set<string> | null; // normalized lower
  ilvlWindow: number; // 0 disables
  allowedSlots: Set<string> | null; // inventory_type.type normalized upper
};

function getArg(flag: string) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}
function getBool(flag: string, def: boolean) {
  const v = getArg(flag);
  if (v == null) return def;
  return v === "true" || v === "1" || v === "yes";
}
function getNum(flag: string, def: number) {
  const v = getArg(flag);
  if (v == null) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function getCsvSet(flag: string, kind: "lower" | "upper"): Set<string> | null {
  const v = getArg(flag);
  if (!v) return null;
  const parts = v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (kind === "lower" ? s.toLowerCase() : s.toUpperCase()));
  return parts.length ? new Set(parts) : null;
}

function requireEnv(key: string) {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}
async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}
async function writeJson(filePath: string, data: unknown) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}
async function sleep(ms: number) {
  if (!ms) return;
  await new Promise((r) => setTimeout(r, ms));
}

async function getAccessTokenUS(clientId: string, clientSecret: string) {
  const tokenUrl = `https://us.battle.net/oauth/token`;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token HTTP ${res.status}: ${text.slice(0, 800)}`);
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("No access_token returned");
  return json.access_token;
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url}\n${text.slice(0, 800)}`);
  }
  return (await res.json()) as T;
}

function safeStr(x: any): string | undefined {
  return typeof x === "string" ? x : undefined;
}
function safeNum(x: any): number | undefined {
  return typeof x === "number" && Number.isFinite(x) ? x : undefined;
}
function normName(s: string) {
  return s
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function tokenize(s: string) {
  const n = normName(s);
  if (!n) return [];
  return Array.from(new Set(n.split(" ").filter(Boolean)));
}

type SearchItemRow = { data: { id: number } };
type SearchResponse = { pageCount?: number; results?: SearchItemRow[] };

type ItemIndexRow = {
  id: number;
  name: string;
  nameNorm: string;
  tokens: string[];

  quality?: string;
  itemClass?: string;
  itemSubclass?: string;

  inventoryType?: string; // human name
  inventoryTypeKey?: string; // machine type (e.g., "HEAD", "TRINKET")
  isEquippable: boolean;

  itemLevel?: number;
  requiredLevel?: number;

  pack: number;
};

type PackedItem = { id: number; detail: any };

function isEquippable(detail: any): boolean {
  const invName = safeStr(detail?.inventory_type?.name);
  const invType = safeStr(detail?.inventory_type?.type);
  return !!((invName && invName.trim()) || (invType && invType.trim()));
}

function qualityKeyLower(detail: any): string | null {
  const t = safeStr(detail?.quality?.type);
  const n = safeStr(detail?.quality?.name);
  const k = (t ?? n ?? "").toLowerCase();
  return k || null;
}

function inventoryTypeKeyUpper(detail: any): string | null {
  const t = safeStr(detail?.inventory_type?.type);
  // sometimes only "name" exists; keep null in that case
  return t ? t.toUpperCase() : null;
}

function sha1(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

async function main() {
  const args: Args = {
    outDir: getArg("--out") ?? "public/data/wow/items",
    locale: getArg("--locale") ?? "en_US",
    pageSize: getNum("--pageSize", 100),
    maxPages: getNum("--maxPages", 999999),
    packSize: getNum("--packSize", 500),
    sleepMs: getNum("--sleepMs", 35),
    resumeFromId: getNum("--resumeFromId", 0),
    onlyEquippable: getBool("--onlyEquippable", true),
    logEvery: getNum("--logEvery", 250),

    minReqLevel: getNum("--minReqLevel", 70),
    allowedQualities: getCsvSet("--allowedQualities", "lower"),
    ilvlWindow: getNum("--ilvlWindow", 40),
    allowedSlots: getCsvSet("--allowedSlots", "upper"),
  };

  const clientId = requireEnv("BNET_CLIENT_ID");
  const clientSecret = requireEnv("BNET_CLIENT_SECRET");

  // Regionless UX: hardcode US Game Data host + static-us namespace.
  const API_BASE = "https://us.api.blizzard.com";
  const NAMESPACE = "static-us";

  const token = await getAccessTokenUS(clientId, clientSecret);

  const outDir = args.outDir;
  const packsDir = path.join(outDir, "packs");
  await ensureDir(packsDir);

  // Temp stash for this run so we can apply dynamic ilvlWindow AFTER we know max ilvl.
  // This prevents writing a bunch of packs then realizing they should be filtered out.
  const tmpDir = path.join(outDir, ".tmp_run");
  const tmpItemsPath = path.join(tmpDir, "items.ndjson");
  await ensureDir(tmpDir);

  // wipe temp file
  await fs.writeFile(tmpItemsPath, "", "utf8");

  let fetched = 0;
  let keptCandidates = 0;
  let maxIlvl = 0;

  // Search pages
  let page = 1;

  // Light “run key” for index meta
  const runKey = sha1(`${API_BASE}|${NAMESPACE}|${args.locale}|${args.minReqLevel}|${[...((args.allowedQualities ?? new Set()).values())].join(",")}|${args.ilvlWindow}|${[...((args.allowedSlots ?? new Set()).values())].join(",")}`);

  while (page <= args.maxPages) {
    const searchUrl =
      `${API_BASE}/data/wow/search/item` +
      `?namespace=${encodeURIComponent(NAMESPACE)}` +
      `&locale=${encodeURIComponent(args.locale)}` +
      `&_page=${page}` +
      `&_pageSize=${args.pageSize}`;

    const sr = await fetchJson<SearchResponse>(searchUrl, token);
    const results = Array.isArray(sr.results) ? sr.results : [];
    if (results.length === 0) break;

    for (const r of results) {
      const id = safeNum(r?.data?.id);
      if (!id) continue;
      if (id <= args.resumeFromId) continue;

      const detailUrl =
        `${API_BASE}/data/wow/item/${id}` +
        `?namespace=${encodeURIComponent(NAMESPACE)}` +
        `&locale=${encodeURIComponent(args.locale)}`;

      let detail: any;
      try {
        detail = await fetchJson<any>(detailUrl, token);
      } catch (e: any) {
        if (fetched % args.logEvery === 0) {
          console.warn(`⚠️ item ${id} fetch failed: ${e?.message ?? e}`);
        }
        await sleep(args.sleepMs);
        continue;
      }

      fetched += 1;

      const equippable = isEquippable(detail);
      if (args.onlyEquippable && !equippable) {
        await sleep(args.sleepMs);
        continue;
      }

      const invKey = inventoryTypeKeyUpper(detail);
      if (args.allowedSlots && invKey && !args.allowedSlots.has(invKey)) {
        await sleep(args.sleepMs);
        continue;
      }

      const reqLevel = safeNum(detail?.required_level) ?? 0;
      if (args.minReqLevel > 0 && reqLevel < args.minReqLevel) {
        await sleep(args.sleepMs);
        continue;
      }

      const qKey = qualityKeyLower(detail);
      if (args.allowedQualities && qKey && !args.allowedQualities.has(qKey)) {
        await sleep(args.sleepMs);
        continue;
      }
      // If allowedQualities is set but qKey is missing, drop it (keeps DB cleaner)
      if (args.allowedQualities && !qKey) {
        await sleep(args.sleepMs);
        continue;
      }

      const ilvl = safeNum(detail?.level) ?? safeNum(detail?.item_level) ?? 0;
      if (ilvl > maxIlvl) maxIlvl = ilvl;

      // store candidate (NDJSON) so phase 2 can filter by ilvlWindow without re-fetching
      await fs.appendFile(tmpItemsPath, JSON.stringify({ id, ilvl, detail }) + "\n", "utf8");
      keptCandidates += 1;

      if (fetched % args.logEvery === 0) {
        console.log(`✅ scanned ${fetched} items... candidates kept ${keptCandidates} (page ${page}) maxIlvl=${maxIlvl}`);
      }

      await sleep(args.sleepMs);
    }

    page += 1;

    const pageCount = safeNum(sr.pageCount);
    if (pageCount && page > pageCount) break;
  }

  if (keptCandidates === 0) {
    console.log("⚠️ No candidates matched filters. Nothing to write.");
    return;
  }

  const minKeepIlvl =
    args.ilvlWindow > 0 ? Math.max(0, maxIlvl - args.ilvlWindow) : 0;

  console.log(`🔎 Phase 2: writing final DB (ilvlWindow=${args.ilvlWindow}, keep ilvl >= ${minKeepIlvl})`);

  // Phase 2: read NDJSON and write packs + index
  const index: ItemIndexRow[] = [];
  let currentPack: PackedItem[] = [];
  let packNo = 0;
  let written = 0;

  async function flushPack() {
    if (currentPack.length === 0) return;
    const packPath = path.join(packsDir, `items.pack.${String(packNo).padStart(3, "0")}.json`);
    await writeJson(packPath, currentPack);
    currentPack = [];
    packNo += 1;
  }

  const nd = await fs.readFile(tmpItemsPath, "utf8");
  const lines = nd.split("\n").filter(Boolean);

  for (const line of lines) {
    let row: any;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }

    const id = safeNum(row?.id);
    const ilvl = safeNum(row?.ilvl) ?? 0;
    const detail = row?.detail;
    if (!id || !detail) continue;

    if (args.ilvlWindow > 0 && ilvl < minKeepIlvl) continue;

    const name =
      safeStr(detail?.name) ??
      safeStr(detail?.name?.[args.locale]) ??
      safeStr(detail?.name?.en_US) ??
      `Item ${id}`;

    const invName = safeStr(detail?.inventory_type?.name);
    const invKey = inventoryTypeKeyUpper(detail) ?? undefined;

    const quality = safeStr(detail?.quality?.name) ?? safeStr(detail?.quality?.type);
    const itemClass = safeStr(detail?.item_class?.name) ?? safeStr(detail?.item_class?.type);
    const itemSubclass = safeStr(detail?.item_subclass?.name) ?? safeStr(detail?.item_subclass?.type);
    const reqLevel = safeNum(detail?.required_level);

    const nameNorm = normName(name);
    const tokens = tokenize(name);

    index.push({
      id,
      name,
      nameNorm,
      tokens,
      quality,
      itemClass,
      itemSubclass,
      inventoryType: invName,
      inventoryTypeKey: invKey,
      isEquippable: true,
      itemLevel: ilvl || undefined,
      requiredLevel: reqLevel,
      pack: packNo,
    });

    currentPack.push({ id, detail });
    written += 1;

    if (currentPack.length >= args.packSize) {
      await flushPack();
    }
  }

  await flushPack();

  const meta = {
    version: "wow-items-db-v2",
    builtAt: new Date().toISOString(),
    runKey,
    locale: args.locale,
    namespace: NAMESPACE,
    apiBase: API_BASE,

    // filters
    minReqLevel: args.minReqLevel,
    allowedQualities: args.allowedQualities ? Array.from(args.allowedQualities) : null,
    allowedSlots: args.allowedSlots ? Array.from(args.allowedSlots) : null,
    ilvlWindow: args.ilvlWindow,
    maxIlvlFound: maxIlvl,
    minKeptIlvl: minKeepIlvl,

    // output
    pageSize: args.pageSize,
    packSize: args.packSize,
    candidatesScanned: keptCandidates,
    totalItems: index.length,
    packs: packNo,
  };

  await writeJson(path.join(outDir, "index.json"), { meta, items: index });

  // cleanup temp
  await fs.rm(tmpDir, { recursive: true, force: true });

  console.log("✅ Done.");
  console.log(`   Scanned candidates: ${keptCandidates}`);
  console.log(`   Max ilvl found:     ${maxIlvl}`);
  console.log(`   Kept ilvl >=        ${minKeepIlvl}`);
  console.log(`   Items written:      ${written}`);
  console.log(`   Packs:              ${packNo}`);
  console.log(`   Out:                ${outDir}`);
}

main().catch((err) => {
  console.error("❌ build-item-db failed:", err?.message ?? err);
  process.exit(1);
});
