// app/tools/lol/champion-tiers/client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type ChampionStatsRow = {
  id?: number | string;

  // name/identity
  name?: string; // "Ahri"
  championName?: string;
  key?: string; // optional
  slug?: string; // preferred

  // images (optional)
  icon?: string;
  image?: string;

  // core stats (any of these)
  games?: number;
  picks?: number;

  wins?: number;
  winrate?: number; // 0..1

  bans?: number;
  banrate?: number; // 0..1

  // optional grouping
  role?: string; // top/jungle/mid/bot/support
  lane?: string;

  // sometimes datasets have nested by-role buckets
  // (we don't assume exact field names; we detect common shapes)
  [key: string]: any;
};

type Mode = "ranked" | "pro";
type RoleKey = "all" | "top" | "jungle" | "mid" | "bot" | "support";
type SortKey = "tier" | "games" | "winrate" | "banrate";

type Tier = "S" | "A" | "B" | "C" | "D" | "—";

const TIER_RANK: Record<Tier, number> = {
  S: 0,
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  "—": 9,
};

function pct(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${(Math.round(n * 1000) / 10).toFixed(1)}%`;
}

function clampMin0(n: number) {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function fmtInt(n: number) {
  const x = Number.isFinite(n) ? Math.trunc(n) : 0;
  return x.toLocaleString();
}

function shortRoleLabel(role: RoleKey) {
  if (role === "top") return "TOP";
  if (role === "jungle") return "JG";
  if (role === "mid") return "MID";
  if (role === "bot") return "BOT";
  if (role === "support") return "SUP";
  return "";
}

function slugifyLoL(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function mean(xs: number[]) {
  if (!xs.length) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function std(xs: number[], mu: number) {
  if (xs.length < 2) return 1;
  let v = 0;
  for (const x of xs) {
    const d = x - mu;
    v += d * d;
  }
  v /= xs.length;
  const out = Math.sqrt(v);
  return out > 1e-9 ? out : 1;
}

function tierFromPercentile(p: number): Tier {
  if (p >= 0.9) return "S";
  if (p >= 0.7) return "A";
  if (p >= 0.4) return "B";
  if (p >= 0.15) return "C";
  return "D";
}

function normalizeRole(raw: any): RoleKey {
  const s = (raw ?? "").toString().toLowerCase().trim();
  if (!s) return "all";

  // common synonyms
  if (s === "top" || s === "toplane" || s === "top_lane") return "top";
  if (s === "jungle" || s === "jg" || s === "jng") return "jungle";
  if (s === "mid" || s === "middle" || s === "midlane" || s === "mid_lane") return "mid";
  if (
    s === "bot" ||
    s === "bottom" ||
    s === "adc" ||
    s === "carry" ||
    s === "marksman" ||
    s === "botlane" ||
    s === "bot_lane"
  )
    return "bot";
  if (
    s === "support" ||
    s === "sup" ||
    s === "utility" ||
    s === "supp" ||
    s === "bot_support"
  )
    return "support";

  return "all";
}

/**
 * Data Dragon square:
 * https://ddragon.leagueoflegends.com/cdn/<patch>/img/champion/Ahri.png
 */
function buildDdragonSquareUrl(patch: string, championName: string) {
  const ver = (patch || "").toString().trim();
  const cleanName = (championName || "").toString().trim();
  if (!cleanName) return "";
  if (ver && ver !== "—") {
    return `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${cleanName}.png`;
  }
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/${cleanName}.png`;
}

async function fetchLatestPatchClient(): Promise<string | null> {
  try {
    const res = await fetch("/api/lol/patch", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const name = (json?.patch ?? "").toString().trim();
    return name && name !== "—" ? name : null;
  } catch {
    return null;
  }
}

type Row = {
  id: string;
  name: string;
  slug: string;
  role: RoleKey;

  imgUrl: string;
  games: number;
  wins: number;
  bans: number;

  winrate: number;
  banrate: number;

  score: number;
  tier: Tier;
  tierRank: number;
};

const BTN = [
  "inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition",
  "border-neutral-800 bg-black text-neutral-300 hover:border-neutral-600 hover:text-white",
  "focus:outline-none focus:ring-1 focus:ring-neutral-600",
].join(" ");

const BTN_ACTIVE = [
  "inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition",
  "border-neutral-600 bg-white/10 text-white shadow-[0_0_18px_rgba(0,255,255,0.16)]",
  "focus:outline-none focus:ring-1 focus:ring-neutral-600",
].join(" ");

const TH_BTN = [
  "inline-flex w-full items-center justify-center gap-1 rounded-md border px-1.5 py-1",
  "text-[10px] font-semibold transition whitespace-nowrap leading-none sm:rounded-lg sm:px-2 sm:py-1 sm:text-xs",
  "border-neutral-800 bg-black text-neutral-200 hover:border-neutral-600 hover:text-white",
  "focus:outline-none focus:ring-1 focus:ring-neutral-600",
].join(" ");

const TH_BTN_DISABLED = [
  "inline-flex w-full items-center justify-center gap-1 rounded-md border px-1.5 py-1",
  "text-[10px] font-semibold whitespace-nowrap leading-none sm:rounded-lg sm:px-2 sm:py-1 sm:text-xs",
  "border-neutral-800 bg-black text-neutral-500 opacity-60 cursor-not-allowed",
].join(" ");

function sortArrow(active: boolean, desc: boolean) {
  if (!active) return "";
  return desc ? "\u00A0↓" : "\u00A0↑";
}

/**
 * If your tiers JSON is per-champ only: role filtering is not real.
 * If your tiers JSON includes per-role buckets: we expand them into real rows.
 *
 * Supported shapes (auto-detected):
 *  - row.role / row.lane: "top" | "jungle" | ...
 *  - row.roles: { top: {...stats}, mid: {...stats}, ... }
 *  - row.byRole / row.by_role: { ... }
 *  - row.lanes / row.byLane / row.by_lane: { ... }
 *  - row.top / row.jungle / row.mid / row.bot / row.support (object buckets)
 */
function pickRoleBuckets(r: ChampionStatsRow): Partial<Record<RoleKey, any>> | null {
  const candidates = [
    r.roles,
    r.byRole,
    r.by_role,
    r.lanes,
    r.byLane,
    r.by_lane,
    r.roleStats,
    r.role_stats,
  ];

  for (const c of candidates) {
    if (c && typeof c === "object" && !Array.isArray(c)) {
      const out: Partial<Record<RoleKey, any>> = {};
      for (const k of Object.keys(c)) {
        const rk = normalizeRole(k);
        if (rk !== "all" && c[k] && typeof c[k] === "object") out[rk] = c[k];
      }
      if (Object.keys(out).length) return out;
    }
  }

  // also support flat keys like r.top / r.jungle etc if they look like stat buckets
  const flatOut: Partial<Record<RoleKey, any>> = {};
  const flatKeys: Array<[RoleKey, any]> = [
    ["top", (r as any).top],
    ["jungle", (r as any).jungle],
    ["mid", (r as any).mid],
    ["bot", (r as any).bot],
    ["support", (r as any).support],
  ];
  for (const [rk, v] of flatKeys) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      // only treat as bucket if it contains at least one stat-ish field
      if (
        "games" in v ||
        "picks" in v ||
        "wins" in v ||
        "winrate" in v ||
        "bans" in v ||
        "banrate" in v
      ) {
        flatOut[rk] = v;
      }
    }
  }
  return Object.keys(flatOut).length ? flatOut : null;
}

function computeCoreFromRow(r: any) {
  const games = clampMin0(Number(r.games ?? r.picks ?? 0));
  const wins =
    clampMin0(Number(r.wins ?? 0)) ||
    (Number.isFinite(r.winrate) ? Math.round(clampMin0(Number(r.winrate)) * games) : 0);
  const bans = clampMin0(Number(r.bans ?? 0));

  const winrate = Number.isFinite(r.winrate) ? clampMin0(Number(r.winrate)) : games ? wins / games : 0;
  const banrate = Number.isFinite(r.banrate) ? clampMin0(Number(r.banrate)) : games ? bans / games : 0;

  return { games, wins, bans, winrate, banrate };
}

export default function LolChampionTiersClient({
  initialRows,
  patch = "—",
  hrefBase = "/calculators/lol/champions",
}: {
  initialRows: ChampionStatsRow[];
  patch?: string;
  hrefBase?: string;
}) {
  const [mode, setMode] = useState<Mode>("ranked");
  const [role, setRole] = useState<RoleKey>("all");

  const [sortBy, setSortBy] = useState<SortKey>("tier");
  const [desc, setDesc] = useState(false); // tier: S->D
  const [q, setQ] = useState("");

  const [minGamesText, setMinGamesText] = useState("20");
  const minGames = useMemo(() => {
    const n = Number(minGamesText);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [minGamesText]);

  const [patchLive, setPatchLive] = useState<string>(patch || "—");

  useEffect(() => {
    setPatchLive(patch || "—");
  }, [patch]);

  useEffect(() => {
    let alive = true;

    async function refresh() {
      const latest = await fetchLatestPatchClient();
      if (!alive) return;
      if (latest) setPatchLive(latest);
    }

    refresh();
    const id = window.setInterval(refresh, 5 * 60 * 1000);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  function onSortClick(key: SortKey) {
    if (key === "banrate" && mode !== "pro") return;

    if (sortBy === key) {
      setDesc((d) => !d);
      return;
    }
    setSortBy(key);

    if (key === "tier") setDesc(false);
    else setDesc(true);
  }

  const { rows, hasRoleData } = useMemo((): { rows: Row[]; hasRoleData: boolean } => {
    const query = q.trim().toLowerCase();

    // Expand into per-role rows if dataset provides role buckets,
    // otherwise fall back to row.role/lane if present.
    const expanded: Array<{
      base: ChampionStatsRow;
      role: RoleKey;
      statsSource: any; // either base row or role bucket
      keySuffix: string;
    }> = [];

    for (let i = 0; i < (initialRows || []).length; i++) {
      const r = (initialRows || [])[i];
      const buckets = pickRoleBuckets(r);

      if (buckets) {
        for (const rk of ["top", "jungle", "mid", "bot", "support"] as const) {
          const b = buckets[rk];
          if (!b) continue;
          expanded.push({
            base: r,
            role: rk,
            statsSource: b,
            keySuffix: `:${rk}`,
          });
        }
        continue;
      }

      const rk = normalizeRole(r.role ?? r.lane);
      expanded.push({
        base: r,
        role: rk,
        statsSource: r,
        keySuffix: rk !== "all" ? `:${rk}` : "",
      });
    }

    const derivedBase = expanded.map((x, i): Omit<Row, "score" | "tier" | "tierRank"> => {
      const r = x.base;

      const displayName = (
        r.name ||
        r.championName ||
        (typeof r.key === "string" ? r.key : "") ||
        `Champion ${i + 1}`
      ).toString();

      const slug = (r.slug || slugifyLoL(displayName)).toString();

      const existing = (r.icon || r.image || "").toString().trim();
      const imgUrl = existing ? existing : buildDdragonSquareUrl(patchLive, displayName);

      const idBase = (r.id ?? r.key ?? slug).toString();
      const id = `${idBase}${x.keySuffix}`;

      const { games, wins, bans, winrate, banrate } = computeCoreFromRow(x.statsSource);

      return {
        id,
        name: displayName,
        slug,
        role: x.role,
        imgUrl,
        games,
        wins,
        bans,
        winrate,
        banrate,
      };
    });

    // Determine if role filtering is actually meaningful:
    // - any row has a non-"all" role
    // - AND we have at least 2 distinct roles represented
    const roleSet = new Set<RoleKey>();
    for (const r of derivedBase) {
      if (r.role !== "all") roleSet.add(r.role);
    }
    const hasRoleData = roleSet.size >= 2;

    let filtered = derivedBase;

    // Only apply role filter if role data is real; otherwise keep "all"
    const effectiveRole = hasRoleData ? role : "all";

    if (effectiveRole !== "all") filtered = filtered.filter((r) => r.role === effectiveRole);
    if (query) filtered = filtered.filter((r) => r.name.toLowerCase().includes(query));
    filtered = filtered.filter((r) => r.games >= minGames);

    const gVals = filtered.map((r) => Math.log1p(r.games));
    const wVals = filtered.map((r) => r.winrate);
    const bVals = filtered.map((r) => r.banrate);

    const muG = mean(gVals);
    const sdG = std(gVals, muG);

    const muW = mean(wVals);
    const sdW = std(wVals, muW);

    const muB = mean(bVals);
    const sdB = std(bVals, muB);

    const W_GAMES = 0.30;
    const W_WIN = 0.65;
    const W_BAN = mode === "pro" ? 0.20 : 0.05;

    const withScores = filtered.map((r) => {
      const zG = (Math.log1p(r.games) - muG) / sdG;
      const zW = (r.winrate - muW) / sdW;
      const zB = (r.banrate - muB) / sdB;
      const score = W_GAMES * zG + W_WIN * zW + W_BAN * zB;
      return { ...r, score };
    });

    const byScore = [...withScores].sort((a, b) => b.score - a.score);
    const n = byScore.length;

    const tierById = new Map<string, Tier>();
    for (let i = 0; i < n; i++) {
      const p = n <= 1 ? 1 : 1 - i / (n - 1);
      tierById.set(byScore[i].id, tierFromPercentile(p));
    }

    const finalRows: Row[] = withScores.map((r) => {
      const tier = tierById.get(r.id) ?? "—";
      return { ...r, tier, tierRank: TIER_RANK[tier] ?? 9 };
    });

    finalRows.sort((a, b) => {
      const av =
        sortBy === "tier"
          ? a.tierRank
          : sortBy === "games"
          ? a.games
          : sortBy === "banrate"
          ? a.banrate
          : a.winrate;

      const bv =
        sortBy === "tier"
          ? b.tierRank
          : sortBy === "games"
          ? b.games
          : sortBy === "banrate"
          ? b.banrate
          : b.winrate;

      const diff = av - bv;
      if (sortBy === "tier") return desc ? -diff : diff;
      return desc ? -diff : diff;
    });

    return { rows: finalRows.slice(0, 200), hasRoleData };
  }, [initialRows, patchLive, mode, role, q, minGames, sortBy, desc]);

  // If role data isn't real, force UI back to "all"
  useEffect(() => {
    if (!hasRoleData && role !== "all") setRole("all");
  }, [hasRoleData, role]);

  return (
    <section
      className={[
        "-mx-4 sm:mx-0",
        "rounded-2xl border border-neutral-800 bg-black/60",
        "p-3 sm:p-4",
        "overflow-hidden",
      ].join(" ")}
    >
      {/* Controls */}
      <div className="rounded-2xl border border-neutral-800 bg-black/40 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-white">Tier List Filters</div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setMode("ranked")} className={mode === "ranked" ? BTN_ACTIVE : BTN}>
                Ranked
              </button>
              <button type="button" onClick={() => setMode("pro")} className={mode === "pro" ? BTN_ACTIVE : BTN}>
                Pro
              </button>

              <div className="mx-2 hidden h-8 w-px bg-neutral-800 lg:block" />

              

              <div className="ml-1 self-center text-xs text-neutral-500">
                Sort:{" "}
                <span className="text-neutral-200">
                  {sortBy === "tier"
                    ? "Tier"
                    : sortBy === "games"
                    ? "Games"
                    : sortBy === "winrate"
                    ? "Win Rate"
                    : "Ban Rate"}
                </span>{" "}
                <span className="text-neutral-600">{desc ? "↓" : "↑"}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:items-end">
            <div className="text-sm font-semibold text-white">Find a Champion</div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search (e.g., Ahri, Jinx, Lee Sin)…"
                className="h-9 w-full rounded-xl border border-neutral-800 bg-black px-3 text-sm text-white outline-none focus:border-neutral-600 sm:w-[300px]"
              />

              <div className="flex items-center gap-2">
                <div className="text-xs text-neutral-400">Min games</div>
                <input
                  type="number"
                  value={minGamesText}
                  min={0}
                  step={50}
                  onChange={(e) => setMinGamesText(e.target.value)}
                  className="h-9 w-28 rounded-xl border border-neutral-800 bg-black px-3 text-sm text-neutral-200 outline-none focus:border-neutral-600"
                  title="Filter out low-sample champions"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-800">
        <div className="overflow-x-hidden sm:overflow-x-auto">
          <div className="w-full sm:min-w-[760px]">
            {/* Header */}
            <div className="grid grid-cols-12 gap-0 bg-neutral-900/50 px-2 py-2 text-[10px] text-neutral-400 sm:px-3 sm:py-2 sm:text-xs">
              <div className="col-span-6 sm:col-span-5 flex items-center justify-between gap-2 min-w-0">
                <span className="whitespace-nowrap">Champion</span>
                <div className="w-[3.2rem] sm:w-auto">
                  <button type="button" onClick={() => onSortClick("tier")} className={TH_BTN} title="Sort by Tier">
                    Tier{sortArrow(sortBy === "tier", desc)}
                  </button>
                </div>
              </div>

              <div className="col-span-2 sm:col-span-3 flex items-center justify-end min-w-0">
                <button type="button" onClick={() => onSortClick("games")} className={TH_BTN} title="Sort by Games">
                  Games{sortArrow(sortBy === "games", desc)}
                </button>
              </div>

              <div className="col-span-2 sm:col-span-2 flex items-center justify-end min-w-0">
                <button type="button" onClick={() => onSortClick("winrate")} className={TH_BTN} title="Sort by Win%">
                  Win%{sortArrow(sortBy === "winrate", desc)}
                </button>
              </div>

              <div className="col-span-2 sm:col-span-2 flex items-center justify-end min-w-0">
                <button
                  type="button"
                  onClick={() => onSortClick("banrate")}
                  disabled={mode !== "pro"}
                  className={mode === "pro" ? TH_BTN : TH_BTN_DISABLED}
                  title={mode === "pro" ? "Sort by Ban%" : "Ban% available in Pro mode"}
                >
                  Ban%{mode === "pro" ? sortArrow(sortBy === "banrate", desc) : ""}
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="divide-y divide-neutral-800">
              {rows.length ? (
                rows.map((r, idx) => (
                  <Link
                    key={r.id}
                    href={`${hrefBase}/${r.slug}`}
                    className="grid grid-cols-12 items-center px-2 py-2 text-[12px] hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-neutral-600 sm:px-3 sm:py-2 sm:text-sm"
                    title={`Open ${r.name}`}
                  >
                    <div className="col-span-6 sm:col-span-5 flex min-w-0 items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="w-5 shrink-0 text-[10px] text-neutral-500 sm:w-8 sm:text-xs tabular-nums">
                          {idx + 1}.
                        </div>

                        <ChampionIcon src={r.imgUrl} />

                        <div className="min-w-0 font-medium text-neutral-100 whitespace-nowrap truncate">
                          {r.name}
                          {r.role !== "all" ? (
                            <span className="ml-2 rounded-md border border-neutral-800 bg-black/40 px-2 py-0.5 text-[10px] sm:text-[11px] text-neutral-400">
                              {shortRoleLabel(r.role)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <TierPill tier={r.tier} />
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-right tabular-nums text-neutral-200 self-center whitespace-nowrap text-[11px] sm:text-sm">
                      {fmtInt(r.games)}
                    </div>

                    <div className="col-span-2 sm:col-span-2 text-right tabular-nums self-center whitespace-nowrap text-[11px] sm:text-sm">
                      <span
                        className={
                          r.winrate >= 0.52 ? "text-green-300" : r.winrate <= 0.48 ? "text-red-300" : "text-neutral-200"
                        }
                      >
                        {pct(r.winrate)}
                      </span>
                    </div>

                    <div className="col-span-2 sm:col-span-2 text-right tabular-nums text-neutral-200 self-center whitespace-nowrap text-[11px] sm:text-sm">
                      {mode === "pro" ? pct(r.banrate) : "—"}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="px-3 py-8 text-sm text-neutral-500">
                  No results. Try lowering <span className="text-neutral-300">Min games</span> or clearing search.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-neutral-800 bg-black/40 p-3 text-xs text-neutral-400">
        <div className="font-semibold text-neutral-200">How tiers are calculated</div>
        <div className="mt-1 leading-relaxed">
          Tiers are a snapshot from <span className="text-neutral-200">win rate</span> (primary),{" "}
          <span className="text-neutral-200">sample size</span> (stability), and{" "}
          <span className="text-neutral-200">ban pressure</span> (Pro mode tie-breaker). Use this as a quick meta overview
          — matchup and team comp still matter.
        </div>
      </div>
    </section>
  );
}

function TierPill({ tier }: { tier: Tier }) {
  const cls =
    tier === "S"
      ? "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200"
      : tier === "A"
      ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-200"
      : tier === "B"
      ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
      : tier === "C"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : tier === "D"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
      : "border-neutral-700 bg-neutral-900/40 text-neutral-400";

  return (
    <span
      className={`inline-flex h-5 min-w-[1.9rem] items-center justify-center rounded-md border px-1.5 text-[11px] font-semibold sm:h-6 sm:min-w-[2.25rem] sm:rounded-lg sm:px-2 sm:text-xs ${cls}`}
      title={`Tier ${tier}`}
    >
      {tier}
    </span>
  );
}

function ChampionIcon({ src }: { src: string }) {
  const [ok, setOk] = useState(true);

  if (!src || !ok) {
    return <div className="h-7 w-7 shrink-0 rounded-lg border border-neutral-800 bg-black/40 sm:h-8 sm:w-8" />;
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className="h-7 w-7 shrink-0 rounded-lg border border-neutral-800 bg-black/40 sm:h-8 sm:w-8 object-cover object-center"
      onError={() => setOk(false)}
    />
  );
}
