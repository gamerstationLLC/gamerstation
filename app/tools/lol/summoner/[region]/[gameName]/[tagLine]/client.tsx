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
  champ: string; // e.g. "Jax", "JarvanIV"
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
  region: string;
  riotId: string;
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
    usedFallbackByName?: boolean;
    attemptedRiotId?: string;
    partial?: {
      requested: number;
      loaded: number;
      failedMatches: number;
    };
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
  if (romanMatch) {
    s = `${romanMatch[1]}-${romanMatch[2]}`;
  }

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

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-black/40 px-5 py-4 shadow-[0_0_30px_rgba(0,255,255,0.06)]">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </div>
      <div className="mt-1 text-xl font-black text-white">{value}</div>
    </div>
  );
}

function TinyStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-black/35 px-4 py-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-black text-white">{value}</div>
    </div>
  );
}

function IconFallback({ text }: { text: string }) {
  const t = (text || "?").slice(0, 2).toUpperCase();
  return (
    <div className="grid h-full w-full place-items-center rounded-xl bg-neutral-900 text-sm font-black text-neutral-200">
      {t}
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

  const headerSub =
    data.meta?.usedFallbackByName && data.meta?.attemptedRiotId
      ? `Matched by Summoner Name (fallback from ${data.meta.attemptedRiotId})`
      : "Match history + quick aggregated stats";

  const partialNote =
    data.meta?.partial?.failedMatches && data.meta.partial.failedMatches > 0
      ? `Some matches could not be loaded right now (Riot API hiccup). Showing ${data.meta.partial.loaded}/${data.meta.partial.requested}.`
      : "";

  return (
    <div className="space-y-8">
      {/* Top profile card */}
      <section className="rounded-3xl border border-neutral-800 bg-black/45 p-6 shadow-[0_0_70px_rgba(0,255,255,0.08)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* Left: icon + name */}
          <div className="flex items-start gap-5">
            <div className="flex flex-col items-center gap-3">
              <div className="h-20 w-20 overflow-hidden rounded-2xl border border-neutral-800 bg-black shadow-[0_0_35px_rgba(0,255,255,0.18)]">
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

              <div className="rounded-full border border-neutral-800 bg-black/40 px-3 py-1 text-[11px] font-semibold text-neutral-200">
                Region: {data.region}
              </div>
            </div>

            <div className="pt-1">
              <div className="text-3xl font-black tracking-tight">{data.riotId}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-300">
                <span className="rounded-full border border-neutral-800 bg-black/35 px-3 py-1">
                  Level:{" "}
                  <span className="font-semibold text-white">{data.summoner.summonerLevel}</span>
                </span>
                <span className="rounded-full border border-neutral-800 bg-black/35 px-3 py-1">
                  Loaded games:{" "}
                  <span className="font-semibold text-white">{data.summary.games}</span>
                </span>
                <span className="rounded-full border border-neutral-800 bg-black/35 px-3 py-1">
                  {headerSub}
                </span>
              </div>
            </div>
          </div>

          {/* Right: headline stats */}
          <div className="grid w-full gap-3 sm:grid-cols-3 lg:w-[420px]">
            <TinyStat label="Win Rate" value={`${data.summary.winRate}%`} />
            <TinyStat label="W / L" value={`${data.summary.wins}/${data.summary.losses}`} />
            <TinyStat label="KDA" value={data.summary.kda} />
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <StatPill label="Avg CS" value={data.summary.avgCs} />
          <StatPill label="Avg Gold" value={fmtNum(data.summary.avgGold)} />
          <StatPill label="Avg Dmg to Champs" value={fmtNum(data.summary.avgDmgToChamps)} />
          <StatPill label="Avg Vision" value={data.summary.avgVision} />
        </div>

        {/* Most played */}
        <div className="mt-6">
          <div className="text-sm font-bold text-neutral-200">Most played (loaded)</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.summary.topChamps.map((c) => {
              const slug = champKeyToSlug(c.champ);
              const champIcon = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${c.champ}.png`;

              return (
                <Link
                  key={`${c.champ}-${c.games}`}
                  href={champHref(slug)}
                  className="group flex items-center gap-2 rounded-full border border-neutral-800 bg-black/35 px-3 py-2 text-xs text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.12)]"
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
                  <span className="text-neutral-400">·</span>
                  <span className="text-neutral-200">{c.games}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Recent matches */}
      <section className="rounded-3xl border border-neutral-800 bg-black/45 p-6 shadow-[0_0_70px_rgba(0,255,255,0.06)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-2xl font-black tracking-tight">Recent Matches</div>
            <div className="mt-1 text-sm text-neutral-400">
              Click a champion icon to open their page.
            </div>
            {partialNote ? (
              <div className="mt-2 text-xs text-amber-200/90">{partialNote}</div>
            ) : null}
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by champion / role / mode..."
            className="h-11 w-full rounded-2xl border border-neutral-800 bg-black/60 px-4 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-neutral-600 sm:w-[360px]"
          />
        </div>

        <div className="mt-5 space-y-4">
          {filtered.map((m) => {
            const slug = champKeyToSlug(m.champ);
            const champIcon = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${m.champ}.png`;

            return (
              <div
                key={m.matchId}
                className={`rounded-3xl border ${
                  m.win ? "border-emerald-900/50" : "border-rose-900/40"
                } bg-black/40 p-5 transition hover:border-neutral-600`}
              >
                <div className="flex items-center gap-4">
                  {/* Champion icon (clickable) */}
                  <Link
                    href={champHref(slug)}
                    className="group relative h-12 w-12 overflow-hidden rounded-2xl border border-neutral-800 bg-black shadow-[0_0_25px_rgba(0,255,255,0.08)]"
                    title={`Open ${m.champ} page`}
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
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <div className="text-lg font-black">{m.champ}</div>
                      <div className="rounded-full border border-neutral-800 bg-black/35 px-3 py-1 text-[11px] font-semibold text-neutral-300">
                        {m.role || "—"}
                      </div>
                      <div className="rounded-full border border-neutral-800 bg-black/35 px-3 py-1 text-[11px] font-semibold text-neutral-300">
                        {m.mode}
                      </div>
                      <div className="text-xs text-neutral-500">
                        · {Math.round(m.durationSec / 60)}:
                        {String(m.durationSec % 60).padStart(2, "0")} · {timeAgo(m.createdAt)}
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-neutral-500">
                      Match ID: <span className="text-neutral-300">{m.matchId}</span>
                    </div>
                  </div>

                  <div className="hidden gap-3 md:flex">
                    <TinyStat label="K / D / A" value={`${m.kills}/${m.deaths}/${m.assists}`} />
                    <TinyStat label="KDA" value={m.kda} />
                    <TinyStat label="CS" value={m.cs} />
                    <TinyStat label="Dmg" value={fmtNum(m.dmgToChamps)} />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:hidden sm:grid-cols-4">
                  <TinyStat label="K / D / A" value={`${m.kills}/${m.deaths}/${m.assists}`} />
                  <TinyStat label="KDA" value={m.kda} />
                  <TinyStat label="CS" value={m.cs} />
                  <TinyStat label="Dmg" value={fmtNum(m.dmgToChamps)} />
                </div>
              </div>
            );
          })}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-black/40 p-6 text-sm text-neutral-300">
              No matches found for that filter.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
