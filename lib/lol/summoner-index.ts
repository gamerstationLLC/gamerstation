// lib/lol/summoner-index.ts
import "server-only";
import { put } from "@vercel/blob";

export type SummonerIndexEntry = {
  puuid: string;
  gameName: string;
  tagLine: string;
  platform: string; // na1, kr, euw1, etc
  cluster: string; // americas, europe, asia, sea
  seen: number;
  firstSeen: number; // ms
  lastSeen: number; // ms
};

export type SummonerIndex = {
  version: 1;
  updatedAt: number; // ms
  byPuuid: Record<string, SummonerIndexEntry>;
};

const DEFAULT_PATH = "data/lol/summoner_index.json";

function now() {
  return Date.now();
}

function emptyIndex(): SummonerIndex {
  return { version: 1, updatedAt: now(), byPuuid: {} };
}

async function readJson<T>(publicUrl: string): Promise<T | null> {
  const res = await fetch(publicUrl, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to read blob (${res.status})`);
  return (await res.json()) as T;
}

export type LogSummonerArgs = {
  puuid: string;
  gameName: string;
  tagLine: string;
  platform: string;
  cluster: string;
};

function clean(s: string) {
  return (s ?? "").trim();
}

function validIdPart(s: string) {
  return s.length > 0 && s.length <= 32;
}

export async function logSummonerToIndex(
  args: LogSummonerArgs,
  path = DEFAULT_PATH
) {
  const puuid = clean(args.puuid);
  const gameName = clean(args.gameName);
  const tagLine = clean(args.tagLine);
  const platform = clean(args.platform);
  const cluster = clean(args.cluster);

  if (!puuid || puuid.length < 10) throw new Error("Invalid puuid");
  if (!validIdPart(gameName) || !validIdPart(tagLine))
    throw new Error("Invalid Riot ID");
  if (!platform) throw new Error("Missing platform");
  if (!cluster) throw new Error("Missing cluster");

  const base =
    (process.env.BLOB_BASE_URL ||
      process.env.NEXT_PUBLIC_BLOB_BASE_URL ||
      "").replace(/\/+$/, "");

  if (!base)
    throw new Error(
      "Missing blob base url env (BLOB_BASE_URL or NEXT_PUBLIC_BLOB_BASE_URL)"
    );

  const publicUrl = `${base}/${path.replace(/^\/+/, "")}`;
  const existing = (await readJson<SummonerIndex>(publicUrl)) ?? emptyIndex();

  const t = now();
  const prev = existing.byPuuid[puuid];

  const nextEntry: SummonerIndexEntry = prev
    ? {
        ...prev,
        gameName,
        tagLine,
        platform,
        cluster,
        seen: (prev.seen ?? 0) + 1,
        lastSeen: t,
      }
    : {
        puuid,
        gameName,
        tagLine,
        platform,
        cluster,
        seen: 1,
        firstSeen: t,
        lastSeen: t,
      };

  const next: SummonerIndex = {
    version: 1,
    updatedAt: t,
    byPuuid: { ...existing.byPuuid, [puuid]: nextEntry },
  };

  const putRes = await put(path, JSON.stringify(next), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
    token: process.env.BLOB_READ_WRITE_TOKEN!,
  });

  return {
    entry: nextEntry,
    path,
    blobUrl: putRes.url,
    count: Object.keys(next.byPuuid).length,
    updatedAt: next.updatedAt,
  };
}

/* -------------------------
   Suggestions (READ + rank)
-------------------------- */

export type SummonerSuggestRow = {
  riotId: string;
  gameName: string;
  tagLine: string;
  platform: string;
  cluster: string;
  seen: number;
  lastSeen: number;
};

function norm(s: string) {
  return (s ?? "").trim().toLowerCase();
}

function scoreMatch(riotIdLower: string, gameLower: string, tagLower: string, qLower: string) {
  // Higher is better
  // 400: riotId startsWith
  // 350: gameName startsWith
  // 300: tagLine startsWith
  // 250: boundary match in riotId
  // 200: boundary match in gameName
  // 150: contains
  if (!qLower) return -1;

  if (riotIdLower.startsWith(qLower)) return 400;
  if (gameLower.startsWith(qLower)) return 350;
  if (tagLower.startsWith(qLower)) return 300;

  // "word boundary" style match (space/_/-/.)
  const boundary = new RegExp(`(^|[\\s_\\-\\.])${escapeRegExp(qLower)}`);
  if (boundary.test(riotIdLower)) return 250;
  if (boundary.test(gameLower)) return 200;

  if (riotIdLower.includes(qLower)) return 150;

  return -1;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function suggestSummoners(
  q: string,
  limit = 8
): Promise<SummonerSuggestRow[]> {
  const query = norm(q);
  if (!query || query.length < 2) return [];

  const base =
    (process.env.BLOB_BASE_URL ||
      process.env.NEXT_PUBLIC_BLOB_BASE_URL ||
      "").replace(/\/+$/, "");

  if (!base) return [];

  const url = `${base}/${DEFAULT_PATH}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];

    const json = (await res.json()) as SummonerIndex;
    const entries = Object.values(json.byPuuid ?? {});

    const scored = entries
      .map((e) => {
        const gameLower = norm(e.gameName);
        const tagLower = norm(e.tagLine);
        const riotId = `${e.gameName}#${e.tagLine}`;
        const riotLower = norm(riotId);

        const score = scoreMatch(riotLower, gameLower, tagLower, query);

        return {
          score,
          row: {
            riotId,
            gameName: e.gameName,
            tagLine: e.tagLine,
            platform: e.platform,
            cluster: e.cluster,
            seen: e.seen ?? 0,
            lastSeen: e.lastSeen ?? 0,
          } satisfies SummonerSuggestRow,
        };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => {
        // 1) match quality
        if (b.score !== a.score) return b.score - a.score;
        // 2) popularity
        if ((b.row.seen ?? 0) !== (a.row.seen ?? 0)) return (b.row.seen ?? 0) - (a.row.seen ?? 0);
        // 3) recency
        return (b.row.lastSeen ?? 0) - (a.row.lastSeen ?? 0);
      })
      .slice(0, Math.max(1, Math.min(20, limit)))
      .map((x) => x.row);

    return scored;
  } catch {
    return [];
  }
}
