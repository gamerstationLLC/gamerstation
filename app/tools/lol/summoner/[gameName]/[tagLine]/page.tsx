import Link from "next/link";
import { notFound } from "next/navigation";
import SummonerProfileClient from "./client";

export const revalidate = 300;

type RouteParams = { gameName: string; tagLine: string };

type AccountByRiotId = {
  puuid: string;
  gameName: string;
  tagLine: string;
};

type AccountByPuuid = {
  puuid: string;
  gameName: string;
  tagLine: string;
};

type SummonerV4 = {
  id: string; // ✅ encryptedSummonerId (needed for LP)
  accountId: string;
  puuid: string;
  name: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
};

type LeagueEntryV4 = {
  leagueId: string;
  queueType: string; // "RANKED_SOLO_5x5" | "RANKED_FLEX_SR" | ...
  tier: string; // "CHALLENGER" | "GRANDMASTER" | ...
  rank: string; // "I" | "II" | ...
  summonerId: string;
  summonerName: string;
  leaguePoints: number;
  wins: number;
  losses: number;
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

type PlayerRef = {
  gameName?: string;
  tagLine?: string;
  summonerName?: string;
  teamId?: number;
};

type MatchPlayers = {
  blue: PlayerRef[];
  red: PlayerRef[];
};

type SummonerProfileData = {
  riotId: string;
  platform: string;
  cluster: string;
  puuid: string;
  summoner: { profileIconId: number; summonerLevel: number };

  // ✅ NEW: Ranked (LP) info for header
  ranked?: {
    queue: "RANKED_SOLO_5x5" | "RANKED_FLEX_SR" | string;
    tier: string;
    rank: string;
    lp: number;
    wins: number;
    losses: number;
  } | null;

  summary: {
    games: number;
    wins: number;
    losses: number;
    winRate: number;
    k: number;
    d: number;
    a: number;
    kda: string;
    avgCs: number;
    avgGold: number;
    avgDmgToChamps: number;
    avgVision: number;
    topChamps: Array<{ champ: string; games: number }>;
  };
  matches: Array<{
    matchId: string;
    createdAt: number;
    durationSec: number;
    mode: string;
    queueId: number;
    gameVersion?: string;
    win: boolean;
    champ: string;
    role: string;
    kills: number;
    deaths: number;
    assists: number;
    kda: string;
    cs: number;
    gold: number;
    dmgToChamps: number;
    vision: number;
    items: number[];
    players?: MatchPlayers;
  }>;
  meta: {
    ddVersion?: string;
    matchIdsReturned: number;
    matchDetailsLoaded: number;
  };
};

/* ---------------------------
   Helpers (NO lib/riot.ts)
--------------------------- */

const PLATFORMS = [
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
] as const;

type Platform = (typeof PLATFORMS)[number];
type Cluster = "americas" | "europe" | "asia" | "sea";

function platformToCluster(p: Platform): Cluster {
  if (p === "na1" || p === "br1" || p === "la1" || p === "la2") return "americas";
  if (p === "euw1" || p === "eun1" || p === "ru" || p === "tr1") return "europe";
  if (p === "kr" || p === "jp1") return "asia";
  return "sea";
}

function riotHostForPlatform(p: Platform) {
  return `https://${p}.api.riotgames.com`;
}
function riotHostForCluster(c: Cluster) {
  return `https://${c}.api.riotgames.com`;
}

function mustKey() {
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new Error("Missing RIOT_API_KEY in environment.");
  return key;
}

function safeDecode(raw: string) {
  const s = String(raw ?? "");
  let out = s;
  try {
    out = decodeURIComponent(out);
  } catch {
    // ignore
  }
  out = out.replace(/\+/g, " ").trim();
  return out;
}

function normalizeName(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function normalizeTag(s: string) {
  return s.replace(/^#+/, "").replace(/\s+/g, "").trim();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function riotFetchJson<T>(
  url: string,
  {
    attempts = 4,
    softFail = true,
    revalidate,
  }: { attempts?: number; softFail?: boolean; revalidate?: number } = {}
): Promise<T | null> {
  const key = mustKey();

  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, {
      headers: { "X-Riot-Token": key },
      next: typeof revalidate === "number" ? { revalidate } : undefined,
    });

    if (res.ok) return (await res.json()) as T;
    if (res.status === 404) return null;

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && i < attempts - 1) {
      const ra = res.headers.get("retry-after");
      const raMs = ra ? Math.min(10_000, Number(ra) * 1000) : null;
      const backoff =
        Math.min(4000, 250 * Math.pow(2, i)) + Math.floor(Math.random() * 120);
      await sleep(raMs ?? backoff);
      continue;
    }

    if (softFail) return null;
    const body = await res.text().catch(() => "");
    throw new Error(`Riot error ${res.status} ${url} ${body}`);
  }

  return null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function kda(k: number, d: number, a: number) {
  if (d === 0) return (k + a).toFixed(2);
  return ((k + a) / d).toFixed(2);
}

function deriveDdVersion(gameVersion?: string) {
  if (!gameVersion) return undefined;
  const parts = gameVersion.split(".");
  if (parts.length < 2) return undefined;
  return `${parts[0]}.${parts[1]}.1`;
}

async function detectPlatformByPuuid(
  puuid: string
): Promise<{ platform: Platform; summoner: SummonerV4 } | null> {
  for (const p of PLATFORMS) {
    const url = `${riotHostForPlatform(p)}/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(
      puuid
    )}`;
    const s = await riotFetchJson<SummonerV4>(url, {
      attempts: 2,
      softFail: true,
      revalidate: 300,
    });
    if (s?.puuid) return { platform: p, summoner: s };
  }
  return null;
}

function pickRanked(entries: LeagueEntryV4[] | null) {
  if (!Array.isArray(entries) || entries.length === 0) return null;

  // Prefer Solo > Flex
  const solo = entries.find((e) => e.queueType === "RANKED_SOLO_5x5");
  const flex = entries.find((e) => e.queueType === "RANKED_FLEX_SR");
  const e = solo ?? flex ?? entries[0];
  if (!e) return null;

  return {
    queue: e.queueType,
    tier: e.tier,
    rank: e.rank,
    lp: e.leaguePoints,
    wins: e.wins,
    losses: e.losses,
  };
}

/* ---------------------------
   Page
--------------------------- */

export default async function SummonerProfilePage({
  params,
}: {
  params: Promise<RouteParams> | RouteParams;
}) {
  const p = await Promise.resolve(params as any);
  const gameName = normalizeName(safeDecode(p.gameName));
  const tagLine = normalizeTag(safeDecode(p.tagLine));

  if (!gameName || !tagLine) {
    return (
      <main className="min-h-screen px-6 py-16 text-white">
        <div className="mx-auto max-w-4xl">
          <Link href="/tools/lol/summoner" className="text-sm text-neutral-300 hover:text-white">
            ← New lookup
          </Link>
          <div className="mt-6 rounded-3xl border border-neutral-800 bg-black/45 p-6">
            <div className="text-2xl font-black">Invalid Riot ID</div>
            <div className="mt-2 text-neutral-300">Expected GameName#TAG.</div>
          </div>
        </div>
      </main>
    );
  }

  // 1) Account-V1 (regional) — we don’t know cluster yet, so try all clusters
  const clusters: Cluster[] = ["americas", "europe", "asia", "sea"];
  let account: AccountByRiotId | null = null;

  for (const c of clusters) {
    const url = `${riotHostForCluster(c)}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
      gameName
    )}/${encodeURIComponent(tagLine)}`;
    const a = await riotFetchJson<AccountByRiotId>(url, {
      attempts: 2,
      softFail: true,
      revalidate: 300,
    });
    if (a?.puuid) {
      account = a;
      break;
    }
  }

  if (!account?.puuid) notFound();

  // 2) Detect platform (Summoner-V4 probe)
  const detected = await detectPlatformByPuuid(account.puuid);
  if (!detected) notFound();

  const platform = detected.platform;
  const cluster = platformToCluster(platform);
  const summoner = detected.summoner;

  // ✅ 2.5) Ranked (LP) — League-V4 (platform routing)
  const leagueUrl = `${riotHostForPlatform(platform)}/lol/league/v4/entries/by-summoner/${encodeURIComponent(
    summoner.id
  )}`;
  const leagueEntries = await riotFetchJson<LeagueEntryV4[]>(leagueUrl, {
    attempts: 2,
    softFail: true,
    revalidate: 300,
  });
  const ranked = pickRanked(leagueEntries);

  // 3) Match IDs
  const matchIdsUrl = `${riotHostForCluster(cluster)}/lol/match/v5/matches/by-puuid/${encodeURIComponent(
    account.puuid
  )}/ids?start=0&count=20`;

  const matchIds = await riotFetchJson<string[]>(matchIdsUrl, {
    attempts: 3,
    softFail: true,
    revalidate: 300,
  });
  const ids = Array.isArray(matchIds) ? matchIds : [];

  // 4) Match details
  const toAttempt = ids.slice(0, 12);
  const matchDetails = await mapLimit(toAttempt, 4, async (matchId) => {
    const url = `${riotHostForCluster(cluster)}/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
    return riotFetchJson<MatchV5>(url, { attempts: 2, softFail: true, revalidate: 300 });
  });

  const loadedMatches = matchDetails.filter(Boolean) as MatchV5[];
  const ddVersion = deriveDdVersion(loadedMatches[0]?.info?.gameVersion);

  // ✅ NEW: Build RiotID map for participants (PUUID -> gameName/tagLine)
  const uniquePuuids = Array.from(
    new Set(
      loadedMatches.flatMap((m) => m.info.participants.map((p) => p.puuid).filter(Boolean))
    )
  );

  const accountByPuuid = new Map<string, { gameName: string; tagLine: string }>();

  // Fetch in a controlled way; soft-fail so page still loads even if Riot is cranky.
  const accountResults = await mapLimit(uniquePuuids, 6, async (puuid) => {
    const url = `${riotHostForCluster(cluster)}/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`;
    const a = await riotFetchJson<AccountByPuuid>(url, {
      attempts: 2,
      softFail: true,
      revalidate: 300,
    });
    return { puuid, a };
  });

  for (const r of accountResults) {
    if (r.a?.gameName && r.a?.tagLine) {
      accountByPuuid.set(r.puuid, { gameName: r.a.gameName, tagLine: r.a.tagLine });
    }
  }

  const rows = loadedMatches
    .map((m) => {
      const me = m.info.participants.find((x) => x.puuid === account!.puuid);
      if (!me) return null;

      const cs = (me.totalMinionsKilled || 0) + (me.neutralMinionsKilled || 0);

      const blue = m.info.participants
        .filter((p) => p.teamId === 100)
        .map((p) => {
          const riot = accountByPuuid.get(p.puuid);
          return {
            gameName: riot?.gameName,
            tagLine: riot?.tagLine,
            summonerName: p.summonerName,
            teamId: p.teamId,
          } satisfies PlayerRef;
        });

      const red = m.info.participants
        .filter((p) => p.teamId === 200)
        .map((p) => {
          const riot = accountByPuuid.get(p.puuid);
          return {
            gameName: riot?.gameName,
            tagLine: riot?.tagLine,
            summonerName: p.summonerName,
            teamId: p.teamId,
          } satisfies PlayerRef;
        });

      return {
        matchId: m.metadata.matchId,
        createdAt: m.info.gameCreation,
        durationSec: m.info.gameDuration,
        mode: m.info.gameMode,
        queueId: m.info.queueId,
        gameVersion: m.info.gameVersion,
        win: me.win,
        champ: me.championName,
        role: me.teamPosition || me.lane || me.role || "",
        kills: me.kills,
        deaths: me.deaths,
        assists: me.assists,
        kda: kda(me.kills, me.deaths, me.assists),
        cs,
        gold: me.goldEarned,
        dmgToChamps: me.totalDamageDealtToChampions,
        vision: me.visionScore,
        items: [me.item0, me.item1, me.item2, me.item3, me.item4, me.item5, me.item6],
        players: { blue, red } satisfies MatchPlayers,
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

  const riotId = `${account.gameName}#${account.tagLine}`;

  const data: SummonerProfileData = {
    riotId,
    platform,
    cluster,
    puuid: account.puuid,
    summoner: { profileIconId: summoner.profileIconId, summonerLevel: summoner.summonerLevel },

    // ✅ passes to client (so LP stops showing —)
    ranked,

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
      ddVersion,
      matchIdsReturned: ids.length,
      matchDetailsLoaded: loadedMatches.length,
    },
  };

  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  return (
    <main className="min-h-screen bg-transparent text-white px-5 py-5">
      <div className="mx-auto w-full max-w-6xl lg:max-w-4xl xl:max-w-5xl">
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

          <Link href="/tools" className={navBtn}>
            Tools
          </Link>
        </header>

        <div className="mt-8">
          <div className="py-5 flex gap-3">
            <Link href="/tools/lol/leaderboard" className={navBtn}>
              Leaderboard
            </Link>

            <Link href="/calculators/lol/meta" className={navBtn}>
              Meta
            </Link>

            <Link href="/tools/lol/summoner" className={navBtn}>
              Search ID
            </Link>
          </div>

          <SummonerProfileClient data={data} />
        </div>
      </div>
    </main>
  );
}
