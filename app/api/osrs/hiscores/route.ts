// app/api/osrs/hiscores/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Skills = { attack: number; strength: number; ranged: number; magic: number };

function isLikelyBotUA(ua: string) {
  const s = (ua || "").toLowerCase();
  return /bot|spider|crawler|headless|lighthouse|prerender|facebookexternalhit|slackbot|discordbot|whatsapp|telegram/i.test(
    s
  );
}

function normalizePlayer(raw: string) {
  const name = (raw || "").trim().replace(/\s+/g, " ");
  if (!name) return null;
  if (name.length > 12) return null; // OSRS max length
  // safe subset (prevents garbage spam)
  if (!/^[a-zA-Z0-9 _-]+$/.test(name)) return null;
  return name;
}

// lightweight in-memory rate limit (good enough to blunt abuse)
const bucket = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const cur = bucket.get(key);
  if (!cur || now > cur.resetAt) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (cur.count >= limit) return { ok: false, remaining: 0, retryMs: cur.resetAt - now };
  cur.count += 1;
  bucket.set(key, cur);
  return { ok: true, remaining: limit - cur.count };
}

function getClientIp(req: Request) {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

// Hiscores “lite” format: each line is "rank,level,xp"
// Order: Overall, Attack, Defence, Strength, Hitpoints, Ranged, Prayer, Magic, ...
function parseCombatSkills(text: string): Skills {
  const lines = text.trim().split("\n");

  const levelAt = (idx: number) => {
    const line = lines[idx] || "";
    const parts = line.split(",");
    const level = Number(parts[1]);
    return Number.isFinite(level) ? level : 1;
  };

  return {
    attack: levelAt(1),
    strength: levelAt(3),
    ranged: levelAt(5),
    magic: levelAt(7),
  };
}

export async function GET(req: Request) {
  const ua = req.headers.get("user-agent") || "";
  const ip = getClientIp(req);

  // ✅ bot bypass: return 200 but DO NOT call upstream
  if (isLikelyBotUA(ua)) {
    return NextResponse.json(
      { ok: false, error: "Bot requests disabled." },
      {
        status: 200,
        headers: {
          "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      }
    );
  }

  // ✅ rate limit per IP
  const rl = rateLimit(`osrs:${ip}`, 10, 30_000); // 10 requests / 30s
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Rate limited. Try again soon." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const rawPlayer = searchParams.get("player") || "";
  const player = normalizePlayer(rawPlayer);

  if (!player) {
    return NextResponse.json({ ok: false, error: "Invalid player name." }, { status: 400 });
  }

  const url = `https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?player=${encodeURIComponent(player)}`;

  let text = "";
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "user-agent": "GamerStation (osrs hiscores import)",
        accept: "text/plain",
      },
    });

    text = await res.text();

    if (!res.ok || !text.trim()) {
      return NextResponse.json(
        { ok: false, error: "Could not load hiscores." },
        { status: 502 }
      );
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Upstream network error." }, { status: 502 });
  }

  const skills = parseCombatSkills(text);

  // ✅ cache at Vercel edge so repeat lookups are cheap
  return NextResponse.json(
    { ok: true, player, skills },
    {
      status: 200,
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    }
  );
}