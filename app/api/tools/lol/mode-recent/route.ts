// app/api/tools/lol/_erecent/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function riotJson<T>(url: string): Promise<T> {
  const key = mustKey();
  const res = await fetch(url, { headers: { "X-Riot-Token": key }, cache: "no-store" });
  if (!res.ok) throw new Error(`Riot ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

// If you already prefill "recent" from SSR data, you can skip this file.
// This is here only to keep the API pattern consistent.
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

    const idsUrl = `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(
      puuid
    )}/ids?start=0&count=${limit}`;

    const ids = await riotJson<string[]>(idsUrl);

    // For "recent" you can either:
    // (A) return IDs only, or
    // (B) match your UI and enrich match rows like the other routes.
    // Keep it simple here: just return IDs (client won’t use it unless you wire it).
    return NextResponse.json({ matchIds: ids }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
