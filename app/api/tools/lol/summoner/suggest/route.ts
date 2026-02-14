// app/api/tools/lol/summoner/suggest/route.ts
import { NextResponse } from "next/server";
import { suggestSummoners } from "@/lib/lol/summoner-index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const limitRaw = url.searchParams.get("limit") ?? "8";
    const limit = Math.max(1, Math.min(20, Number(limitRaw) || 8));

    const results = await suggestSummoners(q, limit);

    return NextResponse.json({ ok: true, results }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
