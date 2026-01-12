// app/api/wow-character-stats/route.ts
import { NextResponse } from "next/server";
import { fetchWowCharacterStats, type BnetRegion } from "@/lib/blizzard/wow";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const region = (searchParams.get("region") || "us") as BnetRegion;
    const realmSlug = searchParams.get("realmSlug");
    const name = searchParams.get("name");

    if (!["us", "eu", "kr", "tw"].includes(region)) {
      return NextResponse.json({ error: "Invalid region" }, { status: 400 });
    }

    if (!realmSlug || !name) {
      return NextResponse.json(
        { error: "Missing realmSlug or name" },
        { status: 400 }
      );
    }

    const stats = await fetchWowCharacterStats({ region, realmSlug, name });

    // Cache for 10 minutes on Vercel edge/server to keep it snappy
    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "s-maxage=600, stale-while-revalidate=60",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Failed to fetch character stats",
        details: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
