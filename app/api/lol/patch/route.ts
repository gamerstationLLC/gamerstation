// app/api/lol/patch/route.ts
import { NextResponse } from "next/server";
import { getLolVersion } from "../_shared/getLolVersion";

export const runtime = "nodejs";

export async function GET() {
  const v = await getLolVersion();

  return NextResponse.json(
    {
      patch: v.patch, // display patch (26.x)
      ddragon: v.ddragon, // asset version (16.x.x)
      source: v.source,
      fallbackUsed: v.fallbackUsed,
      updatedAt: v.updatedAt,
    },
    { status: 200 }
  );
}
