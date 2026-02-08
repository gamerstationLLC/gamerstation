import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const clientId = process.env.BLIZZARD_CLIENT_ID;
const clientSecret = process.env.BLIZZARD_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Missing BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET in .env.local");
  process.exit(1);
}

type ItemIndexRow = {
  id: number;
  name: string;
  slot?: string; // inventory_type.type
  ilvl?: number; // item.level
};

type NormStatKey =
  | "str"
  | "agi"
  | "int"
  | "sta"
  | "crit"
  | "haste"
  | "mastery"
  | "vers"
  | "leech"
  | "avoid"
  | "speed";

type NormStats = Partial<Record<NormStatKey, number>>;

type ItemDetailsRow = ItemIndexRow & {
  quality?: string;
  item_class?: string;
  item_subclass?: string;

  /**
   * ✅ Human-friendly normalized stats for UI + scoring.
   * Example:
   * { agi: 412, crit: 287, haste: 190, mastery: 0, vers: 133 }
   */
  stats?: NormStats;

  /**
   * ✅ Keep raw stats too (optional, but nice for debugging/regeneration)
   * Blizzard preview_item.stats -> [{type,value}]
   */
  stats_raw?: Array<{ type: string; value: number }>;

  required_level?: number;
};

const REGION = "us";
const LOCALE = "en_US";
const NAMESPACE = `static-${REGION}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

async function getToken(): Promise<string> {
  const res = await fetch(`https://${REGION}.battle.net/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Token request failed: ${res.status} ${t}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

async function apiJson(url: string, token: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GET ${url} failed: ${res.status} ${t}`);
  }
  return res.json();
}

async function getJournalInstanceIndex(token: string) {
  const url = `https://${REGION}.api.blizzard.com/data/wow/journal-instance/index?namespace=${NAMESPACE}&locale=${LOCALE}`;
  return apiJson(url, token);
}

async function getInstanceDetail(token: string, instanceId: number) {
  const url = `https://${REGION}.api.blizzard.com/data/wow/journal-instance/${instanceId}?namespace=${NAMESPACE}&locale=${LOCALE}`;
  return apiJson(url, token);
}

async function getEncounterDetail(token: string, encounterId: number) {
  const url = `https://${REGION}.api.blizzard.com/data/wow/journal-encounter/${encounterId}?namespace=${NAMESPACE}&locale=${LOCALE}`;
  return apiJson(url, token);
}

async function pickLatestRaidInstanceId(
  token: string
): Promise<{ id: number; name?: string } | null> {
  const index = await getJournalInstanceIndex(token);
  const instances: Array<{ id: number; name?: string }> = index.instances ?? [];
  if (!instances.length) return null;

  const raids: Array<{ id: number; name?: string }> = [];

  // We must look up each instance to know its category.
  for (const inst of instances) {
    try {
      const detail = await getInstanceDetail(token, inst.id);
      const cat = String(detail?.category?.type ?? "").toUpperCase();
      const encounters = Array.isArray(detail?.encounters) ? detail.encounters : [];
      if (cat === "RAID" && encounters.length > 0) {
        raids.push({ id: inst.id, name: detail?.name ?? inst.name });
      }
    } catch {
      // ignore
    }
  }

  if (!raids.length) return null;

  // pick highest ID among raids
  raids.sort((a, b) => b.id - a.id);
  return raids[0];
}

async function collectLootItemIdsFromInstance(
  token: string,
  instanceId: number
): Promise<number[]> {
  const detail = await getInstanceDetail(token, instanceId);
  const encounterRefs: Array<{ id: number }> = detail.encounters ?? [];
  const itemIds: number[] = [];

  for (const e of encounterRefs) {
    try {
      const enc = await getEncounterDetail(token, e.id);
      const items = enc.items ?? [];
      for (const it of items) {
        const itemId = it?.item?.id;
        if (typeof itemId === "number") itemIds.push(itemId);
      }
    } catch {
      // ignore encounter failures
    }
  }

  return uniq(itemIds);
}

async function collectDungeonItemIds(
  token: string,
  raidInstanceId: number | null
): Promise<number[]> {
  const index = await getJournalInstanceIndex(token);
  const instances: Array<{ id: number; name?: string }> = index.instances ?? [];
  if (!instances.length) return [];

  const allItemIds: number[] = [];

  for (const inst of instances) {
    if (raidInstanceId && inst.id === raidInstanceId) continue;

    try {
      const detail = await getInstanceDetail(token, inst.id);
      const cat = String(detail?.category?.type ?? "").toUpperCase();

      // Keep only actual dungeons.
      if (!cat.includes("DUNGEON")) continue;

      const ids = await collectLootItemIdsFromInstance(token, inst.id);

      // Only keep instances that actually drop loot via journal items
      if (ids.length > 0) {
        allItemIds.push(...ids);
        console.log(`Dungeon: ${detail?.name ?? inst.name ?? inst.id} → ${ids.length} item IDs`);
      }
    } catch {
      // ignore
    }
  }

  return uniq(allItemIds);
}

/* ============================
   ✅ Stat normalization helpers
============================ */
function addStat(out: NormStats, k: NormStatKey, v: number) {
  out[k] = (out[k] ?? 0) + v;
}

function normalizeStatsFromBlizzard(
  raw: Array<{ type?: string; value?: number }> | undefined
): NormStats {
  const out: NormStats = {};

  for (const s of raw ?? []) {
    const t = String(s?.type ?? "").toUpperCase();
    const v = Number(s?.value ?? 0);
    if (!Number.isFinite(v) || v === 0) continue;

    // Blizzard preview_item.stats "type.type" strings:
    // STRENGTH, AGILITY, INTELLECT, STAMINA,
    // CRIT_RATING, HASTE_RATING, MASTERY_RATING, VERSATILITY,
    // plus tertiary: LEECH, AVOIDANCE, SPEED
    if (t === "STRENGTH") addStat(out, "str", v);
    else if (t === "AGILITY") addStat(out, "agi", v);
    else if (t === "INTELLECT") addStat(out, "int", v);
    else if (t === "STAMINA") addStat(out, "sta", v);
    else if (t.includes("CRIT")) addStat(out, "crit", v);
    else if (t.includes("HASTE")) addStat(out, "haste", v);
    else if (t.includes("MASTERY")) addStat(out, "mastery", v);
    else if (t.includes("VERSATILITY") || t === "VERSATILITY") addStat(out, "vers", v);
    else if (t.includes("LEECH")) addStat(out, "leech", v);
    else if (t.includes("AVOID")) addStat(out, "avoid", v);
    else if (t === "SPEED" || t.includes("SPEED")) addStat(out, "speed", v);
    // else: ignore unknown stats for now
  }

  return out;
}

async function fetchItemDetails(token: string, itemId: number): Promise<ItemDetailsRow> {
  const url = `https://${REGION}.api.blizzard.com/data/wow/item/${itemId}?namespace=${NAMESPACE}&locale=${LOCALE}`;
  const item = await apiJson(url, token);

  const stats_raw: Array<{ type: string; value: number }> =
    item.preview_item?.stats?.map((s: any) => ({
      type: String(s.type?.type ?? ""),
      value: Number(s.value ?? 0),
    })) ?? [];

  const stats = normalizeStatsFromBlizzard(stats_raw);

  return {
    id: item.id,
    name: item.name,
    slot: item.inventory_type?.type,
    ilvl: item.level,
    quality: item.quality?.type,
    item_class: item.item_class?.name,
    item_subclass: item.item_subclass?.name,

    // ✅ normalized for UI/scoring
    stats,

    // ✅ keep raw too (optional)
    stats_raw,

    required_level: item.required_level,
  };
}

async function main() {
  const token = await getToken();

  // 1) Pick latest RAID properly
  const raidPicked = await pickLatestRaidInstanceId(token);
  const raidId = raidPicked?.id ?? null;

  if (!raidId) {
    console.log("⚠️ Could not find a RAID instance in journal data.");
  } else {
    console.log(`✅ Raid picked: ${raidPicked?.name ?? "(unknown)"} (instance ${raidId})`);
  }

  // 2) Collect item IDs
  const raidItemIds = raidId ? await collectLootItemIdsFromInstance(token, raidId) : [];
  console.log(`Raid loot item IDs: ${raidItemIds.length}`);

  const dungeonItemIds = await collectDungeonItemIds(token, raidId);
  console.log(`Dungeon loot item IDs: ${dungeonItemIds.length}`);

  const allIds = uniq([...raidItemIds, ...dungeonItemIds]);
  console.log(`Total unique item IDs to fetch: ${allIds.length}`);

  // 3) Fetch items (sequential to keep it simple + safe)
  const itemsById: Record<string, ItemDetailsRow> = {};
  const index: ItemIndexRow[] = [];

  let ok = 0;
  let fail = 0;

  for (const id of allIds) {
    try {
      const row = await fetchItemDetails(token, id);
      itemsById[String(id)] = row;
      index.push({ id: row.id, name: row.name, slot: row.slot, ilvl: row.ilvl });

      ok++;
      if (ok % 50 === 0) console.log(`Fetched ${ok}/${allIds.length}...`);

      // small courtesy delay (avoids bursts)
      await sleep(30);
    } catch (e: any) {
      fail++;
      if (fail <= 15) console.warn(`SKIP item ${id}: ${e?.message ?? e}`);
    }
  }

  index.sort((a, b) => a.name.localeCompare(b.name));

  // 4) Write outputs (overwrite every run)
  const outDir = path.join(process.cwd(), "public", "data", "wow");
  await fs.mkdir(outDir, { recursive: true });

  const indexPath = path.join(outDir, "items_index.json");
  const byIdPath = path.join(outDir, "items_by_id.json");

  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf8");
  await fs.writeFile(byIdPath, JSON.stringify(itemsById, null, 2), "utf8");

  console.log("");
  console.log(`✅ Wrote items_index (${index.length}) → ${indexPath}`);
  console.log(`✅ Wrote items_by_id (${Object.keys(itemsById).length}) → ${byIdPath}`);
  console.log(`Done. ok=${ok} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
