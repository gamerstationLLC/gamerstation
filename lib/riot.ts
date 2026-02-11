// lib/riot.ts
import "server-only";

export type PlatformRegion =
  | "na1"
  | "euw1"
  | "eun1"
  | "kr"
  | "jp1"
  | "br1"
  | "la1"
  | "la2"
  | "oc1"
  | "ru"
  | "tr1"
  | "ph2"
  | "sg2"
  | "th2"
  | "tw2"
  | "vn2";

export type RegionalCluster = "americas" | "europe" | "asia" | "sea";

const RIOT_API_KEY = process.env.RIOT_API_KEY;

function mustKey() {
  if (!RIOT_API_KEY) {
    throw new Error("Missing RIOT_API_KEY (set in Vercel → Env Vars → Production).");
  }
  return RIOT_API_KEY;
}

/**
 * Platform → regional routing for match-v5/account-v1, etc.
 */
export function platformToCluster(p: PlatformRegion): RegionalCluster {
  // Americas
  if (p === "na1" || p === "br1" || p === "la1" || p === "la2") return "americas";
  // Europe
  if (p === "euw1" || p === "eun1" || p === "ru" || p === "tr1") return "europe";
  // Asia
  if (p === "kr" || p === "jp1") return "asia";
  // SEA (newer regions)
  return "sea";
}

export function riotHostForPlatform(platform: PlatformRegion) {
  return `https://${platform}.api.riotgames.com`;
}

export function riotHostForCluster(cluster: RegionalCluster) {
  return `https://${cluster}.api.riotgames.com`;
}

/**
 * Standard error type (kept small so it won't bloat logs).
 */
class RiotHttpError extends Error {
  status: number;
  url: string;
  bodyText?: string;

  constructor(url: string, status: number, bodyText?: string) {
    super(`Riot API error ${status} for ${url}${bodyText ? ` ${bodyText}` : ""}`);
    this.name = "RiotHttpError";
    this.status = status;
    this.url = url;
    this.bodyText = bodyText;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRetryAfterMs(res: Response): number | null {
  const ra = res.headers.get("retry-after");
  if (!ra) return null;
  const n = Number(ra);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(10_000, n * 1000);
}

type RiotFetchOpts = {
  /**
   * If true (default), non-critical Riot failures (429/5xx) won't crash SSR.
   * We'll retry, then return null.
   */
  softFail?: boolean;
  /**
   * Total attempts including the first try. Default 4.
   */
  attempts?: number;
  /**
   * Base backoff in ms. Default 250.
   */
  backoffMs?: number;
  /**
   * Next.js fetch options
   */
  revalidate?: number; // seconds
};

/**
 * Fetch JSON from Riot with retry + optional soft-fail.
 *
 * IMPORTANT:
 * - Riot 500/502/503/504 happens. Don't let it take down your site.
 * - Use softFail (default true) for UI reads.
 */
export async function riotFetchJson<T>(
  url: string,
  opts: RiotFetchOpts = {}
): Promise<T | null> {
  const key = mustKey();

  const softFail = opts.softFail ?? true;
  const attempts = Math.max(1, opts.attempts ?? 4);
  const backoffMs = Math.max(0, opts.backoffMs ?? 250);
  const revalidate = opts.revalidate;

  let lastErr: unknown = null;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "X-Riot-Token": key,
        },
        // Keep SSR stable; your route-level `revalidate` controls ISR anyway.
        next: typeof revalidate === "number" ? { revalidate } : undefined,
      });

      if (res.ok) {
        return (await res.json()) as T;
      }

      // Read tiny body for debugging (Riot returns {"status":...})
      let bodyText = "";
      try {
        bodyText = await res.text();
      } catch {
        bodyText = "";
      }

      // 404 is usually "not found" (bad match id / deleted) — treat as soft null.
      if (res.status === 404) {
        return null;
      }

      // Retry on rate limit and transient server errors.
      const isRetryable =
        res.status === 429 ||
        res.status === 500 ||
        res.status === 502 ||
        res.status === 503 ||
        res.status === 504;

      if (isRetryable && i < attempts - 1) {
        const retryAfter = parseRetryAfterMs(res);
        const jitter = Math.floor(Math.random() * 120);
        const exp = Math.min(4000, backoffMs * Math.pow(2, i));
        const wait = retryAfter ?? exp + jitter;
        await sleep(wait);
        continue;
      }

      // Not retryable or out of attempts
      const err = new RiotHttpError(url, res.status, bodyText);
      lastErr = err;

      if (softFail) {
        // Log once at the end (avoid spamming)
        if (i === attempts - 1) {
          console.warn(String(err));
        }
        return null;
      }

      throw err;
    } catch (e) {
      lastErr = e;

      // Network errors can also be transient
      if (i < attempts - 1) {
        const jitter = Math.floor(Math.random() * 120);
        const exp = Math.min(4000, backoffMs * Math.pow(2, i));
        await sleep(exp + jitter);
        continue;
      }

      if (softFail) {
        console.warn(`Riot fetch failed (soft): ${url}`, e);
        return null;
      }

      throw e;
    }
  }

  // Should be unreachable, but keep TS happy
  if (softFail) return null;
  throw lastErr instanceof Error ? lastErr : new Error("Unknown Riot fetch failure");
}
