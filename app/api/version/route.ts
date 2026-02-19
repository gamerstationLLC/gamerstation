// app/api/version/route.ts
import { NextResponse } from "next/server";
import { getLolVersion } from "../lol/_shared/getLolVersion";

export const runtime = "nodejs";

export async function GET() {
  const v = await getLolVersion();

  // Backward compat:
  // - version = display patch (26.x)
  // - patch = display patch (26.x)
  // - ddragon = ddragon asset version (16.x.x)
  return NextResponse.json(
    {
      version: v.version, // display patch (legacy)
      patch: v.patch, // display patch
      ddragon: v.ddragon, // asset version
      source: v.source,
      ddragonSource: v.ddragonSource,
      chosenRealm: v.chosenRealm,
      updatedAt: v.updatedAt,
      fallbackUsed: v.fallbackUsed,
    },
    { status: 200 }
  );
}
