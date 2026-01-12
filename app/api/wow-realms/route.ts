// app/api/wow-realms/route.ts
import { NextResponse } from "next/server";
import { fetchWowRealms, type BnetRegion } from "@/lib/blizzard/wow";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const region = (searchParams.get("region") || "us") as BnetRegion;

    if (!["us", "eu", "kr", "tw"].includes(region)) {
      return NextResponse.json({ error: "Invalid region" }, { status: 400 });
    }

    const realms = await fetchWowRealms(region);

    // Cache for 24 hours (realms rarely change)
    return NextResponse.json(
      { region, realms },
      {
        headers: {
          "Cache-Control": "s-maxage=86400, stale-while-revalidate=3600",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Failed to fetch realms",
        details: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
