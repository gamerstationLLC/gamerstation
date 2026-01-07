// app/api/osrs/hiscores/route.ts
import { NextResponse } from "next/server";

// Official OSRS hiscores "lite" endpoint (CSV-like).
const HISCORES_LITE = "https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws";

// Indices in the lite response (top section is skills in fixed order)
// Order is: Overall, Attack, Defence, Strength, Hitpoints, Ranged, Prayer, Magic, Cooking, ...
// We only need: Attack, Strength, Ranged, Magic, plus (optional) Defence/Hitpoints/Prayer later.
const SKILL_INDEX = {
  attack: 1,
  defence: 2,
  strength: 3,
  hitpoints: 4,
  ranged: 5,
  prayer: 6,
  magic: 7,
} as const;

function clamp99(n: number) {
  return Math.max(1, Math.min(99, n));
}

function parseLite(text: string) {
  // Each line: rank,level,xp
  const lines = text.trim().split("\n");
  const getLevel = (idx: number) => {
    const parts = (lines[idx] ?? "").split(",");
    const lvl = Number(parts[1]);
    if (!Number.isFinite(lvl)) return null;
    return clamp99(lvl);
  };

  const attack = getLevel(SKILL_INDEX.attack);
  const strength = getLevel(SKILL_INDEX.strength);
  const ranged = getLevel(SKILL_INDEX.ranged);
  const magic = getLevel(SKILL_INDEX.magic);

  if (attack == null || strength == null || ranged == null || magic == null) {
    return null;
  }

  return { attack, strength, ranged, magic };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const player = (searchParams.get("player") ?? "").trim();

  if (!player) {
    return NextResponse.json({ error: "Missing player" }, { status: 400 });
  }

  const url = `${HISCORES_LITE}?player=${encodeURIComponent(player)}`;

  try {
    const res = await fetch(url, {
      // hiscores can be flaky; no-store helps reduce stale behavior
      cache: "no-store",
      headers: {
        "User-Agent": "GamerStation OSRS DPS Calculator",
      },
    });

    if (!res.ok) {
      // 404-ish behavior can still be 200 sometimes; but handle non-200 anyway
      return NextResponse.json({ error: "Could not load hiscores" }, { status: 502 });
    }

    const text = await res.text();

    // Some "not found" cases return HTML or empty-ish content
    if (!text || !text.includes(",")) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const skills = parseLite(text);
    if (!skills) {
      return NextResponse.json({ error: "Could not parse hiscores" }, { status: 500 });
    }

    return NextResponse.json({ player, skills }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Network error loading hiscores" }, { status: 500 });
  }
}
