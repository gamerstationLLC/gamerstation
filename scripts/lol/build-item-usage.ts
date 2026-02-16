// scripts/lol/build-item-usage.ts
/* eslint-disable no-console */

import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

type BuildRow = {
  buildSig: string;
  boots: number | null;
  core: number[];
  items: number[]; // includes boots if present
  summoners?: number[];
  games: number;
  wins: number;
  winrate?: number;
  score?: number;
};

type MetaBuildFile = {
  generatedAt?: string;
  queues?: number[];
  useTimeline?: boolean;
  patchMajorMinorOnly?: boolean;
  minSample?: number;
  minDisplaySample?: number;
  bayesK?: number;
  priorWinrate?: number;
  minPatchMajor?: number;
  patches?: Record<
    string, // e.g. "16+"
    Record<
      string, // champId as string: "1", "2", ...
      Record<
        string, // role: "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY"
        BuildRow[]
      >
    >
  >;
};

type ItemChampRow = {
  champId: number;
  games: number;
  wins: number;
  winrate: number; // 0..1
};

type ItemUsageRow = {
  itemId: number;
  slug: string;
  games: number;
  wins: number;
  winrate: number; // 0..1
  topChamps: ItemChampRow[]; // most popular champs building the item
};

type ItemUsageFile = {
  generatedAt: string;
  source: "ranked" | "casual" | "combined";
  patchBucket?: string; // e.g. "16+" if only one bucket exists
  items: ItemUsageRow[];
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function safeNum(n: any, fallback = 0) {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? x : fallback;
}

async function readJsonFromPathOrUrl(input: string): Promise<any> {
  const s = (input || "").trim();
  if (!s) throw new Error("Empty input");

  if (s.startsWith("http://") || s.startsWith("https://")) {
    const res = await fetch(s);
    if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${s}`);
    return res.json();
  }

  const p = path.resolve(process.cwd(), s);
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

async function ensureDirForFile(outPath: string) {
  const dir = path.dirname(outPath);
  if (!existsSync(dir)) await fs.mkdir(dir, { recursive: true });
}

/**
 * Builds item usage aggregations from your schema:
 * patches[bucket][champId][role] -> BuildRow[]
 *
 * We treat each BuildRow as "this champion played this build in X games and won Y times".
 * For each item used in that build, we increment:
 *  - item totals (games/wins)
 *  - item+champ totals (games/wins)
 */
function buildUsageFromMeta(meta: MetaBuildFile): { patchBucket?: string; items: ItemUsageRow[] } {
  const patches = meta?.patches ?? {};
  const bucketKeys = Object.keys(patches);

  // If there’s exactly one patch bucket (like "16+"), store it for debugging/metadata.
  const patchBucket = bucketKeys.length === 1 ? bucketKeys[0] : undefined;

  // itemId -> totals + per champ
  const itemTotals = new Map<
    number,
    { games: number; wins: number; champs: Map<number, { games: number; wins: number }> }
  >();

  for (const bucket of bucketKeys) {
    const champsObj = patches[bucket] ?? {};
    for (const champIdStr of Object.keys(champsObj)) {
      const champId = Number(champIdStr);
      if (!Number.isFinite(champId) || champId <= 0) continue;

      const rolesObj = champsObj[champIdStr] ?? {};
      for (const role of Object.keys(rolesObj)) {
        const builds: BuildRow[] = Array.isArray(rolesObj[role]) ? rolesObj[role] : [];
        for (const b of builds) {
          const games = safeNum(b?.games, 0);
          const wins = safeNum(b?.wins, 0);
          if (games <= 0) continue;

          const itemsArr = Array.isArray(b?.items) ? b.items : [];
          if (!itemsArr.length) continue;

          // Deduplicate within a build row so a single build doesn't double-count an item.
          const uniqueItemIds = Array.from(
            new Set(itemsArr.map((x) => safeNum(x, NaN)).filter((x) => Number.isFinite(x) && x > 0))
          );

          for (const itemId of uniqueItemIds) {
            const cur =
              itemTotals.get(itemId) ??
              ({
                games: 0,
                wins: 0,
                champs: new Map<number, { games: number; wins: number }>(),
              } as {
                games: number;
                wins: number;
                champs: Map<number, { games: number; wins: number }>;
              });

            cur.games += games;
            cur.wins += Math.max(0, Math.min(wins, games));

            const cc = cur.champs.get(champId) ?? { games: 0, wins: 0 };
            cc.games += games;
            cc.wins += Math.max(0, Math.min(wins, games));
            cur.champs.set(champId, cc);

            itemTotals.set(itemId, cur);
          }
        }
      }
    }
  }

  const items: ItemUsageRow[] = [];
  for (const [itemId, t] of itemTotals.entries()) {
    const winrate = t.games > 0 ? clamp01(t.wins / t.games) : 0;

    const topChamps: ItemChampRow[] = Array.from(t.champs.entries())
      .map(([champId, c]) => ({
        champId,
        games: c.games,
        wins: c.wins,
        winrate: c.games > 0 ? clamp01(c.wins / c.games) : 0,
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 12); // top 12 champs for “pairs well with”

    items.push({
      itemId,
      slug: `item-${itemId}`, // will replace later with slugify(ddragonName)
      games: t.games,
      wins: t.wins,
      winrate,
      topChamps,
    });
  }

  // Sort by popularity
  items.sort((a, b) => b.games - a.games);

  return { patchBucket, items };
}

/**
 * Merge ranked + casual item usage.
 * We recompute topChamps from merged per-champ totals to keep correctness.
 */
function mergeUsage(a: ItemUsageFile, b: ItemUsageFile): ItemUsageFile {
  const merged = new Map<
    number,
    { games: number; wins: number; champs: Map<number, { games: number; wins: number }> }
  >();

  const ingest = (file: ItemUsageFile) => {
    for (const it of file.items) {
      const cur =
        merged.get(it.itemId) ??
        ({ games: 0, wins: 0, champs: new Map() } as {
          games: number;
          wins: number;
          champs: Map<number, { games: number; wins: number }>;
        });

      cur.games += it.games;
      cur.wins += it.wins;

      for (const c of it.topChamps) {
        const cc = cur.champs.get(c.champId) ?? { games: 0, wins: 0 };
        cc.games += c.games;
        cc.wins += c.wins;
        cur.champs.set(c.champId, cc);
      }

      merged.set(it.itemId, cur);
    }
  };

  ingest(a);
  ingest(b);

  const items: ItemUsageRow[] = [];
  for (const [itemId, t] of merged.entries()) {
    const topChamps: ItemChampRow[] = Array.from(t.champs.entries())
      .map(([champId, c]) => ({
        champId,
        games: c.games,
        wins: c.wins,
        winrate: c.games > 0 ? clamp01(c.wins / c.games) : 0,
      }))
      .sort((x, y) => y.games - x.games)
      .slice(0, 12);

    items.push({
      itemId,
      slug: `item-${itemId}`,
      games: t.games,
      wins: t.wins,
      winrate: t.games > 0 ? clamp01(t.wins / t.games) : 0,
      topChamps,
    });
  }

  items.sort((x, y) => y.games - x.games);

  return {
    generatedAt: new Date().toISOString(),
    source: "combined",
    patchBucket: a.patchBucket || b.patchBucket,
    items,
  };
}

async function writeJson(outPath: string, data: any) {
  await ensureDirForFile(outPath);
  await fs.writeFile(outPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`✅ wrote ${outPath}`);
}

async function main() {
  const rankedInput = process.env.META_RANKED?.trim() || "public/data/lol/meta_builds_ranked.json";
  const casualInput = process.env.META_CASUAL?.trim() || "public/data/lol/meta_builds_casual.json";

  const rankedOut = "public/data/lol/items_usage_ranked.json";
  const casualOut = "public/data/lol/items_usage_casual.json";
  const combinedOut = "public/data/lol/items_usage_combined.json";

  let rankedFile: ItemUsageFile = {
    generatedAt: new Date().toISOString(),
    source: "ranked",
    items: [],
  };

  let casualFile: ItemUsageFile = {
    generatedAt: new Date().toISOString(),
    source: "casual",
    items: [],
  };

  // Workflow-safe: never throw hard
  try {
    const rankedMeta = (await readJsonFromPathOrUrl(rankedInput)) as MetaBuildFile;
    const rankedBuilt = buildUsageFromMeta(rankedMeta);
    rankedFile = {
      generatedAt: new Date().toISOString(),
      source: "ranked",
      patchBucket: rankedBuilt.patchBucket,
      items: rankedBuilt.items,
    };
  } catch (err) {
    console.error("⚠️ ranked item usage build failed:", err);
    process.exitCode = 0;
  }

  try {
    const casualMeta = (await readJsonFromPathOrUrl(casualInput)) as MetaBuildFile;
    const casualBuilt = buildUsageFromMeta(casualMeta);
    casualFile = {
      generatedAt: new Date().toISOString(),
      source: "casual",
      patchBucket: casualBuilt.patchBucket,
      items: casualBuilt.items,
    };
  } catch (err) {
    console.error("⚠️ casual item usage build failed:", err);
    process.exitCode = 0;
  }

  await writeJson(rankedOut, rankedFile);
  await writeJson(casualOut, casualFile);

  const combined = mergeUsage(rankedFile, casualFile);
  await writeJson(combinedOut, combined);

  console.log("🎉 item usage build complete");
}

main().catch((e) => {
  console.error("⚠️ fatal (but workflow-safe):", e);
  process.exitCode = 0;
});
