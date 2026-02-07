// app/tools/lol/leaderboard/page.tsx
import type { Metadata } from "next";
import LeaderboardClient, { type LeaderboardRow } from "./client";
import { readPublicJson } from "@/lib/server/readPublicJson";

export const metadata: Metadata = {
  title: "LoL Leaderboard | GamerStation",
  description:
    "League of Legends leaderboards by region and queue. Browse top players and jump into profile pages.",
  alternates: { canonical: "/tools/lol/leaderboard" },
};

// ✅ ISR is perfect here (Blob-backed JSON)
export const revalidate = 300; // 5 minutes

type RegionKey = "na1" | "euw1" | "kr";
type QueueKey = "RANKED_SOLO_5x5" | "RANKED_FLEX_SR";
type TierKey = "CHALLENGER" | "GRANDMASTER" | "MASTER";

type LeaderboardJson = {
  generatedAt: string;
  region: RegionKey;
  queue: QueueKey;
  tier: TierKey;
  count: number;
  players: Array<{
    puuid: string;

    summonerId: string;
    summonerName: string;
    profileIconId?: number | null;
    summonerLevel?: number | null;

    leaguePoints: number;
    wins: number;
    losses: number;

    hotStreak?: boolean;
    inactive?: boolean;
    veteran?: boolean;
    freshBlood?: boolean;
  }>;
};

const DEFAULT_REGION: RegionKey = "na1";
const DEFAULT_QUEUE: QueueKey = "RANKED_SOLO_5x5";
const DEFAULT_TIER: TierKey = "CHALLENGER";

function buildLeaderboardPath(region: RegionKey, queue: QueueKey, tier: TierKey) {
  // matches your existing output folder structure:
  // public/data/lol/leaderboards/<region>/<queue>.<tierLower>.json
  return `data/lol/leaderboards/${region}/${queue}.${tier.toLowerCase()}.json`;
}

async function loadLeaderboardJson(
  region: RegionKey,
  queue: QueueKey,
  tier: TierKey
): Promise<LeaderboardJson | null> {
  const pathname = buildLeaderboardPath(region, queue, tier);

  try {
    // ✅ disk-first; if missing, fetches from Blob using NEXT_PUBLIC_BLOB_BASE_URL
    return await readPublicJson<LeaderboardJson>(pathname, {
      revalidateSeconds: revalidate,
    });
  } catch {
    return null;
  }
}

function toRows(json: LeaderboardJson | null): LeaderboardRow[] {
  if (!json?.players?.length) return [];
  return json.players.map((p, idx) => ({
    rank: idx + 1,
    puuid: p.puuid,

    summonerId: p.summonerId ?? null,
    summonerName: p.summonerName ?? null,
    profileIconId: p.profileIconId ?? null,
    summonerLevel: p.summonerLevel ?? null,

    region: json.region,
    queue: json.queue,
    tier: json.tier,

    lp: p.leaguePoints,
    wins: p.wins,
    losses: p.losses,

    flags: {
      hotStreak: !!p.hotStreak,
      inactive: !!p.inactive,
      veteran: !!p.veteran,
      freshBlood: !!p.freshBlood,
    },
  }));
}

export default async function LolLeaderboardPage() {
  const json = await loadLeaderboardJson(DEFAULT_REGION, DEFAULT_QUEUE, DEFAULT_TIER);
  const rows = toRows(json);

  return (
    <LeaderboardClient
      initialRows={rows}
      initialRegion={DEFAULT_REGION}
      initialQueue={DEFAULT_QUEUE}
      initialTier={DEFAULT_TIER}
      initialGeneratedAt={json?.generatedAt ?? null}
    />
  );
}
