"use client";

export type ItemType = "fruit" | "sword" | "gun" | "accessory" | "material" | "other";

export type BloxItem = {
  id: string;
  name: string;
  type: ItemType;
  buffs?: {
    damagePct?: number;
    defensePct?: number;
    speedPct?: number;
    energyPct?: number;
    cooldownPct?: number;
    xpPct?: number;
  };
  source: { wikiPage: string };
};

let cache: BloxItem[] | null = null;

export async function loadBloxItems() {
  if (cache) return cache;
  const res = await fetch("/data/roblox/bloxfruits/items.v2.json", { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to load items (${res.status})`);
  cache = (await res.json()) as BloxItem[];
  return cache;
}
