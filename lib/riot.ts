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
 * Platform → regional routing for match-v5/account-v1.
 */
export function platformToCluster(p: PlatformRegion): RegionalCluster {
  if (p === "na1" || p === "br1" || p === "la1" || p === "la2") return "americas";
  if (p === "euw1" || p === "eun1" || p === "ru" || p === "tr1") return "europe";
  if (p === "kr" || p === "jp1") return "asia";
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

export type RiotFetchOpts = {
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
   * If false, do not console.warn on softFail final attempt.
   * Default true.
   */
  log?: boolean;

  /**
   * Next.js fetch caching (seconds).
   * NOTE: your route-level `export const revalidate` still controls ISR rebuild.
   */
  revalidate?: number;
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
  const log = opts.log ?? true;

  let lastErr: unknown = null;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { "X-Riot-Token": key },
        next: typeof revalidate === "number" ? { revalidate } : undefined,
      });

      if (res.ok) return (await res.json()) as T;

      let bodyText = "";
      try {
        bodyText = await res.text();
      } catch {
        bodyText = "";
      }

      if (res.status === 404) return null;

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

      const err = new RiotHttpError(url, res.status, bodyText);
      lastErr = err;

      if (softFail) {
        if (log && i === attempts - 1) console.warn(String(err));
        return null;
      }

      throw err;
    } catch (e) {
      lastErr = e;

      if (i < attempts - 1) {
        const jitter = Math.floor(Math.random() * 120);
        const exp = Math.min(4000, backoffMs * Math.pow(2, i));
        await sleep(exp + jitter);
        continue;
      }

      if (softFail) {
        if (log) console.warn(`Riot fetch failed (soft): ${url}`, e);
        return null;
      }

      throw e;
    }
  }

  if (softFail) return null;
  throw lastErr instanceof Error ? lastErr : new Error("Unknown Riot fetch failure");
}
