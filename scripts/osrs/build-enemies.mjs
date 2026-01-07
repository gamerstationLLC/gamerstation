import fs from "fs";
import path from "path";

const OUT_FILE = path.resolve("public/osrs/enemies.json");

// OSRSBox monsters DB (complete)
const SOURCE =
  "https://raw.githubusercontent.com/osrsbox/osrsbox-db/master/docs/monsters-complete.json";

function slug(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normName(s) {
  return String(s ?? "").trim().toLowerCase();
}

function pickBetter(a, b) {
  // Prefer higher HP, then higher defLevel, then higher defBonus
  if (b.hp !== a.hp) return b.hp > a.hp ? b : a;
  if (b.defLevel !== a.defLevel) return b.defLevel > a.defLevel ? b : a;
  if (b.defBonus !== a.defBonus) return b.defBonus > a.defBonus ? b : a;
  return a;
}

async function main() {
  console.log("Fetching OSRSBox monsters...");
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

  const raw = await res.json();

  // Deduplicate by normalized name
  const byName = new Map();

  for (const m of Object.values(raw)) {
    const id = m?.id ?? m?.monster_id ?? m?.npc_id;
    const name = m?.name;
    if (!id || !name) continue;

    const nm = String(name).trim();
    if (!nm || nm.toLowerCase() === "null") continue;

    const hp =
      m?.hitpoints ?? m?.hp ?? m?.stats?.hitpoints ?? m?.stats?.hp ?? null;
    if (hp == null) continue;

    const defLevel =
      m?.defence_level ??
      m?.defense_level ??
      m?.stats?.defence ??
      m?.stats?.defense ??
      1;

    const defBonus =
      m?.defence_bonus ??
      m?.defense_bonus ??
      m?.bonuses?.defence ??
      m?.bonuses?.defense ??
      0;

    const enemy = {
      key: `${slug(nm)}_${id}`,
      name: nm,
      hp: toNum(hp, 1),
      defLevel: toNum(defLevel, 1),
      defBonus: toNum(defBonus, 0),
    };

    const k = normName(nm);
    const existing = byName.get(k);
    byName.set(k, existing ? pickBetter(existing, enemy) : enemy);
  }

  const enemies = Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify({ enemies }), "utf8");


  console.log(`✅ OUT_FILE: ${OUT_FILE}`);
  console.log(`✅ wrote enemies.json (${enemies.length} enemies)`);
  console.log(`✅ bytes: ${fs.statSync(OUT_FILE).size}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
