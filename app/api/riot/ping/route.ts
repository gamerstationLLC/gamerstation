// app/api/riot/ping/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustKey() {
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new Error("Missing RIOT_API_KEY env var");
  return key;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = (searchParams.get("platform") || "na1").toLowerCase();

  const url = `https://${platform}.api.riotgames.com/lol/status/v4/platform-data`;

  try {
    const res = await fetch(url, {
      headers: { "X-Riot-Token": mustKey() },
      cache: "no-store",
    });

    const text = await res.text(); // keep it readable even if not JSON
    return NextResponse.json(
      {
        ok: res.ok,
        status: res.status,
        platform,
        url,
        bodyPreview: text.slice(0, 300),
      },
      { status: res.ok ? 200 : res.status }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
