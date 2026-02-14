// app/api/tools/lol/_eurf/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlayerRef = {
  gameName?: string;
  tagLine?: string;
  summonerName?: string;
  champ?: string;
  teamId?: number;
  win?: boolean;
};

type MatchPlayers = {
  blue: PlayerRef[];
  red: PlayerRef[];
};

type MatchRow = {
  matchId: string;
  createdAt: number;
  durationSec: number;
  mode: string;
  queueId: number;
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
  gameVersion?: string;
  players?: MatchPlayers;
};

const RIOT_API_KEY = process.env.RIOT_API_KEY;

function mustKey() {
  if (!RIOT_API_KEY) throw new Error("Missing RIOT_API_KEY");
  return RIOT_API_KEY;
}

function asInt(v: string | null, d: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : d;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function kdaStr(k: number, d: number, a: number) {
  const val = (k + a) / Math.max(1, d);
  return val.toFixed(2).replace(/\.00$/, ".0");
}

async function riotJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const key = mustKey();

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      headers: { "X-Riot-Token": key },
      signal,
      cache: "no-store",
    });

    if (res.status === 429) {
      const ra = res.headers.get("retry-after");
      const ms = clamp(asInt(ra, 1), 1, 8) * 1000;
      await new Promise((r) => setTimeout(r, ms));
      continue;
    }

    if (res.ok) return (await res.json()) as T;

    lastErr = new Error(`Riot ${res.status} ${res.statusText}`);
    await new Promise((r) => setTimeout(r, 250 + attempt * 250));
  }

  throw lastErr instanceof Error ? lastErr : new Error("Riot request failed");
}

type RiotMatch = {
  metadata: { matchId: string };
  info: {
    gameCreation: number;
    gameDuration: number;
    gameMode: string;
    queueId: number;
    gameVersion?: string;
    participants: Array<{
      puuid: string;
      win: boolean;
      championName: string;
      teamPosition?: string;
      lane?: string;
      kills: number;
      deaths: number;
      assists: number;
      totalMinionsKilled: number;
      neutralMinionsKilled: number;
      goldEarned: number;
      totalDamageDealtToChampions: number;
      visionScore: number;
      teamId: number;

      item0: number;
      item1: number;
      item2: number;
      item3: number;
      item4: number;
      item5: number;
      item6: number;

      riotIdGameName?: string;
      riotIdTagline?: string;
      summonerName?: string;
    }>;
  };
};

function mapMatchToRow(match: RiotMatch, puuid: string): MatchRow | null {
  const me = match.info.participants.find((p) => p.puuid === puuid);
  if (!me) return null;

  const items = [me.item0, me.item1, me.item2, me.item3, me.item4, me.item5, me.item6].filter(
    (x) => Number.isFinite(x)
  );

  const cs = (me.totalMinionsKilled ?? 0) + (me.neutralMinionsKilled ?? 0);

  const blue: PlayerRef[] = [];
  const red: PlayerRef[] = [];
  for (const p of match.info.participants) {
    const ref: PlayerRef = {
      gameName: p.riotIdGameName || undefined,
      tagLine: p.riotIdTagline || undefined,
      summonerName: p.summonerName || undefined,
      champ: p.championName || undefined,
      teamId: p.teamId,
      win: p.win,
    };
    if (p.teamId === 100) blue.push(ref);
    else if (p.teamId === 200) red.push(ref);
  }

  return {
    matchId: match.metadata.matchId,
    createdAt: match.info.gameCreation,
    durationSec: match.info.gameDuration,
    mode: match.info.gameMode,
    queueId: match.info.queueId,
    win: me.win,
    champ: me.championName,
    role: (me.teamPosition || me.lane || "").trim() || "—",
    kills: me.kills,
    deaths: me.deaths,
    assists: me.assists,
    kda: kdaStr(me.kills, me.deaths, me.assists),
    cs,
    gold: me.goldEarned,
    dmgToChamps: me.totalDamageDealtToChampions,
    vision: me.visionScore,
    items,
    gameVersion: match.info.gameVersion,
    players: { blue: blue.slice(0, 5), red: red.slice(0, 5) },
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const puuid = url.searchParams.get("puuid") || "";
    const cluster = (url.searchParams.get("cluster") || "").trim();
    const limit = clamp(asInt(url.searchParams.get("limit"), 12), 1, 20);

    if (!puuid || !cluster) {
      return NextResponse.json(
        { error: "Missing required query params: puuid, cluster" },
        { status: 400 }
      );
    }

    // URF queue commonly 900 ✅
    const idsUrl = `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(
      puuid
    )}/ids?start=0&count=${limit}&queue=900`;

    const ids = await riotJson<string[]>(idsUrl);

    const out: MatchRow[] = [];
    for (const matchId of ids.slice(0, limit)) {
      const matchUrl = `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(
        matchId
      )}`;
      const match = await riotJson<RiotMatch>(matchUrl);
      const row = mapMatchToRow(match, puuid);
      if (row) out.push(row);
      if (out.length >= limit) break;
    }

    return NextResponse.json({ matches: out }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
