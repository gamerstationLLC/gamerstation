"use client";

import { useMemo, useState } from "react";

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function parseNum(input: string, fallback: number) {
  if (input.trim() === "") return fallback;
  const n = Number(input);
  return Number.isFinite(n) ? n : fallback;
}

function formatPct(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}

function formatNumber(n: number) {
  const rounded = Math.round(n);
  return rounded.toLocaleString();
}

type TabKey = "inputs" | "results";

export default function UptimeClient() {
  const [tab, setTab] = useState<TabKey>("inputs");

  // ✅ Use STRING state so user can delete "0" and type freely.
  // Casual
  const [baselineDpsStr, setBaselineDpsStr] = useState<string>("100000");
  const [fightSecondsStr, setFightSecondsStr] = useState<string>("240");
  const [downtimeSecondsStr, setDowntimeSecondsStr] = useState<string>("10");

  // Casual deaths (optional alternative to downtime)
  const [deathsStr, setDeathsStr] = useState<string>("0");
  const [deathPenaltySecondsStr, setDeathPenaltySecondsStr] =
    useState<string>("8");

  // Advanced toggle
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced (optional)
  const [majorCdMissedStr, setMajorCdMissedStr] = useState<string>("0");
  const [majorCdImpactPctStr, setMajorCdImpactPctStr] = useState<string>("3");
  const [minorCdMissedStr, setMinorCdMissedStr] = useState<string>("0");
  const [minorCdImpactPctStr, setMinorCdImpactPctStr] = useState<string>("1");

  const result = useMemo(() => {
    const baselineDps = clamp(parseNum(baselineDpsStr, 100000), 0, 10_000_000);

    const fightSeconds = clamp(parseNum(fightSecondsStr, 240), 10, 3600);

    // Downtime inputs
    const downtimeSeconds = clamp(parseNum(downtimeSecondsStr, 0), 0, fightSeconds);

    // Death downtime estimate
    const deaths = clamp(parseNum(deathsStr, 0), 0, 999);
    const deathPenaltySeconds = clamp(parseNum(deathPenaltySecondsStr, 8), 0, 60);
    const deathDowntime = clamp(deaths * deathPenaltySeconds, 0, fightSeconds);

    // Total downtime = typed downtime + estimated death downtime
    const totalDowntime = clamp(downtimeSeconds + deathDowntime, 0, fightSeconds);
    const uptimePct = (fightSeconds - totalDowntime) / fightSeconds;

    // Advanced: missed cooldown impact (optional)
    const majorMissed = clamp(parseNum(majorCdMissedStr, 0), 0, 999);
    const majorImpact = clamp(parseNum(majorCdImpactPctStr, 3), 0, 50) / 100;

    const minorMissed = clamp(parseNum(minorCdMissedStr, 0), 0, 999);
    const minorImpact = clamp(parseNum(minorCdImpactPctStr, 1), 0, 50) / 100;

    const majorLoss = showAdvanced ? majorMissed * majorImpact : 0;
    const minorLoss = showAdvanced ? minorMissed * minorImpact : 0;

    // Cap so result never goes negative
    const cdLossTotal = clamp(majorLoss + minorLoss, 0, 0.95);
    const cdMultiplier = 1 - cdLossTotal;

    const estimatedActualDps = baselineDps * uptimePct * cdMultiplier;

    const dpsLost = baselineDps - estimatedActualDps;
    const percentLost = baselineDps > 0 ? dpsLost / baselineDps : 0;

    const downtimeLostOnly = baselineDps - baselineDps * uptimePct;
    const cooldownLostOnly = baselineDps - baselineDps * cdMultiplier;

    return {
      baselineDps,
      fightSeconds,
      totalDowntime,
      uptimePct,
      cdMultiplier,
      cdLossTotal,
      estimatedActualDps,
      dpsLost,
      percentLost,
      downtimeLostOnly,
      cooldownLostOnly,
      deaths,
      deathDowntime,
    };
  }, [
    baselineDpsStr,
    fightSecondsStr,
    downtimeSecondsStr,
    deathsStr,
    deathPenaltySecondsStr,
    showAdvanced,
    majorCdMissedStr,
    majorCdImpactPctStr,
    minorCdMissedStr,
    minorCdImpactPctStr,
  ]);

  const Tabs = (
    <div className="flex w-full rounded-2xl border border-neutral-800 bg-neutral-950 p-1 sm:hidden">
      <button
        type="button"
        onClick={() => setTab("inputs")}
        className={[
          "flex-1 rounded-xl px-3 py-2 text-sm transition",
          tab === "inputs"
            ? "bg-black text-white"
            : "text-neutral-300 hover:text-white",
        ].join(" ")}
      >
        Inputs
      </button>
      <button
        type="button"
        onClick={() => setTab("results")}
        className={[
          "flex-1 rounded-xl px-3 py-2 text-sm transition",
          tab === "results"
            ? "bg-black text-white"
            : "text-neutral-300 hover:text-white",
        ].join(" ")}
      >
        Results
      </button>
    </div>
  );

  const InputsPanel = (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 space-y-6">
      <div>
        <div className="text-sm font-semibold">Inputs</div>
        <p className="mt-2 text-sm text-neutral-400">
          Casual-first estimate: uptime + deaths. Optional advanced section for
          missed cooldown windows.
        </p>
      </div>

      {/* Casual inputs */}
      <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
        <div className="text-sm font-semibold">Casual</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-neutral-400">Baseline DPS (clean)</label>
            <input
              inputMode="numeric"
              value={baselineDpsStr}
              onChange={(e) => setBaselineDpsStr(e.target.value)}
              className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
              placeholder="100000"
            />
            <p className="mt-2 text-xs text-neutral-500">
              Your DPS with strong uptime / clean play.
            </p>
          </div>

          <div>
            <label className="text-xs text-neutral-400">Pull duration (seconds)</label>
            <input
              inputMode="numeric"
              value={fightSecondsStr}
              onChange={(e) => setFightSecondsStr(e.target.value)}
              className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
              placeholder="240"
            />
            <p className="mt-2 text-xs text-neutral-500">
              Boss 120–300s is common; pulls 15–60s.
            </p>
          </div>

          <div>
            <label className="text-xs text-neutral-400">
              Downtime (seconds)
            </label>
            <input
              inputMode="numeric"
              value={downtimeSecondsStr}
              onChange={(e) => setDowntimeSecondsStr(e.target.value)}
              className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
              placeholder="10"
            />
            <p className="mt-2 text-xs text-neutral-500">
              Not hitting anything: mechanics, moving, target swaps.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-black/30 p-4">
            <div className="text-xs text-neutral-400">Deaths (optional)</div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] text-neutral-500">Deaths</label>
                <input
                  inputMode="numeric"
                  value={deathsStr}
                  onChange={(e) => setDeathsStr(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-500">
                  Seconds lost per death
                </label>
                <input
                  inputMode="numeric"
                  value={deathPenaltySecondsStr}
                  onChange={(e) => setDeathPenaltySecondsStr(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
                  placeholder="8"
                />
              </div>
            </div>

            <p className="mt-2 text-xs text-neutral-600">
              Adds estimated downtime for deaths (run back / battle rez delay).
            </p>
          </div>
        </div>
      </div>

      {/* Advanced section */}
      <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">Advanced</div>
            <p className="mt-1 text-xs text-neutral-500">
              Optional: estimate missed cooldown windows (quick approximation).
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="rounded-xl border border-neutral-800 bg-black px-3 py-2 text-xs text-neutral-300 hover:text-white hover:border-neutral-600 transition"
          >
            {showAdvanced ? "Hide" : "Show"}
          </button>
        </div>

        {showAdvanced ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-neutral-800 bg-black/30 p-4">
              <div className="text-xs text-neutral-400">Major cooldowns</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] text-neutral-500">Missed uses</label>
                  <input
                    inputMode="numeric"
                    value={majorCdMissedStr}
                    onChange={(e) => setMajorCdMissedStr(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-neutral-500">Impact per miss (%)</label>
                  <input
                    inputMode="numeric"
                    value={majorCdImpactPctStr}
                    onChange={(e) => setMajorCdImpactPctStr(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
                    placeholder="3"
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-neutral-600">
                Example: missing a big 2–3 min window.
              </p>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-black/30 p-4">
              <div className="text-xs text-neutral-400">Minor cooldowns</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] text-neutral-500">Missed uses</label>
                  <input
                    inputMode="numeric"
                    value={minorCdMissedStr}
                    onChange={(e) => setMinorCdMissedStr(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-neutral-500">Impact per miss (%)</label>
                  <input
                    inputMode="numeric"
                    value={minorCdImpactPctStr}
                    onChange={(e) => setMinorCdImpactPctStr(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
                    placeholder="1"
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-neutral-600">
                Example: missing smaller rotational cooldowns.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  const ResultsPanel = (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 space-y-6">
      <div>
        <div className="text-sm font-semibold">Results</div>
        <p className="mt-2 text-sm text-neutral-400">
          A practical estimate. Biggest wins usually come from uptime + staying alive.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
        <div className="text-xs text-neutral-400">Estimated DPS</div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <div className="text-2xl font-bold">
            {formatNumber(result.estimatedActualDps)}
          </div>
          <div className="text-xs text-neutral-400">
            Lost: {formatPct(result.percentLost)}
          </div>
        </div>
        <div className="mt-1 text-xs text-neutral-500">
          Uptime: {formatPct(result.uptimePct)} • Total downtime:{" "}
          {Math.round(result.totalDowntime)}s / {Math.round(result.fightSeconds)}s
        </div>
        {result.deaths > 0 ? (
          <div className="mt-1 text-xs text-neutral-600">
            Death downtime estimate: ~{Math.round(result.deathDowntime)}s
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
          <div className="text-xs text-neutral-400">Total DPS lost</div>
          <div className="mt-1 text-xl font-bold">{formatNumber(result.dpsLost)}</div>
          <div className="mt-1 text-xs text-neutral-500">
            vs baseline {formatNumber(result.baselineDps)}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
          <div className="text-xs text-neutral-400">Cooldown multiplier</div>
          <div className="mt-1 text-xl font-bold">{result.cdMultiplier.toFixed(3)}x</div>
          <div className="mt-1 text-xs text-neutral-500">
            (Only applied if Advanced is enabled)
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
        <div className="text-sm font-semibold">Breakdown</div>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-xs text-neutral-400">Loss from downtime only</div>
            <div className="text-sm font-semibold">
              {formatNumber(result.downtimeLostOnly)}
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-3">
            <div className="text-xs text-neutral-400">Loss from cooldown misses only</div>
            <div className="text-sm font-semibold">
              {formatNumber(result.cooldownLostOnly)}
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-3 sm:col-span-2">
            <div className="text-xs text-neutral-400">Total cooldown loss estimate</div>
            <div className="text-sm font-semibold">{formatPct(result.cdLossTotal)}</div>
          </div>
        </div>

        <p className="mt-3 text-xs text-neutral-600">
          Tip: If downtime loss is bigger than cooldown loss, fix uptime first.
        </p>
      </div>
    </div>
  );

  return (
    <div className="relative space-y-6 pb-24">
      {/* Mobile tabs */}
      {Tabs}

      {/* Mobile: one tab at a time */}
      <div className="sm:hidden">{tab === "inputs" ? InputsPanel : ResultsPanel}</div>

      {/* Desktop: show both */}
      <div className="hidden sm:block space-y-6">
        {InputsPanel}
        {ResultsPanel}
      </div>

      {/* Tiny sticky footer: simple + casual-friendly */}
      <div className="sticky bottom-3 z-20">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/90 backdrop-blur px-4 py-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] text-neutral-500">Estimated DPS</span>
              <span className="text-sm font-semibold">
                {formatNumber(result.estimatedActualDps)}
              </span>
              <div className="h-4 w-px bg-neutral-800" />
              <span className="text-[11px] text-neutral-500">
                Uptime {formatPct(result.uptimePct)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
