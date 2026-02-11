// lib/riot.ts
import "server-only";

export type PlatformRegion =
  | "na1"
  | "br1"
  | "la1"
  | "la2"
  | "oc1"
  | "euw1"
  | "eun1"
  | "tr1"
  | "ru"
  | "kr"
  | "jp1";

export type RegionalCluster = "americas" | "europe" | "asia";

export function platformToCluster(platform: PlatformRegion): RegionalCluster {
  switch (platform) {
    case "na1":
    case "br1":
    case "la1":
    case "la2":
    case "oc1":
      return "americas";
    case "euw1":
    case "eun1":
    case "tr1":
    case "ru":
      return "europe";
    case "kr":
    case "jp1":
      return "asia";
  }
}

export function riotHostForPlatform(platform: PlatformRegion) {
  return `https://${platform}.api.riotgames.com`;
}

export function riotHostForCluster(cluster: RegionalCluster) {
  return `https://${cluster}.api.riotgames.com`;
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type RiotFetchOpts = {
  revalidateSeconds?: number;
  maxRetries?: number;
};

export async function riotFetchJson<T>(
  url: string,
  opts: RiotFetchOpts = {}
): Promise<T> {
  const key = mustEnv("RIOT_API_KEY"); // server-only env var
  const maxRetries = opts.maxRetries ?? 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      headers: { "X-Riot-Token": key },
      next: opts.revalidateSeconds
        ? { revalidate: opts.revalidateSeconds }
        : undefined,
    });

    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = res.headers.get("Retry-After");
      const waitMs = retryAfter ? Math.max(300, Number(retryAfter) * 1000) : 900;
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Riot API error ${res.status} for ${url}\n${text}`);
    }

    return (await res.json()) as T;
  }

  throw new Error(`Riot API failed after retries: ${url}`);
}
