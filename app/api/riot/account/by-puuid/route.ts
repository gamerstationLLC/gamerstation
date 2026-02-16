import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const region = (url.searchParams.get("region") || "na1") as PlatformRegion;
  const puuid = (url.searchParams.get("puuid") || "").trim();

  if (!puuid) return json({ ok: false, reason: "missing_params" }, { status: 400 });

  const key = process.env.RIOT_API_KEY;
  if (!key) return json({ ok: false, reason: "missing_riot_api_key" }, { status: 500 });

  const cluster = platformToCluster(region);
  const host = clusterHost(cluster);

  const endpoint = `${host}/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`;

  const res = await fetch(endpoint, {
    headers: { "X-Riot-Token": key },
    cache: "no-store",
  });

  if (res.status === 404) return json({ ok: false, reason: "not_found" }, { status: 404 });

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

  return json({
    ok: true,
    puuid: data.puuid,
    gameName: data.gameName,
    tagLine: data.tagLine,
    riotId: `${data.gameName}#${data.tagLine}`,
  });
}
