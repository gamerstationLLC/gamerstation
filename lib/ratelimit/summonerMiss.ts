// lib/ratelimit/summonerMiss.ts
import { kv } from "@vercel/kv";

const MISS_LIMIT = 4;       // allow 4 cache misses
const WINDOW_SEC = 10 * 60; // per 10 minutes
const BAN_SEC = 10 * 60;    // ban length 10 minutes

function missKey(ip: string) {
  return `rl:summoner:miss:${ip}`;
}

function banKey(ip: string) {
  return `rl:summoner:ban:${ip}`;
}

export function getClientIp(h: Pick<Headers, "get">): string {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const xrip = h.get("x-real-ip")?.trim();
  if (xrip) return xrip;

  return "unknown";
}

/**
 * Call this ONLY on a CACHE MISS (right before you do Riot work).
 * Cache hits should NOT touch KV.
 */
export async function enforceSummonerCacheMissLimit(
  h: Pick<Headers, "get">
): Promise<{
  ok: boolean;
  ip: string;
  reason?: "banned" | "too_many_misses";
  misses?: number;
  remaining?: number;
}> {
  const ip = getClientIp(h);

  // 1) Already banned?
  const banned = await kv.get<string>(banKey(ip));
  if (banned) return { ok: false, ip, reason: "banned" };

  // 2) Increment miss counter
  const misses = await kv.incr(missKey(ip));

  // Set TTL only when created (fixed window)
  if (misses === 1) {
    await kv.expire(missKey(ip), WINDOW_SEC);
  }

  // 3) Over limit -> ban
  if (misses > MISS_LIMIT) {
    await kv.set(banKey(ip), "1", { ex: BAN_SEC });
    return { ok: false, ip, reason: "too_many_misses", misses };
  }

  return {
    ok: true,
    ip,
    misses,
    remaining: Math.max(0, MISS_LIMIT - misses),
  };
}