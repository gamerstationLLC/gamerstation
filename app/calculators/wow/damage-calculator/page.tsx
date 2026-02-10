// app/calculators/wow/damage-calc/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import WowDamageCalcClient from "./client";
import { readPublicJson } from "@/lib/blob";

export const metadata: Metadata = {
  title: "WoW Damage Calculator – Ability + Simple DPS | GamerStation",
  description:
    "Estimate hit/crit/expected damage and a simple CPM-based DPS number. Add gear via searchable dropdowns using a full item database.",
};

export const revalidate = 600;

type DamageSchool = "PHYSICAL" | "MAGIC";
type Scaling = "AP_WDPS" | "SP" | "AP" | "SP_DOT";
type MasteryMode = "none" | "mult";

export type AbilityPreset = {
  id: string;
  name: string;
  school: DamageSchool;
  scales: Scaling;
  base: number;
  apCoeff: number;
  spCoeff: number;
  wdpsCoeff: number;
  masteryMode: MasteryMode;
  baseUpm: number;
  hasteAffectsRate: boolean;
  tags?: Array<"burst">;
};

export type SpecPreset = {
  id: string;
  name: string;
  className: string;
  abilities: AbilityPreset[];
};

export type PresetsFile = {
  version: string;
  specs: SpecPreset[];
};

export type ItemIndexRow = {
  id: number;
  name: string;
  nameNorm: string;
  tokens: string[];
  quality?: string;
  itemClass?: string;
  itemSubclass?: string;
  inventoryType?: string;
  inventoryTypeKey?: string; // e.g. "HEAD", "TRINKET"
  isEquippable: boolean;
  itemLevel?: number;
  requiredLevel?: number;
  pack: number; // pack number for packs/items.pack.XXX.json
};

type ItemIndexFile = {
  meta?: any;
  items: ItemIndexRow[];
};

// ---------- helpers ----------
function norm(s: string) {
  return (s || "").toLowerCase().trim();
}
function tokenize(s: string) {
  return norm(s)
    .split(/[^a-z0-9]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}
function safeNum(n: any, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Accepts any of these shapes:
 * 1) { items: ItemIndexRow[] }   ✅ expected
 * 2) ItemIndexRow[]             ✅ acceptable
 * 3) PackedItem[] (array of {id, detail:{...}}) ✅ your pasted JSON
 *
 * If shape #3 is detected, we build a minimal index from detail so searching works.
 * NOTE: pack will be set to 0 if unknown, so "Apply gear → inputs" can’t reliably
 * fetch detail packs unless your real index.json includes correct pack numbers.
 */
function coerceItemsIndex(raw: any): ItemIndexRow[] {
  if (!raw) return [];

  // shape #1
  if (raw && typeof raw === "object" && Array.isArray(raw.items)) {
    return raw.items.filter(Boolean);
  }

  // shape #2
  if (Array.isArray(raw) && raw.length && raw[0] && typeof raw[0] === "object") {
    const first = raw[0] as any;

    // already looks like ItemIndexRow[]
    if (
      typeof first.id === "number" &&
      typeof first.name === "string" &&
      typeof first.nameNorm === "string" &&
      Array.isArray(first.tokens)
    ) {
      return raw as ItemIndexRow[];
    }

    // shape #3: packed items [{id, detail:{...}}]
    if (typeof first.id === "number" && first.detail && typeof first.detail === "object") {
      return (raw as Array<{ id: number; detail: any }>).map(({ id, detail }) => {
        const name = String(detail?.name ?? `Item ${id}`);
        const invTypeKey = String(detail?.inventory_type?.type ?? "").toUpperCase() || undefined;

        // best-effort ilvl from common places
        const ilvl =
          safeNum(detail?.preview_item?.level?.value, NaN) ??
          safeNum(detail?.level, NaN);

        return {
          id,
          name,
          nameNorm: norm(name),
          tokens: tokenize(name),
          quality: detail?.quality?.type ?? detail?.quality?.name,
          itemClass: detail?.item_class?.name,
          itemSubclass: detail?.item_subclass?.name,
          inventoryType: detail?.inventory_type?.name,
          inventoryTypeKey: invTypeKey,
          isEquippable: !!detail?.is_equippable,
          itemLevel: Number.isFinite(ilvl as any) ? (ilvl as number) : undefined,
          requiredLevel: safeNum(detail?.required_level, undefined as any),
          pack: safeNum((detail as any)?.pack, 0), // unknown here; real index.json should set this
        };
      });
    }
  }

  return [];
}

export default async function WowDamageCalcPage() {
  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  // ✅ Disk-first, then Blob fallback
  const presets =
    (await readPublicJson<PresetsFile>("data/wow/quick-sim-presets.json").catch(
      () => null
    )) ?? null;

  const itemsIndexRaw =
    (await readPublicJson<any>("data/wow/items/index.json").catch(() => null)) ?? null;

  const itemsIndex = coerceItemsIndex(itemsIndexRaw);

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* ✅ Standard GS header */}
        <header className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90">
            <img
              src="/gs-logo-v2.png"
              alt="GamerStation"
              className="
                h-10 w-10 rounded-xl bg-black p-1
                shadow-[0_0_30px_rgba(0,255,255,0.35)]
              "
            />
            <span className="text-lg font-black tracking-tight">
              GamerStation<span className="align-super text-[0.6em]">™</span>
            </span>
          </Link>

          <div className="ml-auto">
            <Link href="/calculators/wow" className={navBtn}>
              WoW Hub
            </Link>
          </div>
        </header>

        <h1 className="mt-8 text-4xl font-bold">WoW Damage Calculator</h1>
        <p className="mt-3 text-neutral-300">
          Estimate hit/crit/expected damage and a simple CPM-based DPS number.
        </p>

        <div className="mt-10">
          <WowDamageCalcClient presets={presets} itemsIndex={itemsIndex} />
        </div>

        <div className="mt-10 text-xs text-neutral-600">
          Data sources: Blizzard Game Data API (items DB build). This calculator is an approximation (not a full sim).
        </div>
      </div>
    </main>
  );
}
