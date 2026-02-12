"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type PlayerRef = {
  gameName?: string; // Riot ID game name (preferred)
  tagLine?: string; // Riot ID tag line (preferred)
  summonerName?: string; // fallback display (not linkable without tag)
  champ?: string; // optional champ name (if you want to show later)
  teamId?: number; // 100/200 optional
  win?: boolean; // optional
};

type MatchPlayers = {
  blue: PlayerRef[];
  red: PlayerRef[];
};

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

  // ✅ Optional: only needed for desktop "Players" column
  players?: MatchPlayers;
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

/* ---------------------------
   Data Dragon item info
--------------------------- */

type DdItem = {
  name?: string;
  plaintext?: string;
  description?: string;
  gold?: { total?: number; base?: number; sell?: number };
  stats?: Record<string, number>;
};

type DdItemDb = {
  data?: Record<string, DdItem>;
};

function stripHtml(input?: string) {
  if (!input) return "";
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function useDdItems(ddVersion: string) {
  const [db, setDb] = useState<Record<string, DdItem> | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/data/en_US/item.json`;
        const res = await fetch(url);
        if (!res.ok) return;
        const json = (await res.json()) as DdItemDb;
        if (!cancelled) setDb(json?.data ?? null);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ddVersion]);

  return db;
}

/* ---------------------------
   Utils
--------------------------- */

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

function fmt1(n: number) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(1);
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

/**
 * Your summoner page route:
 *   /tools/lol/summoner/<gameName>/<tagLine>
 */
function summonerHref(gameName: string, tagLine: string) {
  return `/tools/lol/summoner/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
}

function IconFallback({ text }: { text: string }) {
  const t = (text || "?").slice(0, 2).toUpperCase();
  return (
    <div className="grid h-full w-full place-items-center rounded-2xl bg-neutral-900 text-sm font-black text-neutral-200">
      {t}
    </div>
  );
}

/** Stat tile (default) */
function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-black/40 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-0.5 text-[14px] font-black text-white">{value}</div>
    </div>
  );
}

/** ✅ Compact stat tile for match rows (keeps row short) */
function StatTileSm({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-black/35 px-2.5 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] font-black text-white">{value}</div>
    </div>
  );
}

/** Tiny chip */
function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-neutral-800 bg-black/35 px-3 py-1 text-[11px] font-semibold text-neutral-200">
      <span className="text-neutral-500">{label}</span>{" "}
      <span className="text-white">{value}</span>
    </div>
  );
}

/** ✅ Smaller chip for tight match rows */
function ChipSm({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-neutral-800 bg-black/30 px-2.5 py-1 text-[10px] font-semibold text-neutral-200">
      <span className="text-neutral-500">{label}</span>{" "}
      <span className="text-white">{value}</span>
    </div>
  );
}

/** Compact pill */
function MetaPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-full border border-neutral-800 bg-black/35 px-3 py-1 text-[11px] font-semibold text-neutral-200">
      {children}
    </div>
  );
}

/* ---------------------------
   Item icon w/ Data Dragon popover
--------------------------- */

function ItemIcon({
  ddVersion,
  itemId,
  itemDb,
  size = 26,
}: {
  ddVersion: string;
  itemId: number;
  itemDb: Record<string, DdItem> | null;
  size?: number;
}) {
  const [open, setOpen] = useState(false);

  if (!itemId || itemId <= 0) return null; // (or keep placeholder if you want)

  const url = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/item/${itemId}.png`;
  const item = itemDb?.[String(itemId)];
  const title = item?.name ?? `Item ${itemId}`;

  const desc =
    stripHtml(item?.plaintext) ||
    stripHtml(item?.description) ||
    "No description available.";

  const popTop = size + 6;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        style={{ width: size, height: size }}
        className="overflow-hidden rounded-xl border border-neutral-800 bg-black/35 outline-none transition hover:border-neutral-600"
        aria-label={title}
        title={title}
      >
        <img src={url} alt={title} className="h-full w-full object-cover" />
      </button>

      {open ? (
        <div
          className="absolute right-0 z-30 w-[300px] rounded-2xl border border-neutral-800 bg-black/95 p-3 shadow-[0_0_30px_rgba(0,255,255,0.08)]"
          style={{ top: popTop }}
        >
          <div className="flex items-start gap-2">
            <div className="h-9 w-9 overflow-hidden rounded-xl border border-neutral-800 bg-black/60">
              <img src={url} alt={title} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-white">{title}</div>
              <div className="mt-0.5 text-[11px] text-neutral-400">
                {item?.gold?.total ? `Cost: ${item.gold.total.toLocaleString()}g` : "Cost: —"}
                {item?.gold?.sell ? ` · Sell: ${item.gold.sell.toLocaleString()}g` : ""}
              </div>
            </div>
          </div>
          <div className="mt-2 whitespace-pre-line text-[11px] leading-snug text-neutral-200">
            {desc}
          </div>
        </div>
      ) : null}
    </div>
  );
}


/* ---------------------------
   Players (ultra-compact, 2 columns)
   ✅ no scroll, truncates names, fits short row
--------------------------- */

function PlayersPanelCompact({
  players,
  className = "",
}: {
  players?: MatchPlayers;
  className?: string;
}) {
  const blue = (players?.blue ?? []).slice(0, 5);
  const red = (players?.red ?? []).slice(0, 5);

  const pillBase =
    "rounded-md border border-neutral-800 bg-black/25 px-2 py-[5px] text-[9px] font-semibold leading-tight transition min-w-0";

  const render = (p: PlayerRef, key: string) => {
    const label =
      p.gameName && p.tagLine ? `${p.gameName}#${p.tagLine}` : p.summonerName ?? "—";
    const clickable = Boolean(p.gameName && p.tagLine);

    const content = <span className="block truncate">{label}</span>;

    return clickable ? (
      <Link
        key={key}
        href={summonerHref(p.gameName!, p.tagLine!)}
        className={`${pillBase} text-neutral-200 hover:border-neutral-600 hover:text-white`}
        title={label}
      >
        {content}
      </Link>
    ) : (
      <div key={key} className={`${pillBase} text-neutral-500`} title={label}>
        {content}
      </div>
    );
  };

  return (
    <div
      className={`rounded-3xl border border-neutral-800 bg-black/18 p-3 flex flex-col ${className}`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        Players
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 min-w-0">
        <div className="min-w-0">
          <div className="text-[9px] font-semibold text-neutral-600">Blue</div>
          <div className="mt-1 flex flex-col gap-1 min-w-0">
            {blue.map((p, i) => render(p, `b-${i}-${p.gameName ?? p.summonerName ?? "x"}`))}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[9px] font-semibold text-neutral-600">Red</div>
          <div className="mt-1 flex flex-col gap-1 min-w-0">
            {red.map((p, i) => render(p, `r-${i}-${p.gameName ?? p.summonerName ?? "x"}`))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------
   Component
--------------------------- */

export default function SummonerProfileClient({ data }: { data: SummonerProfileData }) {
  const [q, setQ] = useState("");

  const ddVersion = useMemo(() => deriveDDragonVersion(data), [data]);
  const itemDb = useDdItems(ddVersion);

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

  const avgDurationSec = useMemo(() => {
    const ms = data.matches;
    if (!ms?.length) return 0;
    const sum = ms.reduce((acc, m) => acc + (m.durationSec || 0), 0);
    return Math.round(sum / ms.length);
  }, [data.matches]);

  const avgMinutes = avgDurationSec ? avgDurationSec / 60 : 0;
  const avgCsPerMin = avgMinutes ? data.summary.avgCs / avgMinutes : 0;
  const avgGoldPerMin = avgMinutes ? data.summary.avgGold / avgMinutes : 0;
  const avgDmgPerMin = avgMinutes ? data.summary.avgDmgToChamps / avgMinutes : 0;

  const primaryRole = useMemo(() => {
    const ms = data.matches;
    if (!ms?.length) return "";
    const counts = new Map<string, number>();
    for (const m of ms) {
      const r = (m.role || "").trim();
      if (!r) continue;
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    const best = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    return best?.[0] ?? "";
  }, [data.matches]);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* =========================
          PROFILE HEADER
      ========================== */}
      <section className="rounded-3xl border border-neutral-800 bg-black/45 p-4 sm:p-5 shadow-[0_0_70px_rgba(0,255,255,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-3xl border border-neutral-800 bg-black shadow-[0_0_35px_rgba(0,255,255,0.18)]">
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
                  {primaryRole ? (
                    <MetaPill>
                      Role: <span className="text-white">{primaryRole}</span>
                    </MetaPill>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-1 flex flex-wrap justify-center gap-2 lg:justify-start">
              <MetaPill>
                Platform: <span className="text-white">{data.platform}</span>
              </MetaPill>
              <MetaPill>
                Cluster: <span className="text-white">{data.cluster}</span>
              </MetaPill>
            </div>
          </div>

          <div className="grid w-full grid-cols-3 gap-2 lg:w-[460px]">
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

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Avg CS" value={data.summary.avgCs} />
          <StatTile label="Avg Gold" value={fmtNum(data.summary.avgGold)} />
          <StatTile label="Avg Dmg" value={fmtNum(data.summary.avgDmgToChamps)} />
          <StatTile label="Avg Vision" value={data.summary.avgVision} />
        </div>

        <div className="mt-3 hidden flex-wrap gap-2 md:flex">
          <Chip label="Avg CS/min" value={fmt1(avgCsPerMin)} />
          <Chip label="Avg Gold/min" value={fmt1(avgGoldPerMin)} />
          <Chip label="Avg Dmg/min" value={fmt1(avgDmgPerMin)} />
          <Chip label="Avg Dur" value={avgDurationSec ? fmtDur(avgDurationSec) : "—"} />
        </div>

        <div className="mt-4">
          <div className="text-sm font-bold text-neutral-200">Most played (loaded)</div>

          <div className="mt-2 -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
      <section className="rounded-3xl border border-neutral-800 bg-black/45 p-4 xl:p-5 shadow-[0_0_70px_rgba(0,255,255,0.06)]">
        <div className="mx-auto w-full lg:max-w-[980px] xl:max-w-[1040px]">
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
              className="h-10 w-full rounded-2xl border border-neutral-800 bg-black/60 px-4 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-neutral-600 sm:w-[340px]"
            />
          </div>

          <div className="mt-4 space-y-3">
            {filtered.map((m) => {
              const slug = champKeyToSlug(m.champ);
              const champIcon = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${m.champ}.png`;

              const minutes = m.durationSec ? m.durationSec / 60 : 0;
              const csPerMin = minutes ? m.cs / minutes : 0;
              const goldPerMin = minutes ? m.gold / minutes : 0;

              return (
                <div
                  key={m.matchId}
                  className={`rounded-3xl border ${
                    m.win ? "border-emerald-900/50" : "border-rose-900/40"
                  } bg-black/40 p-3 transition hover:border-neutral-600`}
                >
                  {/* ✅ Desktop: LEFT stats | MIDDLE items | RIGHT players — all fit in one short row */}
                  <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_240px_300px] md:gap-3 md:items-stretch">
                    {/* LEFT: compact match summary + stats */}
                    <div className="min-w-0 rounded-3xl border border-neutral-800 bg-black/18 p-3">
                      <div className="flex items-start gap-3">
                        <Link
                          href={champHref(slug)}
                          className="group relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-neutral-800 bg-black shadow-[0_0_25px_rgba(0,255,255,0.08)]"
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
                            <div className="min-w-0 truncate text-[17px] font-black">
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
                            <span className="rounded-full border border-neutral-800 bg-black/30 px-2.5 py-1 font-semibold text-neutral-300">
                              {m.role || "—"}
                            </span>
                            <span className="rounded-full border border-neutral-800 bg-black/30 px-2.5 py-1 font-semibold text-neutral-300">
                              {m.mode}
                            </span>
                            <span className="text-neutral-500">
                              · {fmtDur(m.durationSec)} · {timeAgo(m.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-4 gap-2">
                        <StatTileSm label="K / D / A" value={`${m.kills}/${m.deaths}/${m.assists}`} />
                        <StatTileSm label="KDA" value={m.kda} />
                        <StatTileSm label="CS" value={m.cs} />
                        <StatTileSm label="DMG" value={fmtNum(m.dmgToChamps)} />
                      </div>

                      <div className="mt-2 text-[10px] text-neutral-600">
                        Match ID: <span className="text-neutral-300">{m.matchId}</span>
                      </div>
                    </div>

                    {/* MIDDLE: compact items block (dead space) */}
                    <div className="rounded-3xl border border-neutral-800 bg-black/18 p-3 flex flex-col justify-between">
                      <div className="flex flex-col gap-2">
  <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
    Items
  </div>

  <div className="flex flex-wrap gap-1.5">
    <ChipSm label="CS/m" value={fmt1(csPerMin)} />
    <ChipSm label="Gold/m" value={fmt1(goldPerMin)} />
    <ChipSm label="Vis" value={String(m.vision ?? 0)} />
  </div>
</div>


                      <div className="mt-2 flex flex-wrap gap-1">
  {m.items
    ?.filter((id) => id && id > 0)
    .map((itemId, i) => (
      <ItemIcon
        key={`${m.matchId}-item-${i}`}
        ddVersion={ddVersion}
        itemId={itemId}
        itemDb={itemDb}
        size={38}
      />
    ))}
</div>


                      <div className="mt-2 text-[10px] text-neutral-600">
                        Click an item for details.
                      </div>
                    </div>

                    {/* RIGHT: players */}
                    <PlayersPanelCompact players={m.players} className="h-full" />
                  </div>

                  {/* ✅ Mobile: unchanged */}
                  <div className="md:hidden">
  <div className="rounded-3xl border border-neutral-800 bg-black/18 p-3">
    {/* Header */}
    <div className="flex items-start gap-3">
      <Link
        href={champHref(slug)}
        className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-neutral-800 bg-black shadow-[0_0_25px_rgba(0,255,255,0.08)]"
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
          <div className="min-w-0 truncate text-base font-black">{m.champ}</div>
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
            {timeAgo(m.createdAt)}
          </span>
        </div>
      </div>
    </div>

    {/* Stats (always clean on mobile) */}
    <div className="mt-3 grid grid-cols-2 gap-2">
      <StatTile label="K / D / A" value={`${m.kills}/${m.deaths}/${m.assists}`} />
      <StatTile label="KDA" value={m.kda} />
      <StatTile label="CS" value={m.cs} />
      <StatTile label="DMG" value={fmtNum(m.dmgToChamps)} />
    </div>

    {/* Items row (horizontal, no ugly wrapping) */}
    <div className="mt-3 rounded-2xl border border-neutral-800 bg-black/20 p-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Items
        </div>

        <div className="flex flex-wrap gap-1.5 justify-end">
          <ChipSm label="CS/m" value={fmt1(csPerMin)} />
          <ChipSm label="G/m" value={fmt1(goldPerMin)} />
          <ChipSm label="Vis" value={String(m.vision ?? 0)} />
        </div>
      </div>

      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(m.items ?? [])
          .filter((id) => id && id > 0)
          .slice(0, 7)
          .map((itemId, i) => (
            <ItemIcon
              key={`${m.matchId}-m-item-${i}`}
              ddVersion={ddVersion}
              itemId={itemId}
              itemDb={itemDb}
              size={28}
            />
          ))}
      </div>

      <div className="mt-1 text-[10px] text-neutral-600">Tap an item for details.</div>
    </div>

    {/* Players */}
    <div className="mt-3">
      <PlayersPanelCompact players={m.players} />
    </div>

    {/* Footer */}
    <div className="mt-3 text-[11px] text-neutral-600">
      Match ID: <span className="text-neutral-400">{m.matchId.slice(0, 12)}…</span>
    </div>
  </div>
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
        </div>
      </section>
    </div>
  );
}
