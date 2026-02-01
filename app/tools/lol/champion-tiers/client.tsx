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

  [key: string]: any;
};

type Mode = "ranked" | "pro";
type RoleKey = "all" | "top" | "jungle" | "mid" | "bot" | "support";
type SortKey = "tier" | "games" | "winrate" | "banrate";

const ROLES: Array<{ key: RoleKey; label: string }> = [
  { key: "all", label: "All roles" },
  { key: "top", label: "Top" },
  { key: "jungle", label: "Jungle" },
  { key: "mid", label: "Mid" },
  { key: "bot", label: "Bot" },
  { key: "support", label: "Support" },
];

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
  if (s === "top") return "top";
  if (s === "jungle" || s === "jg") return "jungle";
  if (s === "mid" || s === "middle") return "mid";
  if (s === "bot" || s === "adc" || s === "bottom") return "bot";
  if (s === "support" || s === "sup") return "support";
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
  // fallback while patch loads
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/${cleanName}.png`;
}

// ✅ fetch patch from your own API route (keep parity with Dota client)
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

const PILL = "rounded-full border border-neutral-800 bg-black/40 px-3 py-1";

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
  "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition",
  "border-neutral-800 bg-black text-neutral-200 hover:border-neutral-600 hover:text-white",
  "focus:outline-none focus:ring-1 focus:ring-neutral-600",
].join(" ");

const TH_BTN_DISABLED = [
  "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold",
  "border-neutral-800 bg-black text-neutral-500 opacity-60 cursor-not-allowed",
].join(" ");

function sortArrow(active: boolean, desc: boolean) {
  if (!active) return "";
  return desc ? " ↓" : " ↑";
}

export default function LolChampionTiersClient({
  initialRows,
  patch = "—",
  cacheLabel = "~5 min",
  hrefBase = "/calculators/lol/champions",
}: {
  initialRows: ChampionStatsRow[];
  patch?: string;
  cacheLabel?: string;
  hrefBase?: string;
}) {
  // “Ranked” vs “Pro” is a familiar tier-list convention.
  const [mode, setMode] = useState<Mode>("ranked");
  const [role, setRole] = useState<RoleKey>("all");

  // Tier lists default to Tier sort.
  const [sortBy, setSortBy] = useState<SortKey>("tier");
  const [desc, setDesc] = useState(false); // for tier: S->D is “ascending tierRank”
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
    // Disable banrate sort outside pro mode (expectation: bans matter in pro).
    if (key === "banrate" && mode !== "pro") return;

    if (sortBy === key) {
      setDesc((d) => !d);
      return;
    }
    setSortBy(key);

    // sensible defaults per column
    if (key === "tier") setDesc(false); // S->D
    else setDesc(true); // higher is better for games/winrate/banrate
  }

  const rows = useMemo((): Row[] => {
    const query = q.trim().toLowerCase();

    const derivedBase = (initialRows || []).map(
      (r, i): Omit<Row, "score" | "tier" | "tierRank"> => {
        const displayName = (
          r.name ||
          r.championName ||
          (typeof r.key === "string" ? r.key : "") ||
          `Champion ${i + 1}`
        ).toString();

        const slug = (r.slug || slugifyLoL(displayName)).toString();
        const roleKey = normalizeRole(r.role ?? r.lane);

        const games = clampMin0(Number(r.games ?? r.picks ?? 0));

        const wins =
          clampMin0(Number(r.wins ?? 0)) ||
          (Number.isFinite(r.winrate)
            ? Math.round(clampMin0(Number(r.winrate)) * games)
            : 0);

        const bans = clampMin0(Number(r.bans ?? 0));

        const winrate = Number.isFinite(r.winrate)
          ? clampMin0(Number(r.winrate))
          : games
          ? wins / games
          : 0;

        const banrate = Number.isFinite(r.banrate)
          ? clampMin0(Number(r.banrate))
          : games
          ? bans / games
          : 0;

        const existing = (r.icon || r.image || "").toString().trim();
        const imgUrl = existing ? existing : buildDdragonSquareUrl(patchLive, displayName);

        const id = (r.id ?? r.key ?? slug).toString();

        return {
          id,
          name: displayName,
          slug,
          role: roleKey,
          imgUrl,
          games,
          wins,
          bans,
          winrate,
          banrate,
        };
      }
    );

    let filtered = derivedBase;

    if (role !== "all") filtered = filtered.filter((r) => r.role === role);
    if (query) filtered = filtered.filter((r) => r.name.toLowerCase().includes(query));
    filtered = filtered.filter((r) => r.games >= minGames);

    // Score = z(games) + z(winrate) + small z(banrate) (banrate weighted higher in pro)
    const gVals = filtered.map((r) => Math.log1p(r.games));
    const wVals = filtered.map((r) => r.winrate);
    const bVals = filtered.map((r) => r.banrate);

    const muG = mean(gVals);
    const sdG = std(gVals, muG);

    const muW = mean(wVals);
    const sdW = std(wVals, muW);

    const muB = mean(bVals);
    const sdB = std(bVals, muB);

    // tuned to “feel” like tier lists:
    // winrate dominates, games stabilizes, bans are a tie-breaker (or pro-focused)
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

    // Score -> tier percentiles
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

    // Sorting
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

      // tier: smaller rank is better (S=0). desc=false => S->D
      if (sortBy === "tier") return desc ? diff : -diff;

      // numeric columns: desc=true => high->low
      return desc ? -diff : diff;
    });

    return finalRows.slice(0, 200);
  }, [initialRows, patchLive, mode, role, q, minGames, sortBy, desc]);

  const totalShown = rows.length;

  return (
    <section className="rounded-2xl border border-neutral-800 bg-black/60 p-4">
      {/* Top controls — make it feel like a real tier list */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        {/* Left: Mode + Role */}
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold text-white">Tier List Filters</div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("ranked")}
              className={mode === "ranked" ? BTN_ACTIVE : BTN}
              title="Solo Queue / ranked ladder data"
            >
              Ranked
            </button>
            <button
              type="button"
              onClick={() => setMode("pro")}
              className={mode === "pro" ? BTN_ACTIVE : BTN}
              title="Pro-focused weighting (bans matter more)"
            >
              Pro
            </button>

            <div className="mx-2 hidden h-8 w-px bg-neutral-800 lg:block" />

            <select
              value={role}
              onChange={(e) => setRole(e.target.value as RoleKey)}
              className="h-10 rounded-xl border border-neutral-800 bg-black px-3 text-sm text-neutral-200 outline-none focus:border-neutral-600"
              title="Filter by role"
            >
              {ROLES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>

            {/* Quick “Sort” indicator (people expect it) */}
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

        {/* Right: Search + Min games */}
        <div className="flex flex-col gap-2 lg:items-end">
          <div className="text-sm font-semibold text-white">Find a Champion</div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search (e.g., Ahri, Jinx, Lee Sin)…"
              className="h-10 w-full rounded-xl border border-neutral-800 bg-black px-3 text-sm text-white outline-none focus:border-neutral-600 sm:w-[300px]"
            />

            <div className="flex items-center gap-2">
              <div className="text-xs text-neutral-400">Min games</div>
              <input
                type="number"
                value={minGamesText}
                min={0}
                step={50}
                onChange={(e) => setMinGamesText(e.target.value)}
                className="h-10 w-28 rounded-xl border border-neutral-800 bg-black px-3 text-sm text-neutral-200 outline-none focus:border-neutral-600"
                title="Filter out low-sample champions"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Context row — THIS is what tier list players expect */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        <span className={PILL}>
          Patch <span className="text-neutral-200">{patchLive}</span>
        </span>
        <span className={PILL}>
          Data window <span className="text-neutral-200">{mode === "pro" ? "Pro-weighted" : "Ranked ladder"}</span>
        </span>
        <span className={PILL}>
          Updated <span className="text-neutral-200">{cacheLabel}</span>
        </span>
        <span className={PILL}>
          Showing <span className="text-neutral-200">{totalShown}</span>
        </span>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-800">
        <div className="overflow-x-auto">
          {/* wider min width so mobile understands it’s scrollable */}
          <div className="min-w-[760px]">
            <div className="grid grid-cols-12 gap-0 bg-neutral-900/50 px-3 py-2 text-xs text-neutral-400">
              <div className="col-span-5 flex items-center justify-between gap-2">
                <span>Champion</span>

                <button
                  type="button"
                  onClick={() => onSortClick("tier")}
                  className={TH_BTN}
                  title="Sort by Tier (S → D)"
                >
                  Tier{sortArrow(sortBy === "tier", desc)}
                </button>
              </div>

              <div className="col-span-3 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => onSortClick("games")}
                  className={TH_BTN}
                  title="Sort by Games played (sample size)"
                >
                  Games{sortArrow(sortBy === "games", desc)}
                </button>
              </div>

              <div className="col-span-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => onSortClick("winrate")}
                  className={TH_BTN}
                  title="Sort by Win Rate"
                >
                  Win%{sortArrow(sortBy === "winrate", desc)}
                </button>
              </div>

              <div className="col-span-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => onSortClick("banrate")}
                  className={mode === "pro" ? TH_BTN : TH_BTN_DISABLED}
                  title={mode === "pro" ? "Sort by Ban Rate (Pro)" : "Ban rate matters most in Pro mode"}
                >
                  Ban%{sortArrow(sortBy === "banrate", desc)}
                </button>
              </div>
            </div>

            <div className="divide-y divide-neutral-800">
              {rows.length ? (
                rows.map((r, idx) => (
                  <Link
                    key={r.id}
                    href={`${hrefBase}/${r.slug}`}
                    className="grid grid-cols-12 items-center px-3 py-2 text-sm hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-neutral-600"
                    title={`Open ${r.name}`}
                  >
                    <div className="col-span-5 flex min-w-0 items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="w-8 shrink-0 text-xs text-neutral-500">{idx + 1}.</div>
                        <ChampionIcon src={r.imgUrl} />
                        <div className="min-w-0 truncate font-medium text-neutral-100">
                          {r.name}
                          {r.role !== "all" ? (
                            <span className="ml-2 rounded-md border border-neutral-800 bg-black/40 px-2 py-0.5 text-[11px] text-neutral-400">
                              {shortRoleLabel(r.role)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <TierPill tier={r.tier} />
                    </div>

                    <div className="col-span-3 text-right tabular-nums text-neutral-200">
                      {fmtInt(r.games)}
                    </div>

                    <div
                      className={`col-span-2 text-right tabular-nums ${
                        r.winrate >= 0.52
                          ? "text-green-300"
                          : r.winrate <= 0.48
                          ? "text-red-300"
                          : "text-neutral-200"
                      }`}
                    >
                      {pct(r.winrate)}
                    </div>

                    <div className="col-span-2 text-right tabular-nums text-neutral-200">
                      {pct(r.banrate)}
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

      {/* “How to read” block — high ROI because it reduces bounce + confusion */}
      <div className="mt-3 rounded-2xl border border-neutral-800 bg-black/40 p-3 text-xs text-neutral-400">
        <div className="font-semibold text-neutral-200">How tiers are calculated</div>
        <div className="mt-1 leading-relaxed">
          Tiers are a snapshot from <span className="text-neutral-200">win rate</span> (primary),{" "}
          <span className="text-neutral-200">sample size</span> (stability), and{" "}
          <span className="text-neutral-200">ban pressure</span> (Pro mode tie-breaker). Use this as a quick meta
          overview — matchup and team comp still matter.
        </div>
        <div className="mt-2 text-neutral-500">
          Tip: On mobile, swipe sideways to see every column.
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
      className={`inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded-lg border px-2 text-xs font-semibold ${cls}`}
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
      className="h-7 w-7 shrink-0 rounded-lg border border-neutral-800 bg-black/40 sm:h-8 sm:w-8"
      onError={() => setOk(false)}
    />
  );
}
