// scripts/wow/fetch-character.ts
// Fetches WoW character profile + equipment + stats from Blizzard Profile API
// and writes a normalized "quick-sim-inputs.json" for GamerStation.
//
// ✅ Uses YOUR env vars:
//   BNET_CLIENT_ID
//   BNET_CLIENT_SECRET
//
// Usage:
//   npx tsx scripts/wow/fetch-character.ts --region us --realm illidan --name "CharacterName"
//
// Optional:
//   --namespace profile-us   (default: profile-<region>)
//   --locale en_US          (default: en_US)
//   --out public/data/wow/characters
//
// Outputs:
//   public/data/wow/characters/<region>/<realmSlug>/<name>/raw.profile.json
//   public/data/wow/characters/<region>/<realmSlug>/<name>/raw.equipment.json
//   public/data/wow/characters/<region>/<realmSlug>/<name>/raw.statistics.json
//   public/data/wow/characters/<region>/<realmSlug>/<name>/raw.specializations.json (best-effort)
//   public/data/wow/characters/<region>/<realmSlug>/<name>/quick-sim-inputs.json   ✅

import fs from "node:fs/promises";
import path from "node:path";

type Region = "us" | "eu" | "kr" | "tw";

function getArg(flag: string) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}

function requireEnv(key: string) {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

function slugifyRealm(realm: string) {
  return realm
    .trim()
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function slugifyName(name: string) {
  return name.trim().toLowerCase();
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function writeJson(filePath: string, data: unknown) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url}\n${text.slice(0, 800)}`);
  }
  return (await res.json()) as T;
}

async function getAccessToken(region: Region, clientId: string, clientSecret: string) {
  const tokenUrl = `https://${region}.battle.net/oauth/token`;
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

/** Normalized output shape for your quick sim client */
type QuickSimInputs = {
  meta: {
    region: Region;
    realmSlug: string;
    characterName: string;
    fetchedAt: string;
    locale: string;
    namespace: string;
  };
  profile: {
    level?: number;
    class?: string;
    spec?: string;
    race?: string;
    faction?: string;
    ilvlEquipped?: number;
  };
  stats: {
    strength?: number;
    agility?: number;
    intellect?: number;
    stamina?: number;

    critPct?: number;
    hastePct?: number;
    masteryPct?: number;
    versPct?: number;

    critRating?: number;
    hasteRating?: number;
    masteryRating?: number;
    versRating?: number;

    attackPower?: number;
    spellPower?: number;
  };
  weapon: {
    mainHandDps?: number;
    mainHandSpeed?: number;
    offHandDps?: number;
    offHandSpeed?: number;
  };
  gear: {
    equippedItemLevel?: number;
    items: Array<{
      slot?: string;
      itemId?: number;
      name?: string;
      ilvl?: number;
      quality?: string;
      stats?: Array<{ type?: string; value?: number }>;
    }>;
  };
};

function num(x: unknown): number | undefined {
  return typeof x === "number" && Number.isFinite(x) ? x : undefined;
}
function str(x: unknown): string | undefined {
  return typeof x === "string" ? x : undefined;
}
function safeLower(s?: string) {
  return (s ?? "").toLowerCase();
}

function extractSecondaryPct(root: any, keys: string[]): number | undefined {
  if (!root || typeof root !== "object") return undefined;

  for (const k of keys) {
    const node = root[k];
    if (!node) continue;

    // direct number
    const direct = num(node);
    if (direct != null) return direct <= 1 ? direct * 100 : direct;

    // node.value
    const v = num(node.value);
    if (v != null) return v <= 1 ? v * 100 : v;

    // rating_bonus
    const rb = num(node.rating_bonus);
    if (rb != null) return rb <= 1 ? rb * 100 : rb;

    // percent
    const p = num(node.percent);
    if (p != null) return p <= 1 ? p * 100 : p;
  }
  return undefined;
}

function extractRating(root: any, keys: string[]): number | undefined {
  if (!root || typeof root !== "object") return undefined;

  for (const k of keys) {
    const node = root[k];
    if (!node) continue;

    const r = num(node.rating);
    if (r != null) return r;

    const v = num(node.value);
    if (v != null && v > 1) return v;
  }
  return undefined;
}

function pickActiveSpecName(rawSpec: any): string | undefined {
  const direct = str(rawSpec?.active_specialization?.name);
  if (direct) return direct;

  const list = rawSpec?.specializations;
  if (Array.isArray(list)) {
    const active = list.find((s: any) => s?.is_active);
    const name = str(active?.specialization?.name) ?? str(active?.specialization?.name?.en_US);
    if (name) return name;
  }

  return undefined;
}

function getWeaponFromEquipment(rawEquipment: any, slotMatchLower: string) {
  const items = rawEquipment?.equipped_items;
  if (!Array.isArray(items)) return { dps: undefined as number | undefined, speed: undefined as number | undefined };

  const match = items.find((it: any) => safeLower(it?.slot?.name).includes(slotMatchLower));
  if (!match) return { dps: undefined, speed: undefined };

  const speed =
    num(match?.weapon?.attack_speed?.value) ??
    num(match?.weapon?.attack_speed) ??
    num(match?.weapon?.weapon_speed?.value) ??
    num(match?.weapon?.weapon_speed);

  const dps =
    num(match?.weapon?.dps?.value) ??
    num(match?.weapon?.dps) ??
    num(match?.weapon?.damage_per_second?.value) ??
    num(match?.weapon?.damage_per_second);

  return { dps, speed };
}

async function main() {
  // ⚠️ Rotate keys if you ever posted them anywhere public.
  // (Not asking—just do it. It prevents quota sabotage.)

  const region = (getArg("--region") ?? "us") as Region;
  const realm = getArg("--realm");
  const name = getArg("--name");

  if (!realm || !name) {
    throw new Error(
      `Missing args.\nExample:\n  npx tsx scripts/wow/fetch-character.ts --region us --realm illidan --name "CharacterName"`
    );
  }

  const namespace = getArg("--namespace") ?? `profile-${region}`;
  const locale = getArg("--locale") ?? "en_US";
  const outDir = getArg("--out") ?? "public/data/wow/characters";

  // ✅ Your env names
  const clientId = requireEnv("BNET_CLIENT_ID");
  const clientSecret = requireEnv("BNET_CLIENT_SECRET");

  const realmSlug = slugifyRealm(realm);
  const charName = slugifyName(name);

  const token = await getAccessToken(region, clientId, clientSecret);
  const apiBase = `https://${region}.api.blizzard.com`;

  const profileUrl =
    `${apiBase}/profile/wow/character/${realmSlug}/${charName}` +
    `?namespace=${encodeURIComponent(namespace)}&locale=${encodeURIComponent(locale)}`;

  const equipmentUrl =
    `${apiBase}/profile/wow/character/${realmSlug}/${charName}/equipment` +
    `?namespace=${encodeURIComponent(namespace)}&locale=${encodeURIComponent(locale)}`;

  const statsUrl =
    `${apiBase}/profile/wow/character/${realmSlug}/${charName}/statistics` +
    `?namespace=${encodeURIComponent(namespace)}&locale=${encodeURIComponent(locale)}`;

  const specUrl =
    `${apiBase}/profile/wow/character/${realmSlug}/${charName}/specializations` +
    `?namespace=${encodeURIComponent(namespace)}&locale=${encodeURIComponent(locale)}`;

  const [rawProfile, rawEquipment, rawStats, rawSpec] = await Promise.all([
    fetchJson<any>(profileUrl, token),
    fetchJson<any>(equipmentUrl, token),
    fetchJson<any>(statsUrl, token),
    fetchJson<any>(specUrl, token).catch(() => null),
  ]);

  const baseOut = path.join(outDir, region, realmSlug, charName);

  await writeJson(path.join(baseOut, "raw.profile.json"), rawProfile);
  await writeJson(path.join(baseOut, "raw.equipment.json"), rawEquipment);
  await writeJson(path.join(baseOut, "raw.statistics.json"), rawStats);
  if (rawSpec) await writeJson(path.join(baseOut, "raw.specializations.json"), rawSpec);

  const equippedIlvl = num(rawEquipment?.equipped_item_level);

  const items = Array.isArray(rawEquipment?.equipped_items)
    ? rawEquipment.equipped_items.map((it: any) => ({
        slot: str(it?.slot?.name),
        itemId: num(it?.item?.id),
        name: str(it?.name),
        ilvl: num(it?.level?.value) ?? num(it?.item_level),
        quality: str(it?.quality?.name),
        stats: Array.isArray(it?.stats)
          ? it.stats.map((s: any) => ({
              type: str(s?.type?.name) ?? str(s?.type?.type),
              value: num(s?.value),
            }))
          : undefined,
      }))
    : [];

  const mh = getWeaponFromEquipment(rawEquipment, "main hand");
  const oh = getWeaponFromEquipment(rawEquipment, "off hand");

  const attrs = rawStats?.attributes ?? rawStats;

  const strength = num(attrs?.strength?.effective) ?? num(attrs?.strength);
  const agility = num(attrs?.agility?.effective) ?? num(attrs?.agility);
  const intellect = num(attrs?.intellect?.effective) ?? num(attrs?.intellect);
  const stamina = num(attrs?.stamina?.effective) ?? num(attrs?.stamina);

  const critPct =
    extractSecondaryPct(rawStats, ["melee_crit", "crit", "critical_strike", "critical_strike_percent"]) ??
    extractSecondaryPct(rawStats?.combat_ratings, ["critical_strike"]) ??
    extractSecondaryPct(rawStats?.ratings, ["critical_strike"]);

  const hastePct =
    extractSecondaryPct(rawStats, ["melee_haste", "haste", "haste_percent"]) ??
    extractSecondaryPct(rawStats?.combat_ratings, ["haste"]) ??
    extractSecondaryPct(rawStats?.ratings, ["haste"]);

  const masteryPct =
    extractSecondaryPct(rawStats, ["mastery", "mastery_percent"]) ??
    extractSecondaryPct(rawStats?.combat_ratings, ["mastery"]) ??
    extractSecondaryPct(rawStats?.ratings, ["mastery"]);

  const versPct =
    extractSecondaryPct(rawStats, ["versatility", "versatility_damage_done_bonus", "versatility_percent"]) ??
    extractSecondaryPct(rawStats?.combat_ratings, ["versatility"]) ??
    extractSecondaryPct(rawStats?.ratings, ["versatility"]);

  const critRating =
    extractRating(rawStats, ["crit", "critical_strike", "melee_crit"]) ??
    extractRating(rawStats?.combat_ratings, ["critical_strike"]) ??
    extractRating(rawStats?.ratings, ["critical_strike"]);

  const hasteRating =
    extractRating(rawStats, ["haste", "melee_haste"]) ??
    extractRating(rawStats?.combat_ratings, ["haste"]) ??
    extractRating(rawStats?.ratings, ["haste"]);

  const masteryRating =
    extractRating(rawStats, ["mastery"]) ??
    extractRating(rawStats?.combat_ratings, ["mastery"]) ??
    extractRating(rawStats?.ratings, ["mastery"]);

  const versRating =
    extractRating(rawStats, ["versatility"]) ??
    extractRating(rawStats?.combat_ratings, ["versatility"]) ??
    extractRating(rawStats?.ratings, ["versatility"]);

  const attackPower =
    num(rawStats?.power?.attack_power) ??
    num(rawStats?.attack_power) ??
    num(rawStats?.power?.attack_power?.effective);

  const spellPower =
    num(rawStats?.power?.spell_power) ??
    num(rawStats?.spell_power) ??
    num(rawStats?.power?.spell_power?.effective);

  const activeSpecName = rawSpec ? pickActiveSpecName(rawSpec) : undefined;

  const quick: QuickSimInputs = {
    meta: {
      region,
      realmSlug,
      characterName: charName,
      fetchedAt: new Date().toISOString(),
      locale,
      namespace,
    },
    profile: {
      level: num(rawProfile?.level),
      class: str(rawProfile?.character_class?.name),
      spec: activeSpecName,
      race: str(rawProfile?.race?.name),
      faction: str(rawProfile?.faction?.name),
      ilvlEquipped: equippedIlvl,
    },
    stats: {
      strength,
      agility,
      intellect,
      stamina,

      critPct,
      hastePct,
      masteryPct,
      versPct,

      critRating,
      hasteRating,
      masteryRating,
      versRating,

      attackPower,
      spellPower,
    },
    weapon: {
      mainHandDps: mh.dps,
      mainHandSpeed: mh.speed,
      offHandDps: oh.dps,
      offHandSpeed: oh.speed,
    },
    gear: {
      equippedItemLevel: equippedIlvl,
      items,
    },
  };

  await writeJson(path.join(baseOut, "quick-sim-inputs.json"), quick);

  console.log("✅ Wrote:", path.join(baseOut, "quick-sim-inputs.json"));
  console.log("✅ Raw dumps:", baseOut);
}

main().catch((err) => {
  console.error("❌ fetch-character failed:", err?.message ?? err);
  process.exit(1);
});
