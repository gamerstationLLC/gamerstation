// app/tools/lol/summoner/[region]/[gameName]/[tagLine]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import SummonerProfileClient from "./client";
import {
  platformToCluster,
  riotFetchJson,
  riotHostForCluster,
  riotHostForPlatform,
  type PlatformRegion,
} from "@/lib/riot";

export const revalidate = 300; // ISR: refresh at most every 5 minutes

type Params = {
  region: PlatformRegion;
  gameName: string;
  tagLine: string;
};

type AccountByRiotId = {
  puuid: string;
  gameName: string;
  tagLine: string;
};

type SummonerByPuuid = {
  id: string;
  accountId: string;
  puuid: string;
  name: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
};

type SummonerByName = {
  id: string;
  accountId: string;
  puuid: string;
  name: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
};

type MatchV5 = {
  metadata: { matchId: string; participants: string[] };
  info: {
    gameCreation: number;
    gameDuration: number;
    gameMode: string;
    gameVersion: string;
    queueId: number;
    participants: Array<{
      puuid: string;
      summonerName: string;
      championName: string;
      champLevel: number;
      teamId: number;
      win: boolean;
      kills: number;
      deaths: number;
      assists: number;
      totalMinionsKilled: number;
      neutralMinionsKilled: number;
      goldEarned: number;
      totalDamageDealtToChampions: number;
      visionScore: number;
      teamPosition: string;
      lane: string;
      role: string;
      item0: number;
      item1: number;
      item2: number;
      item3: number;
      item4: number;
      item5: number;
      item6: number;
    }>;
  };
};

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function isValidPlatformRegion(v: string): v is PlatformRegion {
  return [
    "na1",
    "br1",
    "la1",
    "la2",
    "oc1",
    "euw1",
    "eun1",
    "tr1",
    "ru",
    "kr",
    "jp1",
    "ph2",
    "sg2",
    "th2",
    "tw2",
    "vn2",
  ].includes(v);
}

function kda(k: number, d: number, a: number) {
  if (d === 0) return (k + a).toFixed(2);
  return ((k + a) / d).toFixed(2);
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (t: T, idx: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      out[idx] = await fn(items[idx], idx);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function deriveDdVersionFromGameVersion(gameVersion: string | undefined) {
  if (!gameVersion) return undefined;
  const parts = gameVersion.split(".");
  if (parts.length < 2) return undefined;
  return `${parts[0]}.${parts[1]}.1`;
}

export default async function SummonerProfilePage({ params }: { params: Params }) {
  // ✅ Next.js 16 expects params as an object, NOT a Promise
  const regionRaw = safeDecode(String(params.region));
  const gameNameRaw = safeDecode(params.gameName);
  const tagLineRaw = safeDecode(params.tagLine);

  // Support some “weird but valid” inputs:
  // - plus signs coming from URLs
  // - extra spaces
  const gameName = gameNameRaw.replace(/\+/g, " ").trim();
  const tagLine = tagLineRaw.replace(/\+/g, " ").trim();

  if (!isValidPlatformRegion(regionRaw)) notFound();
  const region = regionRaw;

  const cluster = platformToCluster(region);

  // 1) Resolve PUUID by Riot ID (Account-V1).
  // 2) Fallback: treat `gameName` as Summoner Name (Summoner-V4 by-name).
  let puuid: string | null = null;
  let displayName = `${gameName}#${tagLine}`;
  let usedFallbackByName = false;

  const accountUrl = `${riotHostForCluster(
    cluster
  )}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
    gameName
  )}/${encodeURIComponent(tagLine)}`;

  const account = await riotFetchJson<AccountByRiotId>(accountUrl, {
    revalidate: 300,
    attempts: 2,
    softFail: true,
    log: false,
  });

  if (account?.puuid) {
    puuid = account.puuid;
    displayName = `${account.gameName}#${account.tagLine}`;
  } else {
    usedFallbackByName = true;

    const byNameUrl = `${riotHostForPlatform(
      region
    )}/lol/summoner/v4/summoners/by-name/${encodeURIComponent(gameName)}`;

    const s = await riotFetchJson<SummonerByName>(byNameUrl, {
      revalidate: 300,
      attempts: 2,
      softFail: true,
      log: false,
    });

    if (!s?.puuid) notFound();
    puuid = s.puuid;
    displayName = s.name;
  }

  if (!puuid) notFound();

  // Summoner profile (should be stable)
  const summonerUrl = `${riotHostForPlatform(
    region
  )}/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`;

  const summoner = await riotFetchJson<SummonerByPuuid>(summonerUrl, {
    revalidate: 300,
    attempts: 2,
    softFail: true,
    log: false,
  });

  if (!summoner) notFound();

  // Match IDs list
  const matchIdsUrl = `${riotHostForCluster(
    cluster
  )}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=20`;

  const matchIds = (await riotFetchJson<string[]>(matchIdsUrl, {
    revalidate: 300,
    attempts: 2,
    softFail: true,
    log: false,
  })) ?? [];

  // Match details: Riot sometimes returns 500 for match-v5 temporarily.
  // We soft-fail each match fetch, filter nulls, and expose partial stats.
  const toAttempt = matchIds.slice(0, 12);

  const matchDetailsRaw = await mapLimit(toAttempt, 4, async (matchId) => {
    const matchUrl = `${riotHostForCluster(cluster)}/lol/match/v5/matches/${encodeURIComponent(
      matchId
    )}`;
    return riotFetchJson<MatchV5>(matchUrl, {
      revalidate: 300,
      attempts: 2,
      softFail: true,
      log: false, // ✅ don’t spam logs when Riot is melting
    });
  });

  const matchDetails = matchDetailsRaw.filter((m): m is MatchV5 => Boolean(m));
  const failedMatches = matchDetailsRaw.length - matchDetails.length;

  // Derive DDragon version from first loaded match if available
  const ddVersion = deriveDdVersionFromGameVersion(matchDetails?.[0]?.info?.gameVersion);

  const rows = matchDetails
    .map((m) => {
      const me = m.info.participants.find((x) => x.puuid === puuid);
      if (!me) return null;

      const cs = me.totalMinionsKilled + me.neutralMinionsKilled;

      return {
        matchId: m.metadata.matchId,
        createdAt: m.info.gameCreation,
        durationSec: m.info.gameDuration,
        mode: m.info.gameMode,
        queueId: m.info.queueId,
        gameVersion: m.info.gameVersion,
        win: me.win,
        champ: me.championName,
        role: me.teamPosition || me.lane || me.role,
        kills: me.kills,
        deaths: me.deaths,
        assists: me.assists,
        kda: kda(me.kills, me.deaths, me.assists),
        cs,
        gold: me.goldEarned,
        dmgToChamps: me.totalDamageDealtToChampions,
        vision: me.visionScore,
        items: [me.item0, me.item1, me.item2, me.item3, me.item4, me.item5, me.item6],
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const total = rows.length || 1;
  const wins = rows.filter((r) => r.win).length;
  const losses = rows.filter((r) => !r.win).length;

  const sum = rows.reduce(
    (acc, r) => {
      acc.k += r.kills;
      acc.d += r.deaths;
      acc.a += r.assists;
      acc.cs += r.cs;
      acc.gold += r.gold;
      acc.dmg += r.dmgToChamps;
      acc.vis += r.vision;
      return acc;
    },
    { k: 0, d: 0, a: 0, cs: 0, gold: 0, dmg: 0, vis: 0 }
  );

  const champCounts = new Map<string, number>();
  for (const r of rows) champCounts.set(r.champ, (champCounts.get(r.champ) ?? 0) + 1);

  const topChamps = Array.from(champCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([champ, games]) => ({ champ, games }));

  const data = {
    region,
    riotId: displayName,
    puuid,
    summoner: {
      profileIconId: summoner.profileIconId,
      summonerLevel: summoner.summonerLevel,
    },
    summary: {
      games: rows.length,
      wins,
      losses,
      winRate: rows.length ? Math.round((wins / rows.length) * 100) : 0,
      k: sum.k,
      d: sum.d,
      a: sum.a,
      kda: kda(sum.k, sum.d, sum.a),
      avgCs: Math.round(sum.cs / total),
      avgGold: Math.round(sum.gold / total),
      avgDmgToChamps: Math.round(sum.dmg / total),
      avgVision: Math.round(sum.vis / total),
      topChamps,
    },
    matches: rows,
    meta: {
      usedFallbackByName,
      attemptedRiotId: `${gameName}#${tagLine}`,
      ddVersion,
      partial: {
        idsReturned: matchIds.length,
        matchDetailsAttempted: toAttempt.length,
        matchDetailsLoaded: matchDetails.length,
        failedMatches,
      },
    },
  };

  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  return (
    <main className="min-h-screen bg-transparent text-white px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/gs-logo-v2.png"
              alt="GamerStation"
              className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_30px_rgba(0,255,255,0.25)]"
            />
            <span className="text-lg font-black">
              GamerStation<span className="align-super text-[0.6em]">™</span>
            </span>
          </Link>

          <Link href="/tools/lol/summoner" className={navBtn}>
            New Lookup
          </Link>
        </header>

        <div className="mt-8">
          <SummonerProfileClient data={data as any} />
        </div>
      </div>
    </main>
  );
}
