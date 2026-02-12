// app/tools/lol/summoner/[region]/[gameName]/[tagLine]/client.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type MatchRow = {
  matchId: string;
  createdAt: number;
  durationSec: number;
  mode: string;
  queueId: number;
  win: boolean;
  champ: string;
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  kda: string;
  cs: number;
  gold: number;
  dmgToChamps: number;
  vision: number;
  items: number[];
  gameVersion?: string;
};

type SummonerProfileData = {
  riotId: string;
  platform: string;
  cluster: string;
  puuid: string;
  summoner: {
    profileIconId: number;
    summonerLevel: number;
  };
  summary: {
    games: number;
    wins: number;
    losses: number;
    winRate: number;
    k: number;
    d: number;
    a: number;
    kda: string;
    avgCs: number;
    avgGold: number;
    avgDmgToChamps: number;
    avgVision: number;
    topChamps: Array<{ champ: string; games: number }>;
  };
  matches: MatchRow[];
  meta?: {
    ddVersion?: string;
    matchIdsReturned?: number;
    matchDetailsLoaded?: number;
  };
};

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return `${s}s ago`;
}

function fmtNum(n: number) {
  return n.toLocaleString();
}

function fmtDur(sec: number) {
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function deriveDDragonVersion(data: SummonerProfileData): string {
  const direct = data.meta?.ddVersion;
  if (direct && typeof direct === "string") return direct;

  const gv = data.matches?.[0]?.gameVersion;
  if (gv && typeof gv === "string") {
    const parts = gv.split(".");
    if (parts.length >= 2) return `${parts[0]}.${parts[1]}.1`;
  }

  return "15.1.1";
}

function champKeyToSlug(champKey: string) {
  let s = (champKey || "").trim();
  const romanMatch = s.match(/^(.*?)(VIII|VII|VI|IV|V|III|II|IX|X)$/);
  if (romanMatch) s = `${romanMatch[1]}-${romanMatch[2]}`;
  s = s.replace(/([a-z])([A-Z])/g, "$1-$2");
  return s
    .replace(/['.]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function champHref(slug: string) {
  return `/calculators/lol/champions/${slug}`;
}

function IconFallback({ text }: { text: string }) {
  const t = (text || "?").slice(0, 2).toUpperCase();
  return (
    <div className="grid h-full w-full place-items-center rounded-2xl bg-neutral-900 text-sm font-black text-neutral-200">
      {t}
    </div>
  );
}

/** Mobile-friendly stat tile */
function StatTile({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-black/40 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-[15px] font-black text-white">{value}</div>
    </div>
  );
}

/** Compact pill for header */
function MetaPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-full border border-neutral-800 bg-black/35 px-3 py-1 text-[11px] font-semibold text-neutral-200">
      {children}
    </div>
  );
}

export default function SummonerProfileClient({ data }: { data: SummonerProfileData }) {
  const [q, setQ] = useState("");

  const ddVersion = useMemo(() => deriveDDragonVersion(data), [data]);

  const summonerIconUrl = useMemo(() => {
    const id = data?.summoner?.profileIconId;
    if (!id && id !== 0) return "";
    return `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${id}.png`;
  }, [data, ddVersion]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data.matches;
    return data.matches.filter((m) => {
      const hay = `${m.champ} ${m.role} ${m.mode} ${m.queueId}`.toLowerCase();
      return hay.includes(s);
    });
  }, [q, data.matches]);

  const matchIdsReturned = data.meta?.matchIdsReturned ?? 0;
  const matchDetailsLoaded = data.meta?.matchDetailsLoaded ?? data.matches.length;
  const matchDown = matchIdsReturned > 0 && matchDetailsLoaded === 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* =========================
          PROFILE HEADER (mobile-first)
      ========================== */}
      <section className="rounded-3xl border border-neutral-800 bg-black/45 p-4 sm:p-6 shadow-[0_0_70px_rgba(0,255,255,0.08)]">
        {/* Mobile: center + stack; Desktop: side-by-side */}
        <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-2xl border border-neutral-800 bg-black shadow-[0_0_35px_rgba(0,255,255,0.18)]">
                {summonerIconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={summonerIconUrl}
                    alt="Summoner icon"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <IconFallback text={data.riotId} />
                )}
              </div>

              {/* On mobile, keep name beside icon; on desktop it can breathe */}
              <div className="min-w-0">
                <div className="truncate text-2xl sm:text-3xl font-black tracking-tight">
                  {data.riotId}
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-2 lg:justify-start">
                  <MetaPill>
                    Level:{" "}
                    <span className="font-semibold text-white">
                      {data.summoner.summonerLevel}
                    </span>
                  </MetaPill>
                  <MetaPill>
                    Loaded:{" "}
                    <span className="font-semibold text-white">{data.summary.games}</span>
                  </MetaPill>
                </div>
              </div>
            </div>

            {/* Platform pill: smaller + wraps on mobile */}
            <div className="mt-1 flex flex-wrap justify-center gap-2 lg:justify-start">
              <MetaPill>
                Platform: <span className="text-white">{data.platform}</span>
              </MetaPill>
              <MetaPill>
                Cluster: <span className="text-white">{data.cluster}</span>
              </MetaPill>
            </div>
          </div>

          {/* Key stats: 2x2 on mobile, 3 across on desktop */}
          <div className="grid w-full gap-3 sm:grid-cols-3 lg:w-[460px]">
            <StatTile label="Win Rate" value={`${data.summary.winRate}%`} />
            <StatTile label="W / L" value={`${data.summary.wins}/${data.summary.losses}`} />
            <StatTile label="KDA" value={data.summary.kda} />
          </div>
        </div>

        {matchDown ? (
          <div className="mt-4 rounded-2xl border border-amber-900/50 bg-amber-950/25 p-4 text-sm text-amber-200">
            Riot match history is temporarily returning errors. Your profile loaded, but match
            details couldn’t be fetched. Try again in a few minutes.
          </div>
        ) : null}

        {/* Avg stats: 2 columns on mobile, 4 on md+ */}
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Avg CS" value={data.summary.avgCs} />
          <StatTile label="Avg Gold" value={fmtNum(data.summary.avgGold)} />
          <StatTile label="Avg Dmg" value={fmtNum(data.summary.avgDmgToChamps)} />
          <StatTile label="Avg Vision" value={data.summary.avgVision} />
        </div>

        {/* Top champs: make them more compact + scroll-friendly on mobile */}
        <div className="mt-5">
          <div className="text-sm font-bold text-neutral-200">Most played (loaded)</div>

          <div className="mt-3 -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {data.summary.topChamps.map((c) => {
              const slug = champKeyToSlug(c.champ);
              const champIcon = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${c.champ}.png`;

              return (
                <Link
                  key={`${c.champ}-${c.games}`}
                  href={champHref(slug)}
                  className="snap-start group flex shrink-0 items-center gap-2 rounded-full border border-neutral-800 bg-black/35 px-3 py-2 text-xs text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.12)]"
                  title={`Go to ${c.champ} page`}
                >
                  <span className="h-6 w-6 overflow-hidden rounded-full border border-neutral-800 bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={champIcon}
                      alt={`${c.champ} icon`}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </span>
                  <span className="font-semibold text-white">{c.champ}</span>
                  <span className="text-neutral-500">·</span>
                  <span className="text-neutral-200">{c.games}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================
          RECENT MATCHES
      ========================== */}
      <section className="rounded-3xl border border-neutral-800 bg-black/45 p-4 sm:p-6 shadow-[0_0_70px_rgba(0,255,255,0.06)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xl sm:text-2xl font-black tracking-tight">Recent Matches</div>
            <div className="mt-1 text-sm text-neutral-400">
              Tap a champion icon to open their page.
            </div>
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by champion / role / mode..."
            className="h-11 w-full rounded-2xl border border-neutral-800 bg-black/60 px-4 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-neutral-600 sm:w-[360px]"
          />
        </div>

        <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
          {filtered.map((m) => {
            const slug = champKeyToSlug(m.champ);
            const champIcon = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${m.champ}.png`;

            return (
              <div
                key={m.matchId}
                className={`rounded-3xl border ${
                  m.win ? "border-emerald-900/50" : "border-rose-900/40"
                } bg-black/40 p-4 sm:p-5 transition hover:border-neutral-600`}
              >
                {/* Top row: icon + champ + outcome + meta */}
                <div className="flex items-center gap-3">
                  <Link
                    href={champHref(slug)}
                    className="group relative h-12 w-12 overflow-hidden rounded-2xl border border-neutral-800 bg-black shadow-[0_0_25px_rgba(0,255,255,0.08)]"
                    title={`Open ${m.champ} page`}
                    aria-label={`Open ${m.champ} page`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={champIcon}
                      alt={`${m.champ} icon`}
                      className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 truncate text-base sm:text-lg font-black">
                        {m.champ}
                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          m.win
                            ? "border-emerald-900/60 bg-emerald-950/30 text-emerald-200"
                            : "border-rose-900/60 bg-rose-950/30 text-rose-200"
                        }`}
                      >
                        {m.win ? "WIN" : "LOSS"}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                      <span className="rounded-full border border-neutral-800 bg-black/35 px-2.5 py-1 font-semibold text-neutral-300">
                        {m.role || "—"}
                      </span>
                      <span className="rounded-full border border-neutral-800 bg-black/35 px-2.5 py-1 font-semibold text-neutral-300">
                        {m.mode}
                      </span>
                      <span className="text-neutral-500">
                        · {fmtDur(m.durationSec)} · {timeAgo(m.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mobile stats: 2x2 grid (always shown) */}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
                  <StatTile label="K / D / A" value={`${m.kills}/${m.deaths}/${m.assists}`} />
                  <StatTile label="KDA" value={m.kda} />
                  <StatTile label="CS" value={m.cs} />
                  <StatTile label="Dmg" value={fmtNum(m.dmgToChamps)} />
                </div>

                {/* Desktop stats row */}
                <div className="mt-4 hidden gap-3 md:flex">
                  <StatTile label="K / D / A" value={`${m.kills}/${m.deaths}/${m.assists}`} />
                  <StatTile label="KDA" value={m.kda} />
                  <StatTile label="CS" value={m.cs} />
                  <StatTile label="Dmg" value={fmtNum(m.dmgToChamps)} />
                </div>

                {/* Match id: collapses on mobile to reduce clutter */}
                <div className="mt-3 text-[11px] text-neutral-600">
                  <span className="hidden sm:inline">
                    Match ID: <span className="text-neutral-300">{m.matchId}</span>
                  </span>
                  <span className="sm:hidden">
                    ID: <span className="text-neutral-400">{m.matchId.slice(0, 8)}…</span>
                  </span>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-black/40 p-6 text-sm text-neutral-300">
              {matchDown
                ? "Match details are temporarily unavailable from Riot right now."
                : "No matches found for that filter."}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
