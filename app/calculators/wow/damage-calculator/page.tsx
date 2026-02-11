// app/calculators/wow/damage-calculator/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import WowDamageCalcClient from "./client";
import { readPublicJson } from "@/lib/blob";

export const metadata: Metadata = {
  title: "WoW Damage Calculator (Quick Sim) | GamerStation",
  description:
    "Estimate ability damage and simple DPS in World of Warcraft using spec presets, crit/haste/mastery/vers, target mitigation, and optional gear selection.",
};

export const dynamic = "force-static";
export const revalidate = 600;

export type SpecPreset = {
  id: string;
  className: string;
  name: string;
  abilities: Array<{
    id: string;
    name: string;
    school: "PHYSICAL" | "MAGIC";
    scales: "AP_WDPS" | "SP" | "AP" | "SP_DOT";
    base: number;
    apCoeff: number;
    spCoeff: number;
    wdpsCoeff: number;
    masteryMode: "none" | "mult";
    baseUpm: number;
    hasteAffectsRate: boolean;
    tags?: string[];
  }>;
};

export type PresetsFile = {
  version: string;
  specs: SpecPreset[];
};

export type ItemIndexRow = {
  id: number;
  name?: string;
  nameNorm?: string;
  tokens?: string[];
  pack?: number;
  itemLevel?: number;
  ilvl?: number;

  inventoryTypeKey?: string;
  slot?: string;
  inventoryType?: string;

  quality?: string;
};

async function safeReadJson<T>(path: string): Promise<T | null> {
  try {
    return await readPublicJson<T>(path);
  } catch {
    return null;
  }
}

export default async function WowDamageCalcPage() {
  // Presets
  const presets = await safeReadJson<PresetsFile>("/data/wow/quick-sim-presets.json");

  // ✅ Load ALL WoW item datasets you currently have
  // (client will normalize/merge/dedupe)
  const itemsIndexA = await safeReadJson<any>("/data/wow/items/items_index.json");
  const itemsIndexB = await safeReadJson<any>("/data/wow/items/index.json");
  const itemsById = await safeReadJson<any>("/data/wow/items/items_by_id.json");
  const probe = await safeReadJson<any>("/data/wow/items/probe.json");

  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  return (
    <main className="min-h-screen bg-transparent text-white px-6 py-16">
      <div className="mx-auto max-w-6xl">
        {/* ✅ Standard GS header */}
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/gs-logo-v2.png"
              alt="GamerStation"
              className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_25px_rgba(0,255,255,0.20)]"
            />
            <div className="text-lg font-black">
              GamerStation<span className="align-super text-[0.6em]">™</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/calculators/wow" className={navBtn}>
              WoW Hub
            </Link>
            <Link href="/tools" className={navBtn}>
              Tools
            </Link>
          </div>
        </header>

        <div className="mt-8">
          <div className="mb-2 text-3xl font-black">WoW Damage Calculator</div>
          <div className="text-sm text-neutral-400">
            Quick Sim vibe: expected hit × rate (UPM). Not a full rotation/resource sim.
          </div>
        </div>

        <div className="mt-8">
          <WowDamageCalcClient
            presets={presets}
            // ✅ pass everything; client merges it
            itemsIndexA={itemsIndexA}
            itemsIndexB={itemsIndexB}
            itemsById={itemsById}
            probe={probe}
          />
        </div>

        <div className="mt-10 text-xs text-neutral-600">
          Disclaimer: Approximation. Real WoW damage depends on talents, spec mechanics, buffs/debuffs, target scaling,
          procs, and encounter effects.
        </div>
      </div>
    </main>
  );
}
