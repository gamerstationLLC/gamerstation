// app/tools/dota/heroes/[slug]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import HeroImage from "./HeroImage";

type HeroStatsRow = {
  id: number;
  name?: string; // e.g. "npc_dota_hero_lion"
  localized_name?: string; // e.g. "Lion"
  img?: string; // larger (often rectangular) hero asset
  icon?: string; // smaller (more square-friendly) icon
  pro_pick?: number;
  pro_win?: number;
  pro_ban?: number;
  [key: string]: any; // 1_pick/1_win ... 8_pick/8_win
};

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

function clampMin0(n: number) {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function fmtInt(n: number) {
  const x = Number.isFinite(n) ? Math.trunc(n) : 0;
  return x.toLocaleString();
}

function pct(win: number, pick: number) {
  if (!pick) return "—";
  const p = win / pick;
  return `${(Math.round(p * 1000) / 10).toFixed(1)}%`;
}

function buildSteamStaticUrl(rel: string) {
  if (!rel) return "";
  return `https://cdn.cloudflare.steamstatic.com${rel}`;
}

function buildOpenDotaCdnUrl(rel: string) {
  if (!rel) return "";
  return `https://cdn.opendota.com${rel}`;
}

// ✅ For the square header avatar, prefer icon first (img is often rectangular and can look "morphed" in a square)
function bestHeaderRelImage(r: HeroStatsRow) {
  return (r.icon || r.img || "").toString();
}

const BRACKETS: Array<{ label: string; n: number }> = [
  { label: "Herald", n: 1 },
  { label: "Guardian", n: 2 },
  { label: "Crusader", n: 3 },
  { label: "Archon", n: 4 },
  { label: "Legend", n: 5 },
  { label: "Ancient", n: 6 },
  { label: "Divine", n: 7 },
  { label: "Immortal", n: 8 },
];

type FetchState = "ok" | "rate_limited" | "timeout" | "upstream_error";

type HeroStatsResult =
  | { state: "ok"; rows: HeroStatsRow[] }
  | { state: Exclude<FetchState, "ok">; rows: HeroStatsRow[]; retryAfterSec: number };

function guessRetryAfterSec(status: number, retryAfterHeader: string | null) {
  // Prefer Retry-After header if present
  if (retryAfterHeader) {
    const asInt = Number(retryAfterHeader);
    if (Number.isFinite(asInt) && asInt > 0) return Math.min(Math.max(asInt, 5), 300);

    const asDate = Date.parse(retryAfterHeader);
    if (Number.isFinite(asDate)) {
      const diff = Math.ceil((asDate - Date.now()) / 1000);
      if (diff > 0) return Math.min(Math.max(diff, 5), 300);
    }
  }

  // Reasonable defaults
  if (status === 429) return 30;
  if (status >= 500) return 15;
  return 20;
}

// ✅ Deduped + cached fetch across generateMetadata + page render
const getHeroStatsCached = cache(async (): Promise<HeroStatsResult> => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch("https://api.opendota.com/api/heroStats", {
      next: { revalidate: 300 }, // 5 min cache
      signal: controller.signal,
      headers: {
        "User-Agent": "GamerStation (https://gamerstation.gg)",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const retryAfter = res.headers.get("retry-after");
      const retryAfterSec = guessRetryAfterSec(res.status, retryAfter);

      // Fail-soft: DO NOT throw (prevents 500). We'll show a friendly "queue" UI.
      if (res.status === 429) {
        return { state: "rate_limited", rows: [], retryAfterSec };
      }
      return { state: "upstream_error", rows: [], retryAfterSec };
    }

    const rows = (await res.json()) as HeroStatsRow[];
    return { state: "ok", rows };
  } catch (e: any) {
    // Timeout / abort
    const msg = String(e?.message || "");
    if (msg.toLowerCase().includes("abort") || msg.toLowerCase().includes("timeout")) {
      return { state: "timeout", rows: [], retryAfterSec: 20 };
    }
    return { state: "upstream_error", rows: [], retryAfterSec: 20 };
  } finally {
    clearTimeout(t);
  }
});

async function getHeroBySlug(slug: string) {
  const result = await getHeroStatsCached();
  if (result.state !== "ok") return { hero: null as HeroStatsRow | null, result };
  const hero = result.rows.find((r) => heroSlugFromRow(r) === slug) ?? null;
  return { hero, result };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { hero } = await getHeroBySlug(slug);

  if (!hero) {
    return {
      title: "Hero unavailable | GamerStation",
      description: "Dota 2 hero data is temporarily unavailable. Please try again shortly.",
    };
  }

  const heroName = (hero.localized_name || hero.name || "Hero").toString();
  return {
    title: `${heroName} | Dota 2 Meta | GamerStation`,
    description: `Meta stats for ${heroName}: public pick/win by rank bracket and pro trends. Data via OpenDota.`,
  };
}

export default async function DotaHeroPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const { hero, result } = await getHeroBySlug(slug);

  // If OpenDota is rate-limiting or down, show a friendly "queue" state instead of 500.
  if (!hero && result.state !== "ok") {
    return (
      <main className="relative min-h-screen overflow-hidden bg-black text-white">
        {/* Ambient background */}
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

        <div className="relative px-4 py-10 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-3xl">
            <header className="mb-8 flex items-center">
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

              <Link
                href="/tools"
                className="ml-auto rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]"
              >
                Tools
              </Link>
            </header>

            <div className="rounded-2xl border border-neutral-800 bg-black/60 p-6">
              <div className="text-sm font-semibold text-neutral-200">
                {result.state === "rate_limited" ? "Too many requests right now" : "Data temporarily unavailable"}
              </div>

              <p className="mt-2 text-sm text-neutral-300">
                {result.state === "rate_limited"
                  ? "OpenDota is rate-limiting requests. We’ll be back in a moment."
                  : result.state === "timeout"
                  ? "OpenDota is responding slowly right now. Please try again shortly."
                  : "OpenDota is having issues right now. Please try again shortly."}
              </p>

              <div className="mt-4 rounded-2xl border border-neutral-800 bg-black/50 p-4">
                <div className="text-xs font-semibold text-neutral-300">Queue</div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="text-sm text-neutral-200">
                    Estimated retry: <span className="font-semibold">{result.retryAfterSec}s</span>
                  </div>
                  {/* Simple “progress bar” feel */}
                  <div className="h-2 w-40 overflow-hidden rounded-full border border-neutral-800 bg-black/60">
                    <div
                      className="h-full w-full"
                      style={{
                        // subtle animated shimmer using inline style + gradient; no extra CSS files needed
                        background:
                          "linear-gradient(90deg, rgba(0,255,255,0.10), rgba(255,255,255,0.06), rgba(0,255,255,0.10))",
                        backgroundSize: "200% 100%",
                        animation: "gs-shimmer 1.2s linear infinite",
                      }}
                    />
                  </div>
                </div>

                <div className="mt-3 text-xs text-neutral-500">
                  Tip: refresh after the timer, or use the hero index/meta list while we cool down.
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={`/tools/dota/heroes/${slug}`}
                  className="rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white"
                >
                  Retry now
                </Link>

                <Link
                  href="/tools/dota/meta"
                  className="rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white"
                >
                  Back to Meta
                </Link>

                <Link
                  href="/tools/dota/heroes"
                  className="rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white"
                >
                  Hero Index
                </Link>
              </div>
            </div>

            {/* Keyframes for shimmer (scoped to this page) */}
            <style
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{
                __html: `
                  @keyframes gs-shimmer {
                    0% { background-position: 0% 50%; }
                    100% { background-position: 200% 50%; }
                  }
                `,
              }}
            />
          </div>
        </div>
      </main>
    );
  }

  // If we couldn't find the hero but fetch succeeded, that's a real 404.
  if (!hero) notFound();

  const heroName = (hero.localized_name || hero.name || `Hero ${hero.id}`).toString();

  const rel = bestHeaderRelImage(hero);
  const steamSrc = buildSteamStaticUrl(rel);
  const opendotaSrc = buildOpenDotaCdnUrl(rel);

  const proPick = clampMin0(Number(hero.pro_pick ?? 0));
  const proWin = clampMin0(Number(hero.pro_win ?? 0));
  const proBan = clampMin0(Number(hero.pro_ban ?? 0));
  const proWr = proPick ? proWin / proPick : 0;

  // Aggregate bracket stats
  const bracketAgg = BRACKETS.map((b) => {
    const picks = clampMin0(Number(hero[`${b.n}_pick`] ?? 0));
    const wins = clampMin0(Number(hero[`${b.n}_win`] ?? 0));
    const wr = picks ? wins / picks : 0;
    return { ...b, picks, wins, wr };
  });

  const publicPicks = bracketAgg.reduce((a, b) => a + b.picks, 0);
  const publicWins = bracketAgg.reduce((a, b) => a + b.wins, 0);

  // Best/Worst bracket with sample guard
  const MIN_SAMPLE = 500;
  const viable = bracketAgg.filter((b) => b.picks >= MIN_SAMPLE);

  const bestBracket =
    viable.length > 0 ? viable.reduce((best, cur) => (cur.wr > best.wr ? cur : best), viable[0]) : null;

  const worstBracket =
    viable.length > 0 ? viable.reduce((worst, cur) => (cur.wr < worst.wr ? cur : worst), viable[0]) : null;

  // Mobile summary: top 3 pick brackets
  const topPickBrackets = [...bracketAgg]
    .sort((a, b) => b.picks - a.picks)
    .slice(0, 3)
    .map((b) => ({
      label: b.label,
      picks: b.picks,
      share: publicPicks ? b.picks / publicPicks : 0,
      wr: b.wr,
    }));

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Ambient background */}
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

      <div className="relative px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <header className="mb-8 flex items-center">
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

            <Link
              href="/tools"
              className="ml-auto rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]"
            >
              Tools
            </Link>
          </header>

          {/* Hero header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <HeroImage steamSrc={steamSrc} fallbackSrc={opendotaSrc} alt={heroName} />

            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{heroName}</h1>
              <p className="mt-2 text-sm text-neutral-300 sm:text-base">
                Public rank brackets + pro trends. Data from OpenDota.{" "}
                <span className="text-neutral-500">(Cached ~5 minutes)</span>
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/tools/dota/meta"
                  className="rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white"
                >
                  Back to Meta
                </Link>

                <Link
                  href="/tools/dota/heroes"
                  className="rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white"
                >
                  Hero Index
                </Link>
              </div>
            </div>
          </div>

          {/* High ROI quick stats */}
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Stat label="Public picks (all ranks)" value={fmtInt(publicPicks)} />
            <Stat label="Public winrate (all ranks)" value={pct(publicWins, publicPicks)} />
            <Stat label="Pro winrate" value={proPick ? `${(Math.round(proWr * 1000) / 10).toFixed(1)}%` : "—"} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* Pro Trends */}
            <div className="rounded-2xl border border-neutral-800 bg-black/60 p-5">
              <div className="text-sm font-semibold">Pro Trends</div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <StatTiny label="Pro picks" value={fmtInt(proPick)} />
                <StatTiny label="Pro bans" value={fmtInt(proBan)} />
                <StatTiny label="Pro winrate" value={pct(proWin, proPick)} />
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-800 bg-black/50 p-3">
                <div className="mt-0 text-xs text-neutral-500">
                  Bans are often the best “is this scary?” signal even when pro picks are low.
                </div>
              </div>
            </div>

            {/* Public by bracket */}
            <div className="rounded-2xl border border-neutral-800 bg-black/60 p-6 lg:col-span-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold">Public by Rank Bracket</div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Pill
                    label="Best bracket"
                    value={bestBracket ? `${bestBracket.label} (${(bestBracket.wr * 100).toFixed(1)}%)` : "—"}
                  />
                  <Pill
                    label="Worst bracket"
                    value={worstBracket ? `${worstBracket.label} (${(worstBracket.wr * 100).toFixed(1)}%)` : "—"}
                  />
                </div>
              </div>

              {/* Mobile summary */}
              <div className="mt-4 rounded-2xl border border-neutral-800 bg-black/50 p-4 md:hidden">
                <div className="text-xs font-semibold text-neutral-300">Where this hero is played (top brackets)</div>
                <div className="mt-3 grid gap-2">
                  {topPickBrackets.map((b) => (
                    <div key={b.label} className="flex items-center justify-between text-sm">
                      <div className="font-medium text-neutral-100">{b.label}</div>
                      <div className="text-right tabular-nums text-neutral-200">
                        {fmtInt(b.picks)} <span className="text-neutral-500">({(b.share * 100).toFixed(1)}%)</span>{" "}
                        <span className="text-neutral-500">•</span>{" "}
                        <span className={b.wr >= 0.52 ? "text-green-300" : b.wr <= 0.48 ? "text-red-300" : "text-neutral-200"}>
                          {(b.wr * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-neutral-500">
                  Tip: best/worst uses a minimum sample ({fmtInt(MIN_SAMPLE)}) to avoid tiny-pick bait.
                </div>
              </div>

              {/* Desktop table */}
              <div className="mt-4 hidden overflow-hidden rounded-2xl border border-neutral-800 md:block">
                <div className="grid grid-cols-12 bg-neutral-900/50 px-3 py-2 text-xs text-neutral-400">
                  <div className="col-span-4">Bracket</div>
                  <div className="col-span-4 text-right">Picks</div>
                  <div className="col-span-2 text-right">Share</div>
                  <div className="col-span-2 text-right">Winrate</div>
                </div>

                <div className="divide-y divide-neutral-800">
                  {bracketAgg.map((b) => {
                    const share = publicPicks ? b.picks / publicPicks : 0;
                    return (
                      <div key={b.n} className="grid grid-cols-12 items-center px-3 py-2 text-sm">
                        <div className="col-span-4 font-medium text-neutral-100">{b.label}</div>
                        <div className="col-span-4 text-right tabular-nums text-neutral-200">{fmtInt(b.picks)}</div>
                        <div className="col-span-2 text-right tabular-nums text-neutral-200">
                          {publicPicks ? `${(share * 100).toFixed(1)}%` : "—"}
                        </div>
                        <div
                          className={`col-span-2 text-right tabular-nums ${
                            b.wr >= 0.52 ? "text-green-300" : b.wr <= 0.48 ? "text-red-300" : "text-neutral-200"
                          }`}
                        >
                          {b.picks ? `${(b.wr * 100).toFixed(1)}%` : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 text-xs text-neutral-500">
                Public totals are aggregated across all brackets. High winrate with tiny picks is bait — sanity check samples.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-black/60 p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-neutral-100 tabular-nums">{value}</div>
    </div>
  );
}

function StatTiny({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-black/60 p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-100 tabular-nums">{value}</div>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-neutral-800 bg-black/50 px-3 py-1">
      <span className="text-neutral-500">{label}:</span> <span className="text-neutral-200">{value}</span>
    </div>
  );
}
