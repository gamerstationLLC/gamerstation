// app/api/tools/lol/summoner/log/route.ts
import { NextResponse } from "next/server";
import { logSummonerToIndex } from "@/lib/lol/summoner-index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  puuid?: string;
  gameName?: string;
  tagLine?: string;
  platform?: string;
  cluster?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const puuid = (body.puuid ?? "").trim();
    const gameName = (body.gameName ?? "").trim();
    const tagLine = (body.tagLine ?? "").trim();
    const platform = (body.platform ?? "").trim();
    const cluster = (body.cluster ?? "").trim();

    const result = await logSummonerToIndex({
      puuid,
      gameName,
      tagLine,
      platform,
      cluster,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
