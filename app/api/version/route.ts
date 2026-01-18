import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const revalidate = 60 * 60 * 6; // 6 hours

async function readFallbackVersion(): Promise<string> {
  try {
    const p = path.join(process.cwd(), "data", "lol", "version.json");
    const raw = await fs.readFile(p, "utf-8");
    const json = JSON.parse(raw) as { version?: string };
    return json.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function GET() {
  const fallbackVersion = await readFallbackVersion();

  try {
    const res = await fetch(
      "https://ddragon.leagueoflegends.com/api/versions.json",
      { next: { revalidate: 60 * 60 * 6 } } as any
    );

    if (!res.ok) throw new Error("Failed to fetch versions");

    const versions = (await res.json()) as string[];

    return NextResponse.json({
      version: versions[0] ?? fallbackVersion,
      fallbackUsed: false,
    });
  } catch {
    return NextResponse.json({
      version: fallbackVersion,
      fallbackUsed: true,
    });
  }
}
