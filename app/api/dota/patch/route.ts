// app/api/dota/patch/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PatchEntry = {
  name?: string;
  patch?: string;
  id?: number | string;
  date?: string | number; // OpenDota returns ISO string here
  timestamp?: number | string;
  [key: string]: any;
};

function toMs(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    // if it's seconds (10-digit-ish), convert to ms
    return v < 1e12 ? v * 1000 : v;
  }
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

function extractLatestPatchName(data: any): string | null {
  const list: PatchEntry[] = Array.isArray(data)
    ? data
    : data && typeof data === "object"
    ? Object.values(data)
    : [];

  if (!list.length) return null;

  const sorted = [...list].sort((a, b) => {
    const ad = toMs(a.date ?? a.timestamp ?? 0);
    const bd = toMs(b.date ?? b.timestamp ?? 0);
    return bd - ad;
  });

  const top = sorted[0] ?? {};
  const name = (top.name || top.patch || "").toString().trim();
  return name || null;
}

export async function GET() {
  const upstream = "https://api.opendota.com/api/constants/patch"; // ✅ correct
  try {
    const res = await fetch(upstream, {
      next: { revalidate: 300 },
      headers: {
        Accept: "application/json",
        "User-Agent": "GamerStation (https://gamerstation.gg)",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { patch: "—", ok: false, status: res.status, upstream },
        { status: 200, headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } }
      );
    }

    const data = await res.json();
    const patch = extractLatestPatchName(data) ?? "—";

    return NextResponse.json(
      { patch, ok: patch !== "—", upstream },
      { status: 200, headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { patch: "—", ok: false, status: "exception", error: String(e?.message ?? e), upstream },
      { status: 200, headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } }
    );
  }
}
