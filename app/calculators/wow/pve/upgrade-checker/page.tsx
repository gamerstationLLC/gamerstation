import type { Metadata } from "next";
import Link from "next/link";
import UpgradeCheckerClient from "./client";
import { readPublicJson } from "@/lib/blob";

export const metadata: Metadata = {
  title: "WoW Item Upgrade Checker | GamerStation",
  description:
    "Compare two World of Warcraft items and estimate upgrade value by spec and content type (Raid / Mythic+).",
};

type ItemIndexRow = {
  id: number;
  name: string;
  slot?: string;
  ilvl?: number;
};

type FullItem = {
  id: number;
  name: string;
  slot?: string;
  ilvl?: number;
  stats?: Record<string, number>;
  description?: string;
};

type StatKey =
  | "STRENGTH"
  | "AGILITY"
  | "INTELLECT"
  | "STAMINA"
  | "CRIT_RATING"
  | "HASTE_RATING"
  | "MASTERY_RATING"
  | "VERSATILITY";

type SpecKey =
  | "havoc_dh"
  | "vengeance_dh"
  | "fire_mage"
  | "frost_mage"
  | "arcane_mage"
  | "ret_paladin"
  | "prot_paladin"
  | "holy_paladin"
  | "arms_warrior"
  | "fury_warrior"
  | "prot_warrior";

type StatWeightsJson = {
  version?: number;
  // Shape: specs[spec][content][profile][STAT] = weight
  specs: Partial<
    Record<
      SpecKey,
      Partial<
        Record<
          "mplus" | "raid",
          Partial<Record<"st" | "aoe", Partial<Record<StatKey, number>>>>
        >
      >
    >
  >;
};

export default async function WoWUpgradeCheckerPage() {
  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  // ✅ Static disk JSON (disk-first, blob fallback via readPublicJson)
  const itemsIndex =
    (await readPublicJson<ItemIndexRow[]>("data/wow/items_index.json").catch(
      () => []
    )) ?? [];

  const itemsById =
    (await readPublicJson<Record<number, FullItem>>(
      "data/wow/items_by_id.json"
    ).catch(() => ({}))) ?? {};

  // ✅ Load stat weights too
  // NOTE: your file is currently named stats_weights.json (plural)
  const statWeights =
    (await readPublicJson<StatWeightsJson>(
      "data/wow/stats_weights.json"
    ).catch(() => null)) ?? null;

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90">
            <img
              src="/gs-logo-v2.png"
              alt="GamerStation"
              className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_30px_rgba(0,255,255,0.35)]"
            />
            <span className="text-lg font-black tracking-tight">
              GamerStation<span className="align-super text-[0.6em]">™</span>
            </span>
          </Link>

          <div className="ml-auto">
            <Link href="/calculators/wow/pve" className={navBtn}>
              WoW PvE
            </Link>
          </div>
        </header>

        <h1 className="mt-8 text-4xl font-bold">Item Upgrade Checker</h1>
        <p className="mt-3 text-neutral-300">
          Compare two items and get a clarity-first upgrade estimate.
        </p>

        <div className="mt-10">
          <UpgradeCheckerClient
            itemsIndex={itemsIndex}
            itemsById={itemsById}
            statWeights={statWeights}
          />
        </div>
      </div>
    </main>
  );
}
