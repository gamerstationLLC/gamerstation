// app/tools/dota/heroes/[slug]/TrendsCard.tsx
"use client";

import { useMemo, useState } from "react";

type TopPickBracket = {
  label: string;
  picks: number;
  share: number; // 0..1
  wr: number; // 0..1
};

type ProPayload = {
  proPick: number;
  proBan: number;
  proWin: number;
  proPresence: number;
  proBanShare: number; // 0..1
  proPickShare: number; // 0..1
  pickToBan: number;
  proLoss: number;
  proNet: number;
  proSampleNote: string;
};

type PubPayload = {
  publicPicks: number;
  publicWinrateAll: number; // 0..1
  bestBracket: string; // preformatted label + %
  worstBracket: string; // preformatted label + %
  topPickBrackets: TopPickBracket[];
};

export default function TrendsCard({
  canonicalUrl,
  pro,
  pub,
}: {
  canonicalUrl: string;
  pro: ProPayload;
  pub: PubPayload;
}) {
  const [tab, setTab] = useState<"public" | "pro">("public");

  const nf = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 0,
      }),
    []
  );

  const pct = (win: number, pick: number) => {
    if (!pick) return "—";
    const p = win / pick;
    return `${(Math.round(p * 1000) / 10).toFixed(1)}%`;
  };

  const pct01 = (x: number) => {
    if (!Number.isFinite(x)) return "—";
    return `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
  };

  const copyLink = async () => {
    try {
      const url = `${window.location.origin}${canonicalUrl}`;
      await navigator.clipboard.writeText(url);
    } catch {
      // no-op
    }
  };

  return (
    <div className="self-start rounded-2xl border border-neutral-800 bg-black/60 p-6">
      
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setTab("public")}
          className={`rounded-xl border px-3 py-2 text-xs transition ${
            tab === "public"
              ? "border-neutral-600 bg-black text-white"
              : "border-neutral-800 bg-black/40 text-neutral-300 hover:border-neutral-600 hover:text-white"
          }`}
        >
          Public
        </button>
        <button
          onClick={() => setTab("pro")}
          className={`rounded-xl border px-3 py-2 text-xs transition ${
            tab === "pro"
              ? "border-neutral-600 bg-black text-white"
              : "border-neutral-800 bg-black/40 text-neutral-300 hover:border-neutral-600 hover:text-white"
          }`}
        >
          Pro
        </button>
      </div>

      {tab === "public" ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 rounded-2xl border border-neutral-800 bg-black/40 p-4">
            <Row label="Total picks" value={nf.format(pub.publicPicks)} />
            <Row label="Overall winrate" value={pct01(pub.publicWinrateAll)} />
            <Row label="Best bracket" value={pub.bestBracket} />
            <Row label="Worst bracket" value={pub.worstBracket} />
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-black/40 p-4">
            <div className="text-xs font-semibold text-neutral-300">Top pick brackets</div>
            <div className="mt-3 grid gap-2">
              {pub.topPickBrackets.map((b) => (
                <div key={b.label} className="flex items-center justify-between text-sm">
                  <div className="font-medium text-neutral-100">{b.label}</div>
                  <div className="text-right tabular-nums text-neutral-200">
                    {nf.format(b.picks)}{" "}
                    <span className="text-neutral-500">({(b.share * 100).toFixed(1)}%)</span>{" "}
                    <span className="text-neutral-500">•</span>{" "}
                    <span className={b.wr >= 0.52 ? "text-green-300" : b.wr <= 0.48 ? "text-red-300" : "text-neutral-200"}>
                      {(b.wr * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
              {pub.topPickBrackets.length === 0 ? (
                <div className="text-sm text-neutral-400">—</div>
              ) : null}
            </div>
          </div>

          <div className="text-xs text-neutral-500">
            Tip: sanity check winrate against pick volume — tiny samples are bait.
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 rounded-2xl border border-neutral-800 bg-black/40 p-4">
            <Row label="Pro picks" value={nf.format(pro.proPick)} />
            <Row label="Pro bans" value={nf.format(pro.proBan)} />
            <Row label="Pro presence" value={nf.format(pro.proPresence)} />
            <Row label="Pro winrate" value={pro.proPick ? pct(pro.proWin, pro.proPick) : "—"} />
          </div>

          <div className="grid gap-2 rounded-2xl border border-neutral-800 bg-black/40 p-4">
            <Row label="Ban share" value={pct01(pro.proBanShare)} />
            <Row label="Pick share" value={pct01(pro.proPickShare)} />
            <Row label="Pick : Ban" value={Number.isFinite(pro.pickToBan) ? pro.pickToBan.toFixed(2) : "—"} />
            <Row label="Net wins" value={Number.isFinite(pro.proNet) ? pro.proNet.toString() : "—"} />
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-black/40 p-4 text-sm text-neutral-200">
            <div className="text-xs font-semibold text-neutral-300">Sample note</div>
            <div className="mt-2 text-sm text-neutral-200">{pro.proSampleNote}</div>
          </div>

          <div className="text-xs text-neutral-500">
            Pro stats are much smaller samples — treat them as signal, not gospel.
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-sm font-semibold text-neutral-100 tabular-nums">{value}</div>
    </div>
  );
}
