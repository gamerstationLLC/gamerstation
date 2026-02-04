// app/tools/dota/meta/client.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export type HeroStatsRow = {
  id: number;
  name?: string;
  localized_name?: string;

  img?: string;
  icon?: string;

  pro_pick?: number;
  pro_win?: number;
  pro_ban?: number;

  [key: string]: any;
};

type Mode = "pub" | "pro";
type BracketKey =
  | "herald"
  | "guardian"
  | "crusader"
  | "archon"
  | "legend"
  | "ancient"
  | "divine"
  | "immortal";

type SortKey = "tier" | "pick" | "winrate" | "ban";

const BRACKETS: Array<{ key: BracketKey; label: string; n: number }> = [
  { key: "herald", label: "Herald", n: 1 },
  { key: "guardian", label: "Guardian", n: 2 },
  { key: "crusader", label: "Crusader", n: 3 },
  { key: "archon", label: "Archon", n: 4 },
  { key: "legend", label: "Legend", n: 5 },
  { key: "ancient", label: "Ancient", n: 6 },
  { key: "divine", label: "Divine", n: 7 },
  { key: "immortal", label: "Immortal", n: 8 },
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

// ✅ compact numbers on mobile so columns fit in portrait
function fmtCompactInt(n: number) {
  const x = Number.isFinite(n) ? Math.trunc(n) : 0;
  if (x >= 1_000_000) return `${(Math.round((x / 1_000_000) * 10) / 10).toFixed(1)}M`;
  if (x >= 10_000) return `${Math.round(x / 1000)}k`;
  if (x >= 1_000) return `${(Math.round((x / 1000) * 10) / 10).toFixed(1)}k`;
  return x.toString();
}

function sortLabel(sortBy: SortKey) {
  if (sortBy === "tier") return "Tier";
  if (sortBy === "pick") return "Picks";
  if (sortBy === "winrate") return "Winrate";
  return "Bans";
}

function sortArrow(active: boolean, desc: boolean) {
  if (!active) return "";
  // NBSP so it never wraps under on mobile
  return desc ? "\u00A0↓" : "\u00A0↑";
}

function getRelPath(r: HeroStatsRow) {
  return (r.icon || r.img || "").toString();
}

function buildSteamStaticUrl(rel: string) {
  if (!rel) return "";
  return `https://cdn.cloudflare.steamstatic.com${rel}`;
}

function buildOpenDotaCdnUrl(rel: string) {
  if (!rel) return "";
  return `https://cdn.opendota.com${rel}`;
}

function heroSlugFromRow(r: HeroStatsRow) {
  const raw = (r.name || "").toString().trim();
  if (raw.startsWith("npc_dota_hero_")) return raw.replace("npc_dota_hero_", "");
  const fallback = (r.localized_name || "").toString().toLowerCase().trim();
  return fallback
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

type Row = {
  id: number;
  name: string;
  slug: string;
  relPath: string;
  picks: number;
  wins: number;
  bans: number;
  winrate: number;

  score: number;
  tier: Tier;
  tierRank: number;
};

const HEADER_BTN = [
  "inline-flex w-full items-center justify-center gap-1 rounded-md border px-1.5 py-1",
  "text-[10px] font-semibold transition whitespace-nowrap leading-none sm:rounded-lg sm:px-2 sm:py-1 sm:text-xs",
  "border-neutral-800 bg-black text-neutral-200 hover:border-neutral-600 hover:text-white",
  "focus:outline-none focus:ring-1 focus:ring-neutral-600",
].join(" ");

const HEADER_BTN_DISABLED = [
  "inline-flex w-full items-center justify-center gap-1 rounded-md border px-1.5 py-1",
  "text-[10px] font-semibold whitespace-nowrap leading-none sm:rounded-lg sm:px-2 sm:py-1 sm:text-xs",
  "border-neutral-800 bg-black text-neutral-500 opacity-60 cursor-not-allowed",
].join(" ");

async function fetchLatestPatchClient(): Promise<string | null> {
  try {
    const res = await fetch("/api/dota/patch", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const name = (json?.patch ?? "").toString().trim();
    return name && name !== "—" ? name : null;
  } catch {
    return null;
  }
}

function isMode(x: string | null): x is Mode {
  return x === "pub" || x === "pro";
}
function isBracket(x: string | null): x is BracketKey {
  return (
    x === "herald" ||
    x === "guardian" ||
    x === "crusader" ||
    x === "archon" ||
    x === "legend" ||
    x === "ancient" ||
    x === "divine" ||
    x === "immortal"
  );
}
function isSortKey(x: string | null): x is SortKey {
  return x === "tier" || x === "pick" || x === "winrate" || x === "ban";
}

export default function DotaMetaClient({
  initialRows,
  patch = "—",
  cacheLabel = "~10 min",
}: {
  initialRows: HeroStatsRow[];
  patch?: string;
  cacheLabel?: string;
}) {
  const params = useSearchParams();
  const didHydrateRef = useRef(false);

  const [mode, setMode] = useState<Mode>("pub");
  const [bracket, setBracket] = useState<BracketKey>("legend");

  const [sortBy, setSortBy] = useState<SortKey>("tier");
  const [desc, setDesc] = useState(true);

  const [dirByKey, setDirByKey] = useState<Record<SortKey, boolean>>({
    tier: true,
    pick: true,
    winrate: true,
    ban: true,
  });

  const [q, setQ] = useState("");

  const [minGamesText, setMinGamesText] = useState("200");
  const minGames = useMemo(() => {
    const n = Number(minGamesText);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [minGamesText]);

  const bracketNum = useMemo(
    () => BRACKETS.find((b) => b.key === bracket)?.n ?? 5,
    [bracket]
  );

  const [patchLive, setPatchLive] = useState<string>(patch || "—");

  useEffect(() => {
    setPatchLive(patch || "—");
  }, [patch]);

  // ✅ URL -> state hydration (runs once)
  useEffect(() => {
    if (didHydrateRef.current) return;
    didHydrateRef.current = true;

    const pMode = params.get("mode");
    const pBracket = params.get("bracket");
    const pQ = params.get("q");
    const pMin = params.get("minGames");
    const pSort = params.get("sort");
    const pDesc = params.get("desc");

    if (isMode(pMode)) setMode(pMode);
    if (isBracket(pBracket)) setBracket(pBracket);
    if (typeof pQ === "string" && pQ.length) setQ(pQ);

    if (typeof pMin === "string" && pMin.trim().length) {
      const n = Number(pMin);
      if (Number.isFinite(n) && n >= 0) setMinGamesText(String(Math.trunc(n)));
    }

    if (isSortKey(pSort)) {
      setSortBy(pSort);
      const rawDesc =
        pDesc === "1" || pDesc === "true"
          ? true
          : pDesc === "0" || pDesc === "false"
          ? false
          : null;
      if (rawDesc !== null) {
        setDesc(rawDesc);
        setDirByKey((prev) => ({ ...prev, [pSort]: rawDesc }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Patch refresher
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
    if (key === "ban" && mode !== "pro") return;

    setDirByKey((prev) => {
      const current = prev[key] ?? true;
      const nextDir = sortBy === key ? !current : current;
      return { ...prev, [key]: nextDir };
    });

    if (sortBy === key) {
      setDesc((prevDesc) => !prevDesc);
    } else {
      setSortBy(key);
      setDesc(dirByKey[key] ?? true);
    }
  }

  function setModeSafe(nextMode: Mode) {
    setMode(nextMode);
    if (nextMode !== "pro" && sortBy === "ban") {
      setSortBy("pick");
      setDesc(dirByKey.pick ?? true);
    } else {
      setDesc(dirByKey[sortBy] ?? true);
    }
  }

  const rows = useMemo((): Row[] => {
    const query = q.trim().toLowerCase();

    const derivedBase = (initialRows || []).map(
      (r): Omit<Row, "score" | "tier" | "tierRank"> => {
        const displayName = (r.localized_name || r.name || `Hero ${r.id}`).toString();
        const slug = heroSlugFromRow(r);
        const relPath = getRelPath(r);

        if (mode === "pro") {
          const picks = clampMin0(Number(r.pro_pick ?? 0));
          const wins = clampMin0(Number(r.pro_win ?? 0));
          const bans = clampMin0(Number(r.pro_ban ?? 0));
          const winrate = picks ? wins / picks : 0;
          return { id: r.id, name: displayName, slug, relPath, picks, wins, bans, winrate };
        }

        const pickKey = `${bracketNum}_pick`;
        const winKey = `${bracketNum}_win`;
        const picks = clampMin0(Number(r[pickKey] ?? 0));
        const wins = clampMin0(Number(r[winKey] ?? 0));
        const winrate = picks ? wins / picks : 0;

        return { id: r.id, name: displayName, slug, relPath, picks, wins, bans: 0, winrate };
      }
    );

    const stableFiltered = derivedBase.filter((r) => r.picks >= minGames);
    if (!stableFiltered.length) return [];

    const pickVals = stableFiltered.map((r) => Math.log1p(r.picks));
    const winVals = stableFiltered.map((r) => r.winrate);

    const muPick = mean(pickVals);
    const sdPick = std(pickVals, muPick);

    const muWin = mean(winVals);
    const sdWin = std(winVals, muWin);

    const W_PICK = 0.45;
    const W_WIN = 0.55;

    const withScores = stableFiltered.map((r) => {
      const zPick = (Math.log1p(r.picks) - muPick) / sdPick;
      const zWin = (r.winrate - muWin) / sdWin;
      const score = W_PICK * zPick + W_WIN * zWin;
      return { ...r, score };
    });

    const byScore = [...withScores].sort((a, b) => b.score - a.score);
    const n = byScore.length;

    const tierById = new Map<number, Tier>();
    for (let i = 0; i < n; i++) {
      const p = n <= 1 ? 1 : 1 - i / (n - 1);
      tierById.set(byScore[i].id, tierFromPercentile(p));
    }

    let finalRows: Row[] = withScores.map((r) => {
      const tier = tierById.get(r.id) ?? "—";
      return { ...r, tier, tierRank: TIER_RANK[tier] ?? 9 };
    });

    if (query) {
      finalRows = finalRows.filter((r) => r.name.toLowerCase().includes(query));
    }

    finalRows.sort((a, b) => {
      const av =
        sortBy === "tier"
          ? a.tierRank
          : sortBy === "pick"
          ? a.picks
          : sortBy === "ban"
          ? a.bans
          : a.winrate;

      const bv =
        sortBy === "tier"
          ? b.tierRank
          : sortBy === "pick"
          ? b.picks
          : sortBy === "ban"
          ? b.bans
          : b.winrate;

      const diff = av - bv;

      if (sortBy === "tier") return desc ? diff : -diff;
      return desc ? -diff : diff;
    });

    return finalRows.slice(0, 100);
  }, [initialRows, mode, bracketNum, q, minGames, sortBy, desc]);

  return (
    <section
      className={[
        // ✅ keep it wide on mobile WITHOUT weird border bars
        "-mx-4 sm:mx-0",
        "rounded-2xl border border-neutral-800 bg-black/60",
        "p-3 sm:p-4",
        "overflow-hidden",
      ].join(" ")}
    >
      {/* Controls (rounded card) */}
      <div className="rounded-2xl border border-neutral-800 bg-black/40 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold">Filters</div>

            <div className="flex flex-wrap gap-2">
              <ToggleButton active={mode === "pub"} onClick={() => setModeSafe("pub")}>
                Public (by rank)
              </ToggleButton>
              <ToggleButton active={mode === "pro"} onClick={() => setModeSafe("pro")}>
                Pro
              </ToggleButton>

              <div className="mx-2 hidden h-8 w-px bg-neutral-800 lg:block" />

              <select
                value={bracket}
                onChange={(e) => setBracket(e.target.value as BracketKey)}
                disabled={mode !== "pub"}
                className="h-9 rounded-xl border border-neutral-800 bg-black px-3 text-sm text-neutral-200 outline-none disabled:opacity-50"
                title={mode !== "pub" ? "Rank bracket only applies to Public mode" : undefined}
              >
                {BRACKETS.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label}
                  </option>
                ))}
              </select>

              <div className="ml-1 self-center text-xs text-neutral-500">
                Sorting: <span className="text-neutral-300">{sortLabel(sortBy)}</span>{" "}
                <span className="text-neutral-600">{desc ? "↓" : "↑"}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:items-end">
            
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search hero…"
                className="h-9 w-full rounded-xl border border-neutral-800 bg-black px-3 text-sm text-white outline-none focus:border-neutral-600 sm:w-[260px]"
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
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust / patch row */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        <span className="rounded-full border border-neutral-800 bg-black/40 px-3 py-1">
          Patch: <span className="text-neutral-200">{patchLive}</span>
        </span>
        <span className="rounded-full border border-neutral-800 bg-black/40 px-3 py-1">
          Data: <span className="text-neutral-200">OpenDota</span>
        </span>
      </div>

      <div className="mt-3 text-xs text-neutral-500">
        Tip: Tap a hero to see individual performance. Click column headers to toggle high→low.
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-800">
        <div className="overflow-x-hidden">
          <div className="w-full">
            {/* Header */}
            <div className="grid grid-cols-12 gap-0 bg-neutral-900/50 px-2 py-2 text-[10px] text-neutral-400 sm:px-3 sm:py-2 sm:text-xs">
              {/* ✅ MOBILE SPANS: Hero=6, Picks=2, Win=2, Ban=2  (fixes overlap) */}
              <div className="col-span-6 sm:col-span-5 flex items-center justify-between gap-2 min-w-0">
                <span className="whitespace-nowrap">Hero</span>
                <div className="w-[3.2rem] sm:w-auto">
                  <button type="button" onClick={() => onSortClick("tier")} className={HEADER_BTN} title="Sort by Tier">
                    Tier{sortArrow(sortBy === "tier", desc)}
                  </button>
                </div>
              </div>

              <div className="col-span-2 sm:col-span-3 flex items-center justify-end min-w-0">
                <button type="button" onClick={() => onSortClick("pick")} className={HEADER_BTN} title="Sort by Picks">
                  Picks{sortArrow(sortBy === "pick", desc)}
                </button>
              </div>

              <div className="col-span-2 sm:col-span-2 flex items-center justify-end min-w-0">
                <button
                  type="button"
                  onClick={() => onSortClick("winrate")}
                  className={HEADER_BTN}
                  title="Sort by Winrate"
                >
                  Win{sortArrow(sortBy === "winrate", desc)}
                </button>
              </div>

              <div className="col-span-2 sm:col-span-2 flex items-center justify-end min-w-0">
                <button
                  type="button"
                  onClick={() => onSortClick("ban")}
                  disabled={mode !== "pro"}
                  className={mode === "pro" ? HEADER_BTN : HEADER_BTN_DISABLED}
                  title={mode === "pro" ? "Sort by Bans" : "Bans available in Pro mode"}
                >
                  <span className="sm:hidden">Ban</span>
                  <span className="hidden sm:inline">Bans</span>
                  {mode === "pro" ? sortArrow(sortBy === "ban", desc) : ""}
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="divide-y divide-neutral-800">
              {rows.length ? (
                rows.map((r, idx) => (
                  <Link
                    key={r.id}
                    href={`/tools/dota/heroes/${r.slug}`}
                    className="grid grid-cols-12 items-start sm:items-center px-2 py-2 text-[12px] hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-neutral-600 sm:px-3 sm:py-2 sm:text-sm"
                    title={`Open ${r.name}`}
                  >
                    {/* ✅ same spans as header */}
                    <div className="col-span-6 sm:col-span-5 flex min-w-0 items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="w-5 shrink-0 text-[10px] text-neutral-500 sm:w-8 sm:text-xs">
                          {idx + 1}.
                        </div>
                        <HeroIcon relPath={r.relPath} />
                        <div
                          className={[
                            "min-w-0 font-medium text-neutral-100",
                            "whitespace-normal leading-[1.15] line-clamp-2",
                            "sm:whitespace-nowrap sm:truncate sm:line-clamp-none",
                          ].join(" ")}
                        >
                          {r.name}
                        </div>
                      </div>

                      <div className="self-center">
                        <TierPill tier={r.tier} />
                      </div>
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-right tabular-nums text-neutral-200 self-center whitespace-nowrap text-[11px] sm:text-sm">
                      <span className="sm:hidden">{fmtCompactInt(r.picks)}</span>
                      <span className="hidden sm:inline">{fmtInt(r.picks)}</span>
                    </div>

                    <div className="col-span-2 sm:col-span-2 text-right tabular-nums self-center whitespace-nowrap text-[11px] sm:text-sm">
                      <span
                        className={
                          r.winrate >= 0.52
                            ? "text-green-300"
                            : r.winrate <= 0.48
                            ? "text-red-300"
                            : "text-neutral-200"
                        }
                      >
                        {pct(r.winrate)}
                      </span>
                    </div>

                    <div className="col-span-2 sm:col-span-2 text-right tabular-nums text-neutral-200 self-center whitespace-nowrap text-[11px] sm:text-sm">
                      {mode === "pro" ? (
                        <>
                          <span className="sm:hidden">{fmtCompactInt(r.bans)}</span>
                          <span className="hidden sm:inline">{fmtInt(r.bans)}</span>
                        </>
                      ) : (
                        "—"
                      )}
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
    >
      {tier}
    </span>
  );
}

function HeroIcon({ relPath }: { relPath: string }) {
  const [src, setSrc] = useState(() => buildSteamStaticUrl(relPath));
  const [triedFallback, setTriedFallback] = useState(false);

  if (!relPath) {
    return <div className="h-7 w-7 shrink-0 rounded-lg border border-neutral-800 bg-black/40 sm:h-8 sm:w-8" />;
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className="h-7 w-7 shrink-0 rounded-lg border border-neutral-800 bg-black/40 sm:h-8 sm:w-8"
      onError={() => {
        if (!triedFallback) {
          setTriedFallback(true);
          setSrc(buildOpenDotaCdnUrl(relPath));
        }
      }}
    />
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-9 rounded-xl border px-3 text-sm transition",
        active
          ? "border-neutral-600 bg-white/10 text-white shadow-[0_0_18px_rgba(0,255,255,0.16)]"
          : "border-neutral-800 bg-black text-neutral-300 hover:border-neutral-600 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
