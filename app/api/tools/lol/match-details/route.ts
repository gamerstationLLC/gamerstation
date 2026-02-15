// app/api/tools/lol/match-details/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isValidCluster(cluster: string) {
  // Match-V5 is served from these regional routing values
  return cluster === "americas" || cluster === "europe" || cluster === "asia";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const matchId = (searchParams.get("matchId") || "").trim();
  const cluster = (searchParams.get("cluster") || "").trim();
  // puuid is not required for the Riot call, but we accept it for signature compatibility/debugging
  const puuid = (searchParams.get("puuid") || "").trim();

  if (!matchId) return jsonError("Missing matchId", 400);
  if (!cluster) return jsonError("Missing cluster", 400);
  if (!isValidCluster(cluster)) {
    return jsonError("Invalid cluster (use americas|europe|asia)", 400);
  }

  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    return jsonError(
      "Server missing RIOT_API_KEY. Add it to .env.local (and Vercel envs) then redeploy.",
      500
    );
  }

  // Riot Match-V5 endpoint
  const url = `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(
    matchId
  )}`;

  try {
    const res = await fetch(url, {
      headers: {
        "X-Riot-Token": apiKey,
        Accept: "application/json",
      },
      // Avoid Next caching weirdness while you're iterating locally
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Riot match-details failed (${res.status})`,
          status: res.status,
          matchId,
          cluster,
          puuid: puuid || undefined,
          riotBody: text ? text.slice(0, 500) : undefined,
        },
        { status: res.status }
      );
    }

    const match = await res.json();

    // ✅ Keep response lightweight but include what the client needs (info.participants)
    // The client’s teammate-ranking parser checks:
    // - payload.info.participants OR payload.participants
    const payload = {
      matchId,
      cluster,
      info: match?.info ?? null,
      metadata: match?.metadata ?? null,
    };

    // Small caching hint (safe for match IDs)
    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonError(`Match-details exception: ${msg}`, 500);
  }
}
