import fs from "fs";
import path from "path";

const OUT_DIR = path.resolve("data/osrs/items");

// OSRSBox static item DB
const SOURCE =
  "https://raw.githubusercontent.com/osrsbox/osrsbox-db/master/docs/items-complete.json";

// Map OSRSBox equip slot → your slot keys
const SLOT_MAP = {
  head: "head",
  body: "body",
  legs: "legs",
  feet: "feet",
  hands: "hands",
  neck: "neck",
  cape: "cape",
  ring: "ring",
  shield: "shield",
  weapon: "weapon",
  ammo: "ammo",
};

async function main() {
  console.log("Fetching OSRSBox items...");
  const res = await fetch(SOURCE);
  const raw = await res.json();

  // init output buckets
  const out = {};
  for (const s of Object.values(SLOT_MAP)) {
    out[s] = [];
  }

  for (const item of Object.values(raw)) {
    if (!item.equipable || !item.equipment) continue;

    const slot = SLOT_MAP[item.equipment.slot];
    if (!slot) continue;

    const eq = item.equipment;

    out[slot].push({
      id: item.id,
      name: item.name,
      slot,

      attackBonus:
        eq.attack_stab +
        eq.attack_slash +
        eq.attack_crush +
        eq.attack_magic +
        eq.attack_ranged,

      strengthBonus: eq.melee_strength || undefined,
      rangedStrength: eq.ranged_strength || undefined,
      magicDamagePct: eq.magic_damage || undefined,
      speedTicks: slot === "weapon" ? item.weapon?.attack_speed : undefined,
    });
  }

  // write files
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const [slot, items] of Object.entries(out)) {
    fs.writeFileSync(
      path.join(OUT_DIR, `${slot}.json`),
      JSON.stringify({ items }, null, 2),
      "utf8"
    );
    console.log(`✔ wrote ${slot}.json (${items.length} items)`);
  }

  console.log("✅ OSRS items generated");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
