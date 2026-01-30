// app/tools/lol/leaderboard/page.tsx
import type { Metadata } from "next";
import LeaderboardClient, { type LeaderboardRow } from "./client";
import fs from "node:fs/promises";
import path from "node:path";

export const metadata: Metadata = {
  title: "LoL Leaderboard | GamerStation",
  description:
    "League of Legends leaderboards by region and queue. Browse top players and jump into profile pages.",
  alternates: { canonical: "/tools/lol/leaderboard" },
};

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

async function readLeaderboardJson(
  region: RegionKey,
  queue: QueueKey,
  tier: TierKey
): Promise<LeaderboardJson | null> {
  const file = path.join(
    process.cwd(),
    "public",
    "data",
    "lol",
    "leaderboards",
    region,
    `${queue}.${tier.toLowerCase()}.json`
  );

  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as LeaderboardJson;
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
  const json = await readLeaderboardJson(DEFAULT_REGION, DEFAULT_QUEUE, DEFAULT_TIER);
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
