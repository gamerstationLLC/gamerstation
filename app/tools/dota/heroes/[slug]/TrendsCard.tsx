// app/tools/dota/heroes/[slug]/TrendsCardClient.tsx
"use client";

import { useMemo, useRef, useState } from "react";

type BracketRow = {
  label: string;
  n: number;
  picks: number;
  wins: number;
  wr: number;
};

type TopPickRow = {
  label: string;
  picks: number;
  share: number; // 0..1
  wr: number; // 0..1
};

type BestWorstRow =
  | {
      label: string;
      wr: number; // 0..1
    }
  | null;

function fmtInt(n: number) {
  const x = Number.isFinite(n) ? Math.trunc(n) : 0;
  return x.toLocaleString();
}

function pct1(x: number) {
  if (!Number.isFinite(x)) return "—";
  return `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
}

function clampMin0(n: number) {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function ratio(a: number, b: number) {
  if (!b) return "—";
  const x = a / b;
  if (!Number.isFinite(x)) return "—";
  return `${(Math.round(x * 100) / 100).toFixed(2)}×`;
}

function stopAll(e: React.SyntheticEvent) {
  // Prevent parent <Link>/<a> default and any router pushes attached to bubbling handlers
  // (Won't stop *capture*-phase handlers; that requires parent fix.)
  // @ts-ignore
  if (typeof (e as any).preventDefault === "function") e.preventDefault();
  // @ts-ignore
  if (typeof (e as any).stopPropagation === "function") e.stopPropagation();
}

function TogglePill({
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
      aria-pressed={active}
      onPointerDown={(e) => stopAll(e)}
      onPointerUp={(e) => stopAll(e)}
      onMouseDown={(e) => stopAll(e)}
      onMouseUp={(e) => stopAll(e)}
      onTouchStart={(e) => stopAll(e)}
      onTouchEnd={(e) => stopAll(e)}
      onClick={(e) => {
        stopAll(e);
        onClick();
      }}
      onKeyDown={(e) => {
        // prevent Enter/Space from triggering parent navigation
        if (e.key === "Enter" || e.key === " ") stopAll(e);
      }}
      className={[
        "h-9 rounded-xl border px-3 text-sm font-semibold transition",
        active
          ? "border-neutral-600 bg-white/10 text-white shadow-[0_0_18px_rgba(0,255,255,0.16)]"
          : "border-neutral-800 bg-black text-neutral-300 hover:border-neutral-600 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
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

function MiniBox({
  title,
  children,
  footnote,
}: {
  title: string;
  children: React.ReactNode;
  footnote?: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-black/50 p-4">
      <div className="text-xs font-semibold text-neutral-200">{title}</div>
      <div className="mt-3">{children}</div>
      {footnote ? <div className="mt-3 text-xs text-neutral-500">{footnote}</div> : null}
    </div>
  );
}

function KeyVal({
  left,
  right,
  rightMuted,
}: {
  left: string;
  right: string;
  rightMuted?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="text-neutral-300">{left}</div>
      <div className="text-right tabular-nums text-neutral-100">
        {right} {rightMuted ? <span className="text-neutral-500">{rightMuted}</span> : null}
      </div>
    </div>
  );
}

export default function TrendsCardClient(props: {
  // Public
  publicPicks: number;
  publicWins: number;
  publicWinrate: number; // 0..1
  minSample: number;
  bestBracket: BestWorstRow;
  worstBracket: BestWorstRow;
  topPickBrackets: TopPickRow[];

  // Pro
  proPick: number;
  proWin: number;
  proBan: number;
  proWinrate: number; // 0..1
}) {
  const {
    publicPicks,
    publicWinrate,
    minSample,
    bestBracket,
    worstBracket,
    topPickBrackets,
    proPick,
    proWin,
    proBan,
    proWinrate,
  } = props;

  const [tab, setTab] = useState<"pro" | "public">("pro");

  // If some parent click causes scroll-to-top, we restore scroll position after tab switch.
  const lastScrollYRef = useRef<number | null>(null);
  const setTabNoScrollJump = (next: "pro" | "public") => {
    lastScrollYRef.current = typeof window !== "undefined" ? window.scrollY : null;
    setTab(next);
    // next tick: restore
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        if (lastScrollYRef.current != null) {
          window.scrollTo({ top: lastScrollYRef.current });
        }
      });
    }
  };

  const proPresence = useMemo(() => clampMin0(proPick) + clampMin0(proBan), [proPick, proBan]);
  const proBanShare = useMemo(() => (proPresence ? proBan / proPresence : 0), [proPresence, proBan]);
  const proPickShare = useMemo(() => (proPresence ? proPick / proPresence : 0), [proPresence, proPick]);

  const proLosses = useMemo(() => {
    const p = clampMin0(proPick);
    const w = clampMin0(proWin);
    return p >= w ? p - w : 0;
  }, [proPick, proWin]);

  const proNet = useMemo(() => clampMin0(proWin) - proLosses, [proWin, proLosses]);

  const sampleLabel = useMemo(() => {
    if (proPick >= 300) return "Large sample — pretty meaningful.";
    if (proPick >= 100) return "Medium sample — somewhat meaningful.";
    if (proPick >= 30) return "Small sample — use caution.";
    return "Tiny sample — basically noise.";
  }, [proPick]);

  return (
    <div className="h-full rounded-2xl border border-neutral-800 bg-black/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">Trends</div>

        <div
          className="flex items-center gap-2"
          // extra safety: prevent wrapper clicks when interacting with the toggle area
          onPointerDown={(e) => stopAll(e)}
          onPointerUp={(e) => stopAll(e)}
          onMouseDown={(e) => stopAll(e)}
          onMouseUp={(e) => stopAll(e)}
          onTouchStart={(e) => stopAll(e)}
          onTouchEnd={(e) => stopAll(e)}
          onClick={(e) => stopAll(e)}
        >
          <TogglePill active={tab === "pro"} onClick={() => setTabNoScrollJump("pro")}>
            Pro
          </TogglePill>
          <TogglePill active={tab === "public"} onClick={() => setTabNoScrollJump("public")}>
            Public
          </TogglePill>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {tab === "pro" ? (
          <>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <StatTiny label="Pro picks" value={fmtInt(proPick)} />
              <StatTiny label="Pro bans" value={fmtInt(proBan)} />
              <StatTiny label="Pro winrate" value={proPick ? pct1(proWinrate) : "—"} />
            </div>

            <MiniBox
              title="Pro pressure"
              footnote="High bans relative to picks usually means “respect/denial” even if the hero isn’t spammed."
            >
              <div className="grid gap-2">
                <KeyVal left="Presence" right={fmtInt(proPresence)} />
                <KeyVal left="Ban share" right={pct1(proBanShare)} />
                <KeyVal left="Pick share" right={pct1(proPickShare)} />
                <KeyVal left="Pick : Ban" right={ratio(proPick, proBan)} />
              </div>
            </MiniBox>

            <MiniBox title="Pro results" footnote={sampleLabel}>
              <div className="grid gap-2">
                <KeyVal left="Wins" right={fmtInt(proWin)} />
                <KeyVal left="Losses" right={fmtInt(proLosses)} />
                <KeyVal left="Net" right={`${proNet >= 0 ? "+" : ""}${fmtInt(proNet)}`} />
              </div>
            </MiniBox>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <StatTiny label="Public picks" value={fmtInt(publicPicks)} />
              <StatTiny label="Public winrate" value={publicPicks ? pct1(publicWinrate) : "—"} />
            </div>

            <MiniBox title="Best / Worst bracket" footnote={`Uses min sample ${fmtInt(minSample)} picks to avoid tiny-pick bait.`}>
              <div className="grid gap-2">
                <KeyVal left="Best" right={bestBracket ? `${bestBracket.label} (${pct1(bestBracket.wr)})` : "—"} />
                <KeyVal left="Worst" right={worstBracket ? `${worstBracket.label} (${pct1(worstBracket.wr)})` : "—"} />
              </div>
            </MiniBox>

            <MiniBox title="Most played brackets">
              <div className="grid gap-2">
                {topPickBrackets.map((b) => (
                  <div key={b.label} className="flex items-center justify-between gap-3 text-sm">
                    <div className="font-medium text-neutral-100">{b.label}</div>
                    <div className="text-right tabular-nums text-neutral-200">
                      {fmtInt(b.picks)} <span className="text-neutral-500">({pct1(b.share)})</span>
                    </div>
                  </div>
                ))}
              </div>
            </MiniBox>
          </>
        )}
      </div>
    </div>
  );
}
