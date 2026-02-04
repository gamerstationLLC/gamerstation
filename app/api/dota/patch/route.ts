// app/api/dota/patch/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 600; // 5 minutes

type AnyObj = Record<string, any>;

function toMs(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

function clean(s: unknown): string | null {
  if (s == null) return null;
  const str = String(s).trim();
  if (!str) return null;

  const low = str.toLowerCase();
  if (low === "—" || low === "-" || low === "unknown" || low === "null" || low === "undefined") return null;

  // "7.40", "7.40b", "7.40c" etc. — keep as-is.
  return str;
}

function pickPatchFromObj(obj: AnyObj): string | null {
  // accept a bunch of possible keys
  const keys = ["patch", "name", "version", "latest", "current", "value"];
  for (const k of keys) {
    const v = clean(obj?.[k]);
    if (v) return v;
  }
  return null;
}

function extractPatch(data: any): string | null {
  if (!data) return null;

  // direct string
  if (typeof data === "string" || typeof data === "number") return clean(data);

  // array (best effort: newest first by date-ish fields, else first valid)
  if (Array.isArray(data)) {
    if (data.length === 0) return null;

    // If entries have dates, sort by them
    const hasDates = data.some((e) => e && typeof e === "object" && (e.date != null || e.timestamp != null));
    const list = hasDates
      ? [...data].sort((a, b) => {
          const ad = toMs(a?.date ?? a?.timestamp ?? 0);
          const bd = toMs(b?.date ?? b?.timestamp ?? 0);
          return bd - ad;
        })
      : data;

    for (const e of list) {
      if (typeof e === "string" || typeof e === "number") {
        const v = clean(e);
        if (v) return v;
        continue;
      }
      if (e && typeof e === "object") {
        const v = pickPatchFromObj(e);
        if (v) return v;
      }
    }
    return null;
  }

  // object
  if (typeof data === "object") {
    // try direct keys
    const direct = pickPatchFromObj(data as AnyObj);
    if (direct) return direct;

    // sometimes constants endpoints return a map of id -> entry
    const vals = Object.values(data as AnyObj);
    if (vals.length) return extractPatch(vals);
  }

  return null;
}

async function fetchJson(url: string) {
  const res = await fetch(url, {
    next: { revalidate },
    headers: {
      Accept: "application/json",
      "User-Agent": "GamerStation (https://gamerstation.gg)",
    },
  });

  if (!res.ok) return { ok: false as const, status: res.status, json: null };
  const json = await res.json().catch(() => null);
  return { ok: true as const, status: 200, json };
}

export async function GET() {
  // Try multiple upstreams (lenient, resilient)
  const upstreams = [
    "https://api.opendota.com/api/patch", // best: array of patches
    "https://api.opendota.com/api/constants/patches", // common constants map
    "https://api.opendota.com/api/constants/patch", // your old one (keep as fallback)
  ];

  try {
    for (const upstream of upstreams) {
      const { ok, status, json } = await fetchJson(upstream);
      if (!ok) continue;

      const patch = extractPatch(json);
      if (patch) {
        return NextResponse.json(
          { patch, ok: true, upstream },
          { status: 200, headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } }
        );
      }

      // If we got JSON but couldn’t extract, keep trying next upstream
    }

    // Nothing worked
    return NextResponse.json(
      { patch: "—", ok: false, upstream: upstreams[0] },
      { status: 200, headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { patch: "—", ok: false, error: String(e?.message ?? e) },
      { status: 200, headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } }
    );
  }
}
