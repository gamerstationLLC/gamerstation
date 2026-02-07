// scripts/riot/finalize-meta-builds-from-cache.ts
// Offline finalize: reads cached Match-V5 JSONs and writes meta_builds_{ranked,casual}.json
// ✅ SAFETY: will NEVER wipe existing outputs.
//    - We compute "new" results from cache
//    - Then MERGE them into the existing output JSONs
//    - If a champ/role has no new data this run, we KEEP the old data
//    - If computed output is empty, we DO NOT write anything

import fs from "node:fs/promises";
import path from "node:path";

type RiotMatch = {
  info?: {
    gameVersion?: string;
    queueId?: number;
    participants?: Array<{
      championId?: number;
      teamPosition?: string;
      item0?: number;
      item1?: number;
      item2?: number;
      item3?: number;
      item4?: number;
      item5?: number;
      item6?: number;
      summoner1Id?: number;
      summoner2Id?: number;
      win?: boolean;
    }>;
  };
};

type Role = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";

type BuildParts = {
  boots: number | null;
  core: number[]; // up to 3
  items: number[]; // boots + core (display)
  summoners: number[]; // display only
};

type Leaf = { games: number; wins: number; build: BuildParts };

// Agg: patchKey -> champId -> role -> sig -> leaf
type Agg = Record<string, Record<string, Partial<Record<Role, Record<string, Leaf>>>>>;

// Output JSON shape (what your client reads)
type OutBuild = {
  buildSig: string;
  boots: number | null;
  core: number[];
  items: number[];
  summoners: number[];
  games: number;
  wins: number;
  winrate: number;
  score: number;
};

type OutJson = {
  generatedAt: string;
  queues: number[];
  useTimeline: boolean;
  patchMajorMinorOnly: boolean;
  minSample: number;
  minDisplaySample: number;
  bayesK: number;
  priorWinrate: number;
  minPatchMajor: number;
  patches: Record<string, Record<string, Partial<Record<Role, OutBuild[]>>>>;
};

// -------------------- helpers --------------------

function patchMajor(gameVersion: string | undefined): number | null {
  if (!gameVersion) return null;
  const m = String(gameVersion).match(/^(\d+)\./);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function normPos(pos: string | undefined): Role | null {
  const p = (pos || "").toUpperCase();
  if (p === "TOP") return "TOP";
  if (p === "JUNGLE") return "JUNGLE";
  if (p === "MIDDLE" || p === "MID") return "MIDDLE";
  if (p === "BOTTOM" || p === "BOT") return "BOTTOM";
  if (p === "UTILITY" || p === "SUPPORT") return "UTILITY";
  return null;
}

async function listJsonFiles(dir: string): Promise<string[]> {
  let entries: any[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: string[] = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listJsonFiles(p)));
    else if (e.isFile() && e.name.toLowerCase().endsWith(".json")) out.push(p);
  }
  return out;
}

function bayesScore(wins: number, games: number, k: number, prior: number) {
  const a = prior * k + wins;
  const b = (1 - prior) * k + (games - wins);
  return a / (a + b);
}

function inc(
  agg: Agg,
  patchKey: string,
  champId: number,
  role: Role,
  sig: string,
  win: boolean,
  build: BuildParts
) {
  const p = (agg[patchKey] ||= {});
  const c = (p[String(champId)] ||= {});
  const r = (c[role] ||= {});
  const leaf = (r[sig] ||= { games: 0, wins: 0, build });
  leaf.games += 1;
  if (win) leaf.wins += 1;
}

function toNum(x: any): number {
  const n = Number(x || 0);
  return Number.isFinite(n) ? n : 0;
}

function uniqKeepOrder(nums: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const n of nums) {
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

type ItemsDdragon = { data?: Record<string, { tags?: string[] }> };

async function loadBootSet(repoRoot: string): Promise<Set<number>> {
  const p = path.join(repoRoot, "public", "data", "lol", "items.json");
  const raw = await fs.readFile(p, "utf-8");
  const json = JSON.parse(raw) as ItemsDdragon;

  const boots = new Set<number>();
  for (const [idStr, it] of Object.entries(json.data || {})) {
    const id = Number(idStr);
    if (!Number.isFinite(id) || id <= 0) continue;
    const tags = Array.isArray(it.tags) ? it.tags : [];
    if (tags.includes("Boots")) boots.add(id);
  }
  return boots;
}

function extractBootsAndCore(p: any, bootSet: Set<number>): BuildParts {
  const raw = [
    toNum(p?.item0),
    toNum(p?.item1),
    toNum(p?.item2),
    toNum(p?.item3),
    toNum(p?.item4),
    toNum(p?.item5),
  ].filter((x) => x > 0);

  const items = uniqKeepOrder(raw);

  let boots: number | null = null;
  for (const id of items) {
    if (bootSet.has(id)) {
      boots = id;
      break;
    }
  }

  const core: number[] = [];
  for (const id of items) {
    if (boots && id === boots) continue;
    core.push(id);
    if (core.length >= 3) break;
  }

  const summoners = [toNum(p?.summoner1Id), toNum(p?.summoner2Id)]
    .filter((x) => x > 0)
    .sort((a, b) => a - b);

  const displayItems = ([...(boots ? [boots] : []), ...core] as number[]).filter(
    (x) => x > 0
  );

  return { boots, core, items: displayItems, summoners };
}

function buildSig(b: BuildParts): string {
  const bPart = b.boots ? String(b.boots) : "0";
  const cPart = b.core.join(",");
  return `b=${bPart}|c=${cPart}`;
}

function topBuildsForRole(
  roleMap: Record<string, Leaf>,
  minDisplaySample: number,
  bayesK: number,
  priorWinrate: number
) {
  const entries = Object.entries(roleMap)
    .map(([sig, leaf]) => {
      const games = leaf.games;
      const wins = leaf.wins;
      const winrate = games > 0 ? wins / games : 0;
      const score = bayesScore(wins, games, bayesK, priorWinrate);
      return {
        buildSig: sig,
        ...leaf.build,
        games,
        wins,
        winrate: Number(winrate.toFixed(4)),
        score: Number(score.toFixed(6)),
      };
    })
    // suppress low sample entirely (so 1–9 game 100% never shows)
    .filter((x) => x.games >= minDisplaySample)
    .sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;
      return b.score - a.score;
    });

  return entries.slice(0, 10);
}

// Stronger “has any data” check: patch->champ->role must have at least one non-empty build list
function computedHasAnyBuilds(obj: OutJson): boolean {
  const patches = obj.patches || {};
  for (const pk of Object.keys(patches)) {
    const champs = patches[pk] || {};
    for (const champId of Object.keys(champs)) {
      const roles = champs[champId] || {};
      for (const role of Object.keys(roles as any)) {
        const builds = (roles as any)[role];
        if (Array.isArray(builds) && builds.length > 0) return true;
      }
    }
  }
  return false;
}

async function readJsonIfExists<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Merge rule (your requirement: "only add to it"):
 * - Keep EVERYTHING that already exists in the file.
 * - If we have new computed data for a given patch/champ/role, overwrite that role with the new list
 *   (because it represents the best/current top builds).
 * - If computed has no data for that champ/role, keep the old one (so we never wipe).
 */
function mergeOutputs(existing: OutJson | null, computed: OutJson): OutJson {
  if (!existing) return computed;

  const out: OutJson = {
    ...existing,
    // refresh header fields from computed (keeps metadata accurate)
    generatedAt: computed.generatedAt,
    queues: computed.queues,
    useTimeline: computed.useTimeline,
    patchMajorMinorOnly: computed.patchMajorMinorOnly,
    minSample: computed.minSample,
    minDisplaySample: computed.minDisplaySample,
    bayesK: computed.bayesK,
    priorWinrate: computed.priorWinrate,
    minPatchMajor: computed.minPatchMajor,
    patches: { ...(existing.patches || {}) },
  };

  // Union patches/champs/roles, with computed overwriting only where it has data
  for (const [patchKey, champs] of Object.entries(computed.patches || {})) {
    out.patches[patchKey] ||= {};
    for (const [champId, roles] of Object.entries(champs || {})) {
      out.patches[patchKey]![champId] ||= {};
      for (const [role, builds] of Object.entries(roles as any)) {
        if (Array.isArray(builds) && builds.length > 0) {
          (out.patches[patchKey]![champId] as any)[role] = builds;
        }
      }
    }
  }

  return out;
}

async function buildComputedOut(params: {
  queues: number[];
  agg: Agg;
  useTimeline: boolean;
  patchMajorMinorOnly: boolean;
  minSample: number;
  minDisplaySample: number;
  bayesK: number;
  priorWinrate: number;
  minPatchMajor: number;
}): Promise<OutJson> {
  const obj: OutJson = {
    generatedAt: new Date().toISOString(),
    queues: params.queues,
    useTimeline: params.useTimeline,
    patchMajorMinorOnly: params.patchMajorMinorOnly,
    minSample: params.minSample,
    minDisplaySample: params.minDisplaySample,
    bayesK: params.bayesK,
    priorWinrate: params.priorWinrate,
    minPatchMajor: params.minPatchMajor,
    patches: {},
  };

  for (const [patchKey, champs] of Object.entries(params.agg)) {
    obj.patches[patchKey] = {};
    for (const [champId, roles] of Object.entries(champs)) {
      obj.patches[patchKey]![champId] = {};
      for (const [role, sigMap] of Object.entries(roles as any)) {
        const top = topBuildsForRole(
          sigMap as Record<string, Leaf>,
          params.minDisplaySample,
          params.bayesK,
          params.priorWinrate
        );
        if (top.length) (obj.patches[patchKey]![champId] as any)[role] = top;
      }
    }
  }

  return obj;
}

// -------------------- main --------------------

async function main() {
  const repoRoot = process.cwd();
  const cacheMatchesDir = path.join(
    repoRoot,
    "scripts",
    "riot",
    "cache",
    "matches"
  );
  const outDir = path.join(repoRoot, "public", "data", "lol");

  // queues
  const rankedQueues = [420];
  const casualQueues = [400, 430];

  // knobs (env driven; safe defaults)
  const MIN_DISPLAY_SAMPLE = Number(process.env.MIN_DISPLAY_SAMPLE || 10);
  const BAYES_K = Number(process.env.BAYES_K || 100);
  const PRIOR_WINRATE = Number(process.env.PRIOR_WINRATE || 0.5);
  const MIN_PATCH_MAJOR = Number(process.env.MIN_PATCH_MAJOR || 16);

  // you’re bucketizing into one patch key
  const patchKey = `${MIN_PATCH_MAJOR}+`;

  const bootSet = await loadBootSet(repoRoot);

  const files = await listJsonFiles(cacheMatchesDir);

  if (!files.length) {
    console.error("No cached matches found at:", cacheMatchesDir);
    process.exit(1);
  }

  const rankedAgg: Agg = {};
  const casualAgg: Agg = {};

  const debug = {
    filesRead: 0,
    jsonParseFail: 0,
    noInfo: 0,
    queueNotTracked: 0,
    patchTooOld: 0,
    noParticipants: 0,
    badChamp: 0,
    badRole: 0,
    keptParticipants: 0,
    rankedParticipants: 0,
    casualParticipants: 0,
  };

  console.log("[debug] found files:", files.length);

  for (const fp of files) {
    let match: RiotMatch | null = null;
    try {
      const raw = await fs.readFile(fp, "utf-8");
      match = JSON.parse(raw) as RiotMatch;
    } catch {
      debug.jsonParseFail += 1;
      continue;
    }

    debug.filesRead += 1;

    const info = match?.info;
    if (!info) {
      debug.noInfo += 1;
      continue;
    }

    const q = Number(info.queueId || 0);
    const tracked = rankedQueues.includes(q) || casualQueues.includes(q);
    if (!tracked) {
      debug.queueNotTracked += 1;
      continue;
    }

    const major = patchMajor(info.gameVersion);
    if (!major || major < MIN_PATCH_MAJOR) {
      debug.patchTooOld += 1;
      continue;
    }

    const participants = Array.isArray(info.participants) ? info.participants : [];
    if (!participants.length) {
      debug.noParticipants += 1;
      continue;
    }

    for (const p of participants) {
      const champId = Number(p?.championId || 0);
      if (!champId) {
        debug.badChamp += 1;
        continue;
      }

      const role = normPos(p?.teamPosition);
      if (!role) {
        debug.badRole += 1;
        continue;
      }

      const build = extractBootsAndCore(p, bootSet);
      if (!build.core.length && !build.boots) continue;

      const sig = buildSig(build);
      const win = Boolean(p?.win);

      debug.keptParticipants += 1;

      if (rankedQueues.includes(q)) {
        debug.rankedParticipants += 1;
        inc(rankedAgg, patchKey, champId, role, sig, win, build);
      }
      if (casualQueues.includes(q)) {
        debug.casualParticipants += 1;
        inc(casualAgg, patchKey, champId, role, sig, win, build);
      }
    }
  }

  console.log("[finalize] DEBUG:", debug);
  console.log(
    `[finalize] agg keys: ranked=${Object.keys(rankedAgg).length} casual=${Object.keys(
      casualAgg
    ).length}`
  );

  // Build computed outputs
  const computedRanked = await buildComputedOut({
    queues: rankedQueues,
    agg: rankedAgg,
    useTimeline: false,
    patchMajorMinorOnly: false,
    minSample: 200,
    minDisplaySample: MIN_DISPLAY_SAMPLE,
    bayesK: BAYES_K,
    priorWinrate: PRIOR_WINRATE,
    minPatchMajor: MIN_PATCH_MAJOR,
  });

  const computedCasual = await buildComputedOut({
    queues: casualQueues,
    agg: casualAgg,
    useTimeline: false,
    patchMajorMinorOnly: false,
    minSample: 200,
    minDisplaySample: MIN_DISPLAY_SAMPLE,
    bayesK: BAYES_K,
    priorWinrate: PRIOR_WINRATE,
    minPatchMajor: MIN_PATCH_MAJOR,
  });

  // ✅ If computed is empty, refuse to write (prevents nukes)
  const rankedHas = computedHasAnyBuilds(computedRanked);
  const casualHas = computedHasAnyBuilds(computedCasual);

  const rankedPath = path.join(outDir, "meta_builds_ranked.json");
  const casualPath = path.join(outDir, "meta_builds_casual.json");

  // ranked: require data, otherwise do nothing
  if (!rankedHas) {
    console.warn(
      "[finalize] Ranked computed output empty. Refusing to overwrite ranked file."
    );
    process.exit(0);
  }

  const existingRanked = await readJsonIfExists<OutJson>(rankedPath);
  const existingCasual = await readJsonIfExists<OutJson>(casualPath);

  // ranked: always update if it has data
  const mergedRanked = mergeOutputs(existingRanked, computedRanked);
  await fs.mkdir(path.dirname(rankedPath), { recursive: true });
  await fs.writeFile(rankedPath, JSON.stringify(mergedRanked, null, 2), "utf-8");
  console.log(`[finalize] Wrote (merged): ${rankedPath}`);

  // casual: ONLY write if computed has any builds
  if (casualHas) {
    const mergedCasual = mergeOutputs(existingCasual, computedCasual);
    await fs.mkdir(path.dirname(casualPath), { recursive: true });
    await fs.writeFile(
      casualPath,
      JSON.stringify(mergedCasual, null, 2),
      "utf-8"
    );
    console.log(`[finalize] Wrote (merged): ${casualPath}`);
  } else {
    console.warn(
      "[finalize] Casual computed output empty. Keeping existing casual file (no write)."
    );
  }

  console.log(
    `[finalize] Patch bucket key: "${patchKey}" (major >= ${MIN_PATCH_MAJOR})`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
