// app/tools/lol/leaderboard/client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type RegionKey = "na1" | "euw1" | "kr";
export type QueueKey = "RANKED_SOLO_5x5" | "RANKED_FLEX_SR";
export type TierKey = "CHALLENGER" | "GRANDMASTER" | "MASTER";

export type LeaderboardRow = {
  rank: number;
  puuid: string;

  summonerId?: string | null;
  summonerName?: string | null;

  profileIconUrl?: string | null;
  profileIconId?: number | null;
  summonerLevel?: number | null;

  topChamps?: Array<{ name: string; count: number }> | null;
  sampleGames?: number | null;

  region: RegionKey;
  queue: QueueKey;
  tier: TierKey;

  lp: number;
  wins: number;
  losses: number;

  flags?: {
    hotStreak?: boolean;
    inactive?: boolean;
    veteran?: boolean;
    freshBlood?: boolean;
  };
};

type Props = {
  initialRows: LeaderboardRow[];
  initialRegion: RegionKey;
  initialQueue: QueueKey;
  initialTier: TierKey;
  initialGeneratedAt: string | null;
};

type LeaderboardJson = {
  generatedAt: string;
  region: RegionKey;
  queue: QueueKey;
  tier: TierKey;
  count: number;
  players: Array<{
    puuid: string;

    summonerId?: string | null;
    summonerName: string;

    profileIconUrl?: string | null;
    profileIconId?: number | null;
    summonerLevel?: number | null;

    topChamps?: Array<{ name: string; count: number }> | null;
    sampleGames?: number | null;

    leaguePoints: number;
    wins: number;
    losses: number;

    hotStreak?: boolean;
    inactive?: boolean;
    veteran?: boolean;
    freshBlood?: boolean;
  }>;
};

const REGIONS: { key: RegionKey; label: string }[] = [
  { key: "na1", label: "NA" },
  { key: "euw1", label: "EUW" },
  { key: "kr", label: "KR" },
];

const QUEUES: { key: QueueKey; label: string }[] = [
  { key: "RANKED_SOLO_5x5", label: "Solo/Duo" },
  { key: "RANKED_FLEX_SR", label: "Flex" },
];

const TIERS: { key: TierKey; label: string }[] = [
  { key: "CHALLENGER", label: "Challenger" },
  { key: "GRANDMASTER", label: "Grandmaster" },
  { key: "MASTER", label: "Master" },
];

function fmtWL(w: number, l: number) {
  const total = w + l;
  const wr = total > 0 ? Math.round((w / total) * 1000) / 10 : 0;
  return `${w}-${l} (${wr}%)`;
}

function fmtInt(n: number) {
  const x = Number.isFinite(n) ? Math.trunc(n) : 0;
  return x.toLocaleString();
}

function toRows(json: LeaderboardJson): LeaderboardRow[] {
  return (json.players ?? []).map((p, idx) => ({
    rank: idx + 1,
    puuid: p.puuid,

    summonerId: p.summonerId ?? null,
    summonerName: p.summonerName ?? null,

    profileIconUrl: p.profileIconUrl ?? null,
    profileIconId: p.profileIconId ?? null,
    summonerLevel: p.summonerLevel ?? null,

    topChamps: p.topChamps ?? null,
    sampleGames: p.sampleGames ?? null,

    region: json.region,
    queue: json.queue,
    tier: json.tier,

    lp: p.leaguePoints,
    wins: p.wins,
    losses: p.losses,

    flags: {
      hotStreak: !!p.hotStreak,
      inactive: !!p.inactive,
      veteran: !!p.veteran,
      freshBlood: !!p.freshBlood,
    },
  }));
}

// ✅ accept absolute + protocol-relative only; reject random strings
function normalizeIconUrl(url?: string | null): string | null {
  const u = (url ?? "").trim();
  if (!u) return null;
  if (u.startsWith("https://") || u.startsWith("http://")) return u;
  if (u.startsWith("//")) return `https:${u}`;
  return null;
}

/** Client-safe Blob URL builder (dev + prod) */
function normalizeBase(b: string) {
  return String(b ?? "").trim().replace(/\/+$/, "");
}
function normalizePath(p: string) {
  return String(p ?? "").trim().replace(/^\/+/, "");
}
function blobUrl(pathnameInput: string): string {
  const pathname = normalizePath(pathnameInput);
  const base = process.env.NEXT_PUBLIC_BLOB_BASE_URL || "";

  if (!pathname) return "/";
  if (!base) {
    // In case you forgot the env var locally, you still get *something*.
    console.warn("NEXT_PUBLIC_BLOB_BASE_URL not set — falling back to relative path:", pathname);
    return `/${pathname}`;
  }

  return `${normalizeBase(base)}/${pathname}`;
}

/**
 * Fallback DDragon URL. Must use a CURRENT ddVersion or new icon ids 404 → ORB.
 */
function getFallbackIconUrl(profileIconId: number | null, ddVersion: string): string | null {
  if (typeof profileIconId === "number" && profileIconId > 0) {
    return `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${profileIconId}.png`;
  }
  return null;
}

/**
 * IMPORTANT:
 * Your build script should output topChamps[].name as the DDragon champ "id" (file name),
 * e.g. "Riven", "MonkeyKing", "KaiSa", etc.
 */
function champKey(idOrName: string) {
  return (idOrName || "").replace(/[^A-Za-z]/g, "");
}

function champIcon(champIdOrName: string, ddVersion: string) {
  const id = champKey(champIdOrName);
  return `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${id}.png`;
}

/**
 * ✅ FIXED ROUTE:
 * your tree is /calculators/lol/champions/[slug]
 */
function champLink(champIdOrName: string) {
  return `/calculators/lol/champions/${encodeURIComponent(champKey(champIdOrName))}`;
}

/**
 * ✅ Square champ icon that AUTO-SHRINKS with viewport.
 * Uses a CSS variable --champ set on each row; clamped to keep it sane.
 */
function ChampSquareIcon({
  src,
  href,
  ariaLabel,
}: {
  src: string;
  href: string;
  ariaLabel: string;
}) {
  return (
    <Link href={href} aria-label={ariaLabel} className="relative block">
      <div
        className="shrink-0 overflow-hidden rounded-md border border-neutral-800 bg-black/40"
        style={{
          width: "clamp(16px, var(--champ), 26px)",
          height: "clamp(16px, var(--champ), 26px)",
        }}
      >
        <img
          src={src}
          alt=""
          loading="lazy"
          className="block h-full w-full object-cover object-center"
          draggable={false}
        />
      </div>
    </Link>
  );
}

export default function LeaderboardClient({
  initialRows,
  initialRegion,
  initialQueue,
  initialTier,
  initialGeneratedAt,
}: Props) {
  const [region, setRegion] = useState<RegionKey>(initialRegion);
  const [queue, setQueue] = useState<QueueKey>(initialQueue);
  const [tier, setTier] = useState<TierKey>(initialTier);

  const [rows, setRows] = useState<LeaderboardRow[]>(initialRows);
  const [generatedAt, setGeneratedAt] = useState<string | null>(initialGeneratedAt);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [brokenIcons, setBrokenIcons] = useState<Record<string, true>>({});

  // ✅ Use a modern default, then replace with latest DDragon version on mount.
  const [ddVersion, setDdVersion] = useState<string>("15.1.1");

  // ✅ Fetch latest ddVersion once (prevents ORB from new icon IDs).
  useEffect(() => {
    let cancelled = false;

    async function loadDdVersion() {
      try {
        const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", {
          cache: "force-cache",
        });
        if (!res.ok) return;
        const versions = (await res.json()) as string[];
        const latest = versions?.[0];
        if (!cancelled && latest) setDdVersion(latest);
      } catch {
        // ignore; keep default
      }
    }

    loadDdVersion();
    return () => {
      cancelled = true;
    };
  }, []);

  // ✅ ALWAYS read from Blob (dev + prod) so you don’t have to commit/push to test.
  const dataUrl = useMemo(() => {
    const pathname = `data/lol/leaderboards/${region}/${queue}.${tier.toLowerCase()}.json`;
    return blobUrl(pathname);
  }, [region, queue, tier]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr(null);

      try {
        // ✅ no-store + cache buster: avoid “stuck at 2/6” due to any caching layers
        const bust = `cb=${Date.now()}`;
        const url = dataUrl.includes("?") ? `${dataUrl}&${bust}` : `${dataUrl}?${bust}`;

        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load leaderboard (${res.status})`);
        const json = (await res.json()) as LeaderboardJson;

        if (cancelled) return;
        setRows(toRows(json));
        setGeneratedAt(json.generatedAt ?? null);
        setBrokenIcons({});
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Failed to load leaderboard.");
        setRows([]);
        setGeneratedAt(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  const surfaceCard = "bg-neutral-950/70 border-neutral-800";
  const surfaceInput = "bg-neutral-900/80 border-neutral-800 focus:border-neutral-600";
  const surfaceHeader = "bg-neutral-950/80";
  const surfaceRow = "bg-neutral-950/60";
  const surfaceHover = "";

  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent text-white">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-1/3 -left-32 h-[420px] w-[420px] rounded-full bg-white/8 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-[520px] w-[520px] rounded-full bg-white/8 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black" />
      </div>

      <div className="relative px-3 sm:px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <header className="mb-8 flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90">
              <img
                src="/gs-logo-v2.png"
                alt="GamerStation"
                className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_30px_rgba(0,255,255,0.12)]"
              />
              <span className="text-lg font-black tracking-tight">
                GamerStation<span className="align-super text-[0.6em]">™</span>
              </span>
            </Link>

            <div className="ml-auto">
              <Link href="/tools" className={navBtn}>
                Tools
              </Link>
            </div>
          </header>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">LoL Leaderboard</h1>
          <p className="mt-3 text-neutral-300">Browse top players and see their stats + most played champs.</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href="/calculators/lol/hub" className={navBtn}>
              LoL Hub
            </Link>
            <Link href="/calculators/lol/meta" className={navBtn}>
              Meta
            </Link>
            <Link href="/tools/lol/champion-tiers" className={navBtn}>
              Tiers List
            </Link>
          </div>

          <div className={`mt-6 rounded-2xl border p-4 ${surfaceCard}`}>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <div className="text-xs text-neutral-400">Region</div>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value as RegionKey)}
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none 
bg-black text-white border-white/10 focus:border-white/30`}

                >
                  {REGIONS.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-xs text-neutral-400">Queue</div>
                <select
                  value={queue}
                  onChange={(e) => setQueue(e.target.value as QueueKey)}
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none 
bg-black text-white border-white/10 focus:border-white/30`}

                >
                  {QUEUES.map((q) => (
                    <option key={q.key} value={q.key}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-xs text-neutral-400">Tier</div>
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value as TierKey)}
                 className={`w-full rounded-xl border px-3 py-2 text-sm outline-none 
bg-black text-white border-white/10 focus:border-white/30`}

                >
                  {TIERS.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-neutral-400">
              <div className="truncate">
                {generatedAt ? (
                  <>
                    • Updated <span className="text-neutral-200">{new Date(generatedAt).toLocaleString()}</span>
                  </>
                ) : (
                  <span className="text-neutral-500">• Not loaded yet</span>
                )}
                {loading ? <span className="ml-2 text-neutral-500">• Loading…</span> : null}
                <span className="ml-2 text-neutral-600">• Icons: {ddVersion}</span>
              </div>
            </div>

            {err ? <div className="mt-3 text-sm text-red-300">{err}</div> : null}
          </div>

          {/* ✅ mobile: no horizontal scroll; desktop unchanged (still scrolls if needed) */}
          <div className="-mx-2 sm:mx-0 mt-6 overflow-x-hidden sm:overflow-x-auto rounded-2xl border border-neutral-800">
            <div className="px-1 sm:px-0">
              <div className="min-w-0 sm:min-w-[760px]">
                {/* Header */}
                <div
                  className={`grid grid-cols-12 gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 text-[9px] sm:text-xs text-neutral-400 ${surfaceHeader}`}
                >
                  <div className="col-span-1">#</div>
                  <div className="col-span-4 sm:col-span-4">Player</div>
                  <div className="col-span-3 sm:col-span-2 text-right">LP</div>
                  <div className="col-span-2 sm:col-span-3 text-right">( W-L )</div>
                  <div className="col-span-2 sm:col-span-2 text-right whitespace-nowrap">Most Played</div>
                </div>

                {/* Body */}
                <div className={`divide-y divide-neutral-800 ${surfaceRow}`}>
                  {rows.length === 0 ? (
                    <div className="px-2 sm:px-4 py-10 text-sm text-neutral-400">
                      {loading ? "Loading…" : "No rows found for this selection."}
                    </div>
                  ) : (
                    rows.map((r) => {
                      const rowKey = `${r.region}-${r.queue}-${r.tier}-${r.puuid}`;
                      const displayName = (r.summonerName ?? "").trim() || "Unknown";

                      const preferredUrl = normalizeIconUrl(r.profileIconUrl);
                      const fallbackUrl = getFallbackIconUrl(r.profileIconId ?? null, ddVersion);

                      const isBroken = !!brokenIcons[rowKey];
                      const finalUrl = !isBroken ? preferredUrl || fallbackUrl : fallbackUrl;

                      const champs = (r.topChamps ?? []).slice(0, 3);

                      return (
                        <div
                          key={rowKey}
                          className={`grid grid-cols-12 items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 text-[11px] sm:text-sm transition ${surfaceHover}`}
                          style={{ ["--champ" as any]: "6vw" }}
                        >
                          <div className="col-span-1 text-neutral-400 tabular-nums">{r.rank}</div>

                          {/* Player */}
                          <div className="col-span-4 sm:col-span-4 min-w-0 flex items-center gap-2">
                            {finalUrl ? (
                              <div className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 overflow-hidden rounded-xl border border-neutral-800 bg-black/40">
                                <img
                                  src={finalUrl}
                                  alt=""
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  className="block h-full w-full object-cover object-center"
                                  draggable={false}
                                  onError={() => setBrokenIcons((prev) => ({ ...prev, [rowKey]: true }))}
                                />
                              </div>
                            ) : (
                              <div className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-xl border border-neutral-800 bg-neutral-900/40" />
                            )}

                            <div className="min-w-0">
                              <div className="min-w-0 truncate font-semibold text-neutral-200 whitespace-nowrap">
                                {displayName}
                              </div>
                            </div>
                          </div>

                          {/* LP */}
                          <div className="col-span-3 sm:col-span-2 text-right tabular-nums text-neutral-200 whitespace-nowrap text-[13px] sm:text-sm">
                            {fmtInt(r.lp)}
                          </div>

                          {/* W-L */}
                          <div className="col-span-2 sm:col-span-3 text-right tabular-nums text-neutral-300 whitespace-nowrap text-[11px] sm:text-sm">
                            <span className="sm:hidden">({r.wins}-{r.losses})</span>
                            <span className="hidden sm:inline">{fmtWL(r.wins, r.losses)}</span>
                          </div>

                          {/* Most Played */}
                          <div className="col-span-2 sm:col-span-2 flex items-center justify-end">
                            <div className="flex flex-wrap justify-end gap-1 sm:gap-2">
                              {champs.length ? (
                                champs.map((c) => (
                                  <div key={c.name} className="relative">
                                    <ChampSquareIcon
                                      src={champIcon(c.name, ddVersion)}
                                      href={champLink(c.name)}
                                      ariaLabel={c.name}
                                    />
                                    <span className="hidden sm:inline-block absolute -right-1 -bottom-1 rounded-full bg-black/90 border border-neutral-700 px-1.5 py-[1px] text-[10px] text-white">
                                      {c.count}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <span className="text-neutral-600">—</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-neutral-600">
            “Most Played” is computed from a small recent match sample per player (to keep rate limits safe).
          </div>
        </div>
      </div>
    </main>
  );
}
