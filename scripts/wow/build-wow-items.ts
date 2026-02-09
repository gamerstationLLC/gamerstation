import path from "path";
import fs from "fs/promises";
import dotenv from "dotenv";

// ✅ Load .env.local IF it exists (local dev), otherwise rely on GH Actions env/secrets
try {
  dotenv.config({ path: path.join(process.cwd(), ".env.local") });
} catch {
  // ignore
}

const clientId = process.env.BLIZZARD_CLIENT_ID;
const clientSecret = process.env.BLIZZARD_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "Missing BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET. " +
      "Set them in .env.local (local) or GitHub Secrets (Actions)."
  );
  process.exit(1);
}

type ItemIndexRow = {
  id: number;
  name: string;
  slot?: string; // inventory_type.type
  ilvl?: number; // item.level
};

type ItemDetailsRow = ItemIndexRow & {
  quality?: string;
  item_class?: string;
  item_subclass?: string;

  /**
   * ✅ UI expects Blizzard stat keys, so this must be a record like:
   * { STRENGTH: 123, CRIT_RATING: 456, ... }
   */
  stats?: Record<string, number>;

  /** ✅ Keep raw array too (optional but useful) */
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

      if (!cat.includes("DUNGEON")) continue;

      const ids = await collectLootItemIdsFromInstance(token, inst.id);

      if (ids.length > 0) {
        allItemIds.push(...ids);
        console.log(
          `Dungeon: ${detail?.name ?? inst.name ?? inst.id} → ${ids.length} item IDs`
        );
      }
    } catch {
      // ignore
    }
  }

  return uniq(allItemIds);
}

/* ============================
   ✅ Stats normalization for UI
   We store Blizzard-style keys:
   STRENGTH, AGILITY, INTELLECT, STAMINA,
   CRIT_RATING, HASTE_RATING, MASTERY_RATING, VERSATILITY,
   plus LEECH, AVOIDANCE, SPEED
============================ */
function addStat(out: Record<string, number>, k: string, v: number) {
  out[k] = (out[k] ?? 0) + v;
}

function statsRecordFromRaw(raw: Array<{ type?: string; value?: number }> | undefined) {
  const out: Record<string, number> = {};
  for (const s of raw ?? []) {
    const type = String(s?.type ?? "").toUpperCase().trim();
    const value = Number(s?.value ?? 0);
    if (!type || !Number.isFinite(value) || value === 0) continue;

    // Keep as Blizzard-like keys
    // Some sources may already be clean like "CRIT_RATING"
    // If we see "CRIT" or similar, normalize to the expected keys.
    if (type === "STRENGTH") addStat(out, "STRENGTH", value);
    else if (type === "AGILITY") addStat(out, "AGILITY", value);
    else if (type === "INTELLECT") addStat(out, "INTELLECT", value);
    else if (type === "STAMINA") addStat(out, "STAMINA", value);
    else if (type.includes("CRIT")) addStat(out, "CRIT_RATING", value);
    else if (type.includes("HASTE")) addStat(out, "HASTE_RATING", value);
    else if (type.includes("MASTERY")) addStat(out, "MASTERY_RATING", value);
    else if (type.includes("VERSATILITY")) addStat(out, "VERSATILITY", value);
    else if (type.includes("LEECH")) addStat(out, "LEECH", value);
    else if (type.includes("AVOID")) addStat(out, "AVOIDANCE", value);
    else if (type.includes("SPEED")) addStat(out, "SPEED", value);
    else {
      // Keep unknown keys too, but they may not have pretty labels
      addStat(out, type, value);
    }
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

  const stats = statsRecordFromRaw(stats_raw);

  return {
    id: item.id,
    name: item.name,
    slot: item.inventory_type?.type,
    ilvl: item.level,
    quality: item.quality?.type,
    item_class: item.item_class?.name,
    item_subclass: item.item_subclass?.name,

    stats,
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
    console.log(
      `✅ Raid picked: ${raidPicked?.name ?? "(unknown)"} (instance ${raidId})`
    );
  }

  // 2) Collect item IDs
  const raidItemIds = raidId
    ? await collectLootItemIdsFromInstance(token, raidId)
    : [];
  console.log(`Raid loot item IDs: ${raidItemIds.length}`);

  const dungeonItemIds = await collectDungeonItemIds(token, raidId);
  console.log(`Dungeon loot item IDs: ${dungeonItemIds.length}`);

  const allIds = uniq([...raidItemIds, ...dungeonItemIds]);
  console.log(`Total unique item IDs to fetch: ${allIds.length}`);

  // 3) Fetch items
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

      await sleep(30);
    } catch (e: any) {
      fail++;
      if (fail <= 15) console.warn(`SKIP item ${id}: ${e?.message ?? e}`);
    }
  }

  index.sort((a, b) => a.name.localeCompare(b.name));

  // 4) Write outputs
  const outDir = path.join(process.cwd(), "public", "data", "wow");
  await fs.mkdir(outDir, { recursive: true });

  const indexPath = path.join(outDir, "items_index.json");
  const byIdPath = path.join(outDir, "items_by_id.json");

  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf8");
  await fs.writeFile(byIdPath, JSON.stringify(itemsById, null, 2), "utf8");

  console.log("");
  console.log(`✅ Wrote items_index (${index.length}) → ${indexPath}`);
  console.log(
    `✅ Wrote items_by_id (${Object.keys(itemsById).length}) → ${byIdPath}`
  );
  console.log(`Done. ok=${ok} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
