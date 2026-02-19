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
      { patch: json.patch ?? json.version ?? "unknown" },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ patch: "unknown" }, { status: 200 });
  }
}
