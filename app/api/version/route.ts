import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const p = path.join(process.cwd(), "public", "data", "lol", "version.json");
    const raw = await fs.readFile(p, "utf-8");
    const json = JSON.parse(raw);

    return NextResponse.json(
      {
        version: json.patch ?? json.version ?? "unknown",
        fallbackUsed: false,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { version: "unknown", fallbackUsed: true },
      { status: 200 }
    );
  }
}
