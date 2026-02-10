// scripts/wow/build-quick-sim-presets.ts
/* eslint-disable no-console */

import fs from "node:fs/promises";
import path from "node:path";

type DamageSchool = "PHYSICAL" | "MAGIC";
type Scaling = "AP_WDPS" | "SP" | "AP" | "SP_DOT";
type MasteryMode = "none" | "mult";

type AbilityPreset = {
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

type SpecPreset = {
  id: string;
  name: string;
  className: string;
  abilities: AbilityPreset[];
};

type PresetsFile = {
  version: string;
  specs: SpecPreset[];
};

async function readJsonIfExists<T>(p: string): Promise<T | null> {
  try {
    const txt = await fs.readFile(p, "utf8");
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

function nowVersion() {
  const d = new Date();
  // YYYY-MM-DD
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DEFAULT_PRESETS: PresetsFile = {
  version: `autogen-${nowVersion()}`,
  specs: [
    {
      id: "warrior_arms",
      className: "Warrior",
      name: "Arms",
      abilities: [
        {
          id: "mortal_strike",
          name: "Mortal Strike",
          school: "PHYSICAL",
          scales: "AP_WDPS",
          base: 0,
          apCoeff: 0.55,
          spCoeff: 0,
          wdpsCoeff: 1.1,
          masteryMode: "none",
          baseUpm: 9,
          hasteAffectsRate: true,
        },
        {
          id: "overpower",
          name: "Overpower",
          school: "PHYSICAL",
          scales: "AP",
          base: 0,
          apCoeff: 0.35,
          spCoeff: 0,
          wdpsCoeff: 0,
          masteryMode: "none",
          baseUpm: 12,
          hasteAffectsRate: true,
        },
        {
          id: "execute",
          name: "Execute (burst window)",
          school: "PHYSICAL",
          scales: "AP_WDPS",
          base: 0,
          apCoeff: 0.85,
          spCoeff: 0,
          wdpsCoeff: 1.5,
          masteryMode: "none",
          baseUpm: 6,
          hasteAffectsRate: true,
          tags: ["burst"],
        },
      ],
    },
    {
      id: "paladin_retribution",
      className: "Paladin",
      name: "Retribution",
      abilities: [
        {
          id: "templars_verdict",
          name: "Templar's Verdict",
          school: "PHYSICAL",
          scales: "AP_WDPS",
          base: 0,
          apCoeff: 0.6,
          spCoeff: 0,
          wdpsCoeff: 1.0,
          masteryMode: "none",
          baseUpm: 8,
          hasteAffectsRate: true,
        },
        {
          id: "blade_of_justice",
          name: "Blade of Justice",
          school: "PHYSICAL",
          scales: "AP_WDPS",
          base: 0,
          apCoeff: 0.45,
          spCoeff: 0,
          wdpsCoeff: 0.9,
          masteryMode: "none",
          baseUpm: 10,
          hasteAffectsRate: true,
        },
        {
          id: "judgment",
          name: "Judgment (burst window)",
          school: "MAGIC",
          scales: "AP",
          base: 0,
          apCoeff: 0.4,
          spCoeff: 0,
          wdpsCoeff: 0,
          masteryMode: "none",
          baseUpm: 6,
          hasteAffectsRate: true,
          tags: ["burst"],
        },
      ],
    },
    {
      id: "mage_fire",
      className: "Mage",
      name: "Fire",
      abilities: [
        {
          id: "fireball",
          name: "Fireball",
          school: "MAGIC",
          scales: "SP",
          base: 0,
          apCoeff: 0,
          spCoeff: 0.6,
          wdpsCoeff: 0,
          masteryMode: "none",
          baseUpm: 18,
          hasteAffectsRate: true,
        },
        {
          id: "pyroblast",
          name: "Pyroblast (burst window)",
          school: "MAGIC",
          scales: "SP",
          base: 0,
          apCoeff: 0,
          spCoeff: 1.25,
          wdpsCoeff: 0,
          masteryMode: "none",
          baseUpm: 6,
          hasteAffectsRate: true,
          tags: ["burst"],
        },
      ],
    },
  ],
};

async function main() {
  const root = process.cwd();
  const seedsPath = path.join(root, "scripts", "wow", "quick-sim-seeds.json");
  const outPath = path.join(root, "public", "data", "wow", "quick-sim-presets.json");

  await ensureDir(path.dirname(outPath));

  const seeds = await readJsonIfExists<PresetsFile>(seedsPath);

  const presets: PresetsFile = seeds?.specs?.length
    ? { version: `seeds-${nowVersion()}`, specs: seeds.specs }
    : DEFAULT_PRESETS;

  await fs.writeFile(outPath, JSON.stringify(presets, null, 2), "utf8");
  console.log(`[wow] wrote quick sim presets -> public/data/wow/quick-sim-presets.json (specs=${presets.specs.length})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
