import fs from "fs/promises";
import path from "path";

type ContentFocus = "mplus" | "raid";
type DamageProfile = "st" | "aoe";

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

type WowStatWeightsJson = {
  version: number;
  notes: string;
  specs: Partial<
    Record<
      SpecKey,
      Partial<Record<ContentFocus, Partial<Record<DamageProfile, Record<string, number>>>>>
    >
  >;
};

const OUT_PATH = path.join(process.cwd(), "public", "data", "wow", "stats_weights.json");

const SPECS: SpecKey[] = [
  "havoc_dh",
  "vengeance_dh",
  "fire_mage",
  "frost_mage",
  "arcane_mage",
  "ret_paladin",
  "prot_paladin",
  "holy_paladin",
  "arms_warrior",
  "fury_warrior",
  "prot_warrior",
];

// ✅ Minimal placeholder weights (so the UI works)
const DPS_ST = {
  STRENGTH: 1.0,
  AGILITY: 1.0,
  INTELLECT: 1.0,
  CRIT_RATING: 0.55,
  HASTE_RATING: 0.60,
  MASTERY_RATING: 0.50,
  VERSATILITY: 0.45,
  VERSATILITY_RATING: 0.45,
};

const DPS_AOE = {
  ...DPS_ST,
  HASTE_RATING: 0.65,
  MASTERY_RATING: 0.55,
};

const TANK = {
  STRENGTH: 0.85,
  AGILITY: 0.85,
  STAMINA: 0.75,
  VERSATILITY: 0.65,
  VERSATILITY_RATING: 0.65,
  HASTE_RATING: 0.45,
  MASTERY_RATING: 0.55,
  CRIT_RATING: 0.25,
  AVOIDANCE: 0.20,
};

const HEAL = {
  INTELLECT: 1.0,
  HASTE_RATING: 0.70,
  CRIT_RATING: 0.60,
  MASTERY_RATING: 0.55,
  VERSATILITY: 0.45,
  VERSATILITY_RATING: 0.45,
};

function weightsFor(spec: SpecKey, profile: DamageProfile): Record<string, number> {
  if (spec.includes("prot_") || spec === "vengeance_dh") return TANK;
  if (spec === "holy_paladin") return HEAL;
  return profile === "aoe" ? DPS_AOE : DPS_ST;
}

async function main() {
  const out: WowStatWeightsJson = {
    version: 1,
    notes:
      "Placeholder stat weights so the upgrade checker UI works. Replace per patch/spec with real values. Keys must match item stats keys (CRIT_RATING, HASTE_RATING, etc).",
    specs: {},
  };

  for (const spec of SPECS) {
    out.specs[spec] = {
      mplus: { st: weightsFor(spec, "st"), aoe: weightsFor(spec, "aoe") },
      raid: { st: weightsFor(spec, "st"), aoe: weightsFor(spec, "aoe") },
    };
  }

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2), "utf8");
  console.log(`✅ Wrote ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
