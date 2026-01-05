import fs from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "data", "lol");

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "GamerStation (Data Dragon fetch)" },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
  return res.json();
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log("[lol:fetch] Fetching versions...");
  const versions = await fetchJson("https://ddragon.leagueoflegends.com/api/versions.json");
  const version = versions[0];
  console.log("[lol:fetch] Using patch:", version);

  console.log("[lol:fetch] Fetching champion index...");
  const index = await fetchJson(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
  );

  const champs = Object.values(index.data).map((c) => ({
    id: c.id,
    key: c.key,
    name: c.name,
    title: c.title,
    tags: c.tags,
    partype: c.partype,
  }));

  console.log("[lol:fetch] Champions in index:", champs.length);

  // Fetch each champion details
  const full = [];
  let i = 0;

  for (const c of champs) {
    i += 1;

    // log every 10 so you KNOW it's working
    if (i % 10 === 0) console.log(`[lol:fetch] ${i}/${champs.length}...`);

    const detail = await fetchJson(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion/${c.id}.json`
    );

    const data = Object.values(detail.data)[0];

    full.push({
      id: data.id,
      key: data.key,
      name: data.name,
      title: data.title,
      tags: data.tags,
      partype: data.partype,
      stats: data.stats,
      spells: data.spells.map((s) => ({
        id: s.id,
        name: s.name,
        maxrank: s.maxrank,
        cooldown: s.cooldown,
        cost: s.cost,
        costType: s.costType,
        effect: s.effect,
        vars: s.vars,
      })),
      passive: {
        name: data.passive?.name,
        description: data.passive?.description,
      },
    });
  }

  // Write files
  await fs.writeFile(
    path.join(OUT_DIR, "version.json"),
    JSON.stringify({ version }, null, 2)
  );

  await fs.writeFile(
    path.join(OUT_DIR, "champions_index.json"),
    JSON.stringify({ version, champions: champs }, null, 2)
  );

  await fs.writeFile(
    path.join(OUT_DIR, "champions_full.json"),
    JSON.stringify({ version, champions: full }, null, 2)
  );

  console.log("[lol:fetch] DONE ✅ saved to:", OUT_DIR);
  console.log("[lol:fetch] champions_full.json size:",
    (await fs.stat(path.join(OUT_DIR, "champions_full.json"))).size,
    "bytes"
  );
}

main().catch((err) => {
  console.error("[lol:fetch] ERROR ❌", err);
  process.exit(1);
});
