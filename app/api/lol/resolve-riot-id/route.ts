import { NextResponse } from "next/server";
import { enforceSummonerCacheMissLimit } from "@/lib/ratelimit/summonerMiss";

export const runtime = "nodejs"; // needs process.env
export const dynamic = "force-dynamic"; // never cache

type PlatformRegion =
  | "na1"
  | "br1"
  | "la1"
  | "la2"
  | "oc1"
  | "euw1"
  | "eun1"
  | "tr1"
  | "ru"
  | "kr"
  | "jp1"
  | "ph2"
  | "sg2"
  | "th2"
  | "tw2"
  | "vn2";

type RegionalCluster = "americas" | "europe" | "asia" | "sea";

function platformToCluster(p: PlatformRegion): RegionalCluster {
  // Riot routing: AMERICAS = NA/BR/LATAM, EUROPE = EU/TR/RU, ASIA = KR/JP, SEA = PH/SG/TH/TW/VN
  if (p === "na1" || p === "br1" || p === "la1" || p === "la2") return "americas";
  if (p === "euw1" || p === "eun1" || p === "tr1" || p === "ru") return "europe";
  if (p === "kr" || p === "jp1") return "asia";
  return "sea";
}

function clusterHost(c: RegionalCluster) {
  return `https://${c}.api.riotgames.com`;
}

function json(data: unknown, init?: ResponseInit) {
  return new NextResponse(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init?.headers || {}),
    },
  });
}

function isLikelyBotUA(uaRaw: string | null) {
  const ua = (uaRaw || "").toLowerCase();
  if (!ua) return true;
  const needles = [
    "bot",
    "crawler",
    "spider",
    "scrape",
    "scanner",
    "headless",
    "lighthouse",
    "pagespeed",
    "ahrefs",
    "semrush",
    "mj12bot",
    "dotbot",
    "dataforseo",
    "serpapi",
    "bingbot",
    "googlebot",
    "duckduckbot",
    "yandex",
    "baidu",
    "slurp",
  ];
  return needles.some((n) => ua.includes(n));
}

function looksValid(gameName: string, tagLine: string) {
  // lightweight sanity check; Riot will be final authority
  if (!gameName || !tagLine) return false;
  if (gameName.length < 2 || gameName.length > 24) return false;
  if (tagLine.length < 2 || tagLine.length > 10) return false;
  return true;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const region = (url.searchParams.get("region") || "na1") as PlatformRegion;
  const gameName = (url.searchParams.get("gameName") || "").trim();
  const tagLine = (url.searchParams.get("tagLine") || "").trim();

  // 0) Bot guard (never call Riot, never count against rate limits)
  const ua = req.headers.get("user-agent");
  const accept = req.headers.get("accept") || "";
  const likelyBot = isLikelyBotUA(ua);

  // This is an API route; allow JSON-ish accepts. If it's not even asking for JSON, treat as bot-ish.
  const wantsJson = accept.includes("application/json") || accept.includes("*/*") || accept === "";
  if (likelyBot || !wantsJson) {
    return json({ ok: false, reason: "bot_blocked" }, { status: 200 });
  }

  // 1) Validate params
  if (!gameName || !tagLine) {
    return json({ ok: false, reason: "missing_params" }, { status: 400 });
  }
  if (!looksValid(gameName, tagLine)) {
    return json({ ok: false, reason: "invalid_params" }, { status: 400 });
  }

  // 2) Rate limit (this route is ALWAYS a Riot call, so enforce here)
  const rl = await enforceSummonerCacheMissLimit(req.headers);
  if (!rl.ok) {
    return json(
      {
        ok: false,
        reason: rl.reason ?? "rate_limited",
      },
      { status: 429, headers: { "retry-after": "600" } }
    );
  }

  // 3) Riot call
  const key = process.env.RIOT_API_KEY;
  if (!key) {
    return json({ ok: false, reason: "missing_riot_api_key" }, { status: 500 });
  }

  const cluster = platformToCluster(region);
  const host = clusterHost(cluster);

  const endpoint = `${host}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
    gameName
  )}/${encodeURIComponent(tagLine)}`;

  const res = await fetch(endpoint, {
    headers: { "X-Riot-Token": key },
    cache: "no-store",
  });

  if (res.status === 404) {
    return json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return json(
      {
        ok: false,
        reason: "riot_error",
        status: res.status,
        detail: text ? text.slice(0, 400) : undefined,
      },
      { status: 502 }
    );
  }

  const data = (await res.json()) as { puuid: string; gameName: string; tagLine: string };

  return json({ ok: true, puuid: data.puuid, gameName: data.gameName, tagLine: data.tagLine });
}