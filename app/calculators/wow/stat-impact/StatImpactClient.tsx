"use client";

import { useEffect, useMemo, useState } from "react";

import {
  SPEC_DEFS,
  WOW_STAT_WEIGHTS_VERSION,
  type SpecKey,
  type ContentType,
} from "@/lib/wow/statweights";

/** Local-only types (not part of weights data) */
type Region = "us" | "eu" | "kr" | "tw";
type Realm = { name: string; slug: string };

type CharacterStats = {
  region: Region;
  realmSlug: string;
  name: string;
  level: number | null;
  primary: {
    strength: number | null;
    agility: number | null;
    intellect: number | null;
  };
  secondary: {
    critRating: number | null;
    critPct: number | null;
    hasteRating: number | null;
    hastePct: number | null;
    masteryRating: number | null;
    masteryPct: number | null;
    versatilityRating: number | null;
    versatilityDamageDoneBonusPct: number | null;
    versatilityDamageTakenReductionPct: number | null;
  };
};

type TabKey = "import" | "results";
type InputMode = "import" | "manual";
type StatKey = "crit" | "haste" | "mastery" | "vers";

function fmtNumber(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return String(Math.round(n));
}

function safe(n: number | null | undefined) {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/**
 * Allows fully-empty typing (""), prevents "050" stickiness.
 * Returns number or null (null means empty).
 */
function parseRatingInput(raw: string): number | null {
  const s = raw.trim();
  if (s === "") return null;
  const cleaned = s.replace(/[^\d]/g, "");
  if (cleaned === "") return null;
  const normalized = cleaned.replace(/^0+(?=\d)/, "");
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return num;
}

function normalizeInputString(raw: string): string {
  if (raw.trim() === "") return "";
  const cleaned = raw.replace(/[^\d]/g, "");
  if (cleaned === "") return "";
  return cleaned.replace(/^0+(?=\d)/, "");
}

function statLabel(k: StatKey) {
  switch (k) {
    case "crit":
      return "Crit";
    case "haste":
      return "Haste";
    case "mastery":
      return "Mastery";
    case "vers":
      return "Vers";
  }
}

function priorityLine(entries: { stat: StatKey }[]) {
  return entries.map((e) => e.stat.toUpperCase()).join(" → ");
}

/**
 * "What should I invest into next?"
 * Normalize ratings by current max rating so the current distribution
 * doesn't overwhelm spec identity.
 */
function computeImpactFromRatings(
  ratings: Record<StatKey, number>,
  weights: Record<StatKey, number>
) {
  const maxRating = Math.max(
    ratings.crit,
    ratings.haste,
    ratings.mastery,
    ratings.vers,
    1
  );

  const values: Record<StatKey, number> = {
    crit: (ratings.crit / maxRating) * weights.crit,
    haste: (ratings.haste / maxRating) * weights.haste,
    mastery: (ratings.mastery / maxRating) * weights.mastery,
    vers: (ratings.vers / maxRating) * weights.vers,
  };

  const entries = (Object.keys(values) as StatKey[]).map((k) => ({
    stat: k,
    rating: ratings[k],
    weight: weights[k],
    value: values[k], // normalizedValueUnits
  }));

  entries.sort((a, b) => b.value - a.value);

  const top = entries[0]?.stat ?? "haste";
  const topValue = entries[0]?.value ?? 0;

  const normalized = entries.map((e) => ({
    ...e,
    score100: topValue > 0 ? (e.value / topValue) * 100 : 0,
  }));

  const per100 = (Object.keys(weights) as StatKey[])
    .map((k) => ({ stat: k, units: weights[k] * 100 }))
    .sort((a, b) => b.units - a.units);

  return { entries: normalized, per100, bestStat: top as StatKey };
}

export default function StatImpactClient() {
  // Mobile tab
  const [tab, setTab] = useState<TabKey>("import");

  // Input mode
  const [mode, setMode] = useState<InputMode>("import");

  // Spec/profile inputs
  const [region, setRegion] = useState<Region>("us");
  const [spec, setSpec] = useState<SpecKey>("mage_fire" as SpecKey);
  const [contentType, setContentType] = useState<ContentType>("raid_st");

  // Realm list
  const [realms, setRealms] = useState<Realm[]>([]);
  const [realmsLoading, setRealmsLoading] = useState(false);
  const [realmsError, setRealmsError] = useState<string | null>(null);
  const [realmQuery, setRealmQuery] = useState("");
  const [selectedRealmSlug, setSelectedRealmSlug] = useState<string>("");

  // Character import
  const [name, setName] = useState<string>("maximum"); // test-friendly default
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [stats, setStats] = useState<CharacterStats | null>(null);

  // Manual rating inputs (strings so user can fully clear)
  const [manualCrit, setManualCrit] = useState<string>("");
  const [manualHaste, setManualHaste] = useState<string>("");
  const [manualMastery, setManualMastery] = useState<string>("");
  const [manualVers, setManualVers] = useState<string>("");

  // Load realms per region
  useEffect(() => {
    let cancelled = false;

    async function loadRealms() {
      setRealmsLoading(true);
      setRealmsError(null);

      try {
        const res = await fetch(`/api/wow-realms?region=${region}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.details || json?.error || `HTTP ${res.status}`);
        }

        const list: Realm[] = Array.isArray(json?.realms) ? json.realms : [];
        if (!cancelled) {
          setRealms(list);

          // Helpful default for fast testing
          if (!selectedRealmSlug) {
            const illidan = list.find((r) => r.slug === "illidan");
            if (illidan) {
              setSelectedRealmSlug("illidan");
              setRealmQuery("Illidan");
            }
          } else {
            if (!list.some((r) => r.slug === selectedRealmSlug)) {
              setSelectedRealmSlug("");
              setRealmQuery("");
            }
          }
        }
      } catch (e: any) {
        if (!cancelled) setRealmsError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setRealmsLoading(false);
      }
    }

    loadRealms();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  const selectedRealmName = useMemo(() => {
    const r = realms.find((x) => x.slug === selectedRealmSlug);
    return r?.name ?? "";
  }, [realms, selectedRealmSlug]);

  const filteredRealms = useMemo(() => {
    const q = realmQuery.trim().toLowerCase();
    if (!q) return realms.slice(0, 60);
    return realms
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q)
      )
      .slice(0, 60);
  }, [realmQuery, realms]);

  async function handleImport() {
    setImportError(null);
    setStats(null);

    const trimmedName = name.trim().toLowerCase();
    if (!selectedRealmSlug) {
      setImportError("Pick a realm first.");
      return;
    }
    if (!trimmedName) {
      setImportError("Enter a character name.");
      return;
    }

    setImporting(true);
    try {
      const url =
        `/api/wow-character-stats?region=${region}` +
        `&realmSlug=${encodeURIComponent(selectedRealmSlug)}` +
        `&name=${encodeURIComponent(trimmedName)}`;

      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok) {
        const details = String(json?.details || json?.error || "");
        if (res.status === 404 || details.includes("404")) {
          throw new Error(
            "Character not found (or profile is private). Double-check region/realm/name."
          );
        }
        throw new Error(details || `HTTP ${res.status}`);
      }

      setStats(json as CharacterStats);

      // If they imported, auto-switch mode to import and show results
      setMode("import");
      setTab("results");
    } catch (e: any) {
      setImportError(e?.message ?? String(e));
    } finally {
      setImporting(false);
    }
  }

  // Build the ratings source (import or manual)
  const ratingsSource = useMemo(() => {
    if (mode === "import" && stats) {
      return {
        crit: safe(stats.secondary.critRating),
        haste: safe(stats.secondary.hasteRating),
        mastery: safe(stats.secondary.masteryRating),
        vers: safe(stats.secondary.versatilityRating),
      } satisfies Record<StatKey, number>;
    }

    // Manual mode
    return {
      crit: parseRatingInput(manualCrit) ?? 0,
      haste: parseRatingInput(manualHaste) ?? 0,
      mastery: parseRatingInput(manualMastery) ?? 0,
      vers: parseRatingInput(manualVers) ?? 0,
    } satisfies Record<StatKey, number>;
  }, [mode, stats, manualCrit, manualHaste, manualMastery, manualVers]);

  const weights = useMemo(() => {
    // SPEC_DEFS[spec][contentType] should contain haste/crit/mastery/vers
    const w = (SPEC_DEFS as any)[spec]?.[contentType] as
      | Record<StatKey, number>
      | undefined;

    return (
      w ?? {
        crit: 1,
        haste: 1,
        mastery: 1,
        vers: 1,
      }
    );
  }, [spec, contentType]);

  const impact = useMemo(() => {
    // If in import mode but no stats yet, show null
    if (mode === "import" && !stats) return null;
    return computeImpactFromRatings(ratingsSource, weights);
  }, [mode, stats, ratingsSource, weights]);

  // Group specs for dropdown
  const groupedSpecs = useMemo(() => {
    const entries = Object.entries(SPEC_DEFS) as Array<[SpecKey, any]>;
    const groups = new Map<string, Array<{ key: SpecKey; label: string }>>();

    for (const [key, def] of entries) {
      const group = def.group ?? "Other";
      const label = def.label ?? String(key);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push({ key, label });
    }

    for (const [, arr] of groups)
      arr.sort((a, b) => a.label.localeCompare(b.label));
    return Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
  }, []);

  const Tabs = (
    <div className="flex w-full rounded-2xl border border-neutral-800 bg-neutral-950 p-1">
      <button
        type="button"
        onClick={() => setTab("import")}
        className={[
          "flex-1 rounded-xl px-3 py-2 text-sm transition",
          tab === "import"
            ? "bg-black text-white"
            : "text-neutral-300 hover:text-white",
        ].join(" ")}
      >
        Import
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

  const Disclaimer = (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="text-sm text-neutral-300">
        <span className="text-white font-semibold">Directional estimate</span> —
        not a full sim. Use this to decide what stat to prioritize next to
        improve DPS.
      </div>
      <div className="mt-1 text-xs text-neutral-500">
        Weights version: {WOW_STAT_WEIGHTS_VERSION}
      </div>
    </div>
  );

  const SharedProfileInputs = (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      {/* Region */}
      <div>
        <label className="text-xs text-neutral-400">Region</label>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value as Region)}
          className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
        >
          <option value="us">US</option>
          <option value="eu">EU</option>
          <option value="kr">KR</option>
          <option value="tw">TW</option>
        </select>
        <p className="mt-2 text-xs text-neutral-500">
          Region controls the realm list and Blizzard namespaces.
        </p>
      </div>

      {/* Content type */}
      <div>
        <label className="text-xs text-neutral-400">Content Type</label>
        <select
          value={contentType}
          onChange={(e) => setContentType(e.target.value as ContentType)}
          className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
        >
          <option value="raid_st">Raid (Single Target)</option>
          <option value="mplus_aoe">Mythic+ (AoE)</option>
        </select>
        <p className="mt-2 text-xs text-neutral-500">
          Changes the stat profile used for the estimate.
        </p>
      </div>

      {/* Spec */}
      <div className="md:col-span-2">
        <label className="text-xs text-neutral-400">Spec</label>
        <select
          value={spec}
          onChange={(e) => setSpec(e.target.value as SpecKey)}
          className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
        >
          {groupedSpecs.map(([group, specs]) => (
            <optgroup key={group} label={group}>
              {specs.map((s) => (
                <option key={s.key} value={s.key}>
                  {group} — {s.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-2 text-xs text-neutral-500">
          Full DPS spec list. Weights are directional.
        </p>
      </div>
    </div>
  );

  const ImportPanel = (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Import</div>
          <p className="mt-2 text-sm text-neutral-400">
            Import a character OR type ratings manually to play with the calc.
          </p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="mt-4">
        <div className="text-xs text-neutral-500">Mode</div>
        <div className="mt-2 inline-flex w-full rounded-2xl border border-neutral-800 bg-black p-1 sm:w-auto">
          <button
            type="button"
            onClick={() => setMode("import")}
            className={[
              "flex-1 rounded-xl px-3 py-2 text-sm transition sm:flex-none sm:px-3 sm:py-1.5",
              mode === "import"
                ? "bg-neutral-900 text-white"
                : "text-neutral-300 hover:text-white",
            ].join(" ")}
          >
            Import
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={[
              "flex-1 rounded-xl px-3 py-2 text-sm transition sm:flex-none sm:px-3 sm:py-1.5",
              mode === "manual"
                ? "bg-neutral-900 text-white"
                : "text-neutral-300 hover:text-white",
            ].join(" ")}
          >
            Manual
          </button>
        </div>
      </div>

      {SharedProfileInputs}

      {/* Import mode */}
      {mode === "import" && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Character name */}
          <div>
            <label className="text-xs text-neutral-400">Character name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., maximum"
              className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
            />
            <p className="mt-2 text-xs text-neutral-500">
              Exact spelling; lowercase is safest.
            </p>
          </div>

          {/* Realm search */}
          <div>
            <label className="text-xs text-neutral-400">Realm</label>
            <input
              value={realmQuery}
              onChange={(e) => setRealmQuery(e.target.value)}
              placeholder={
                realmsLoading
                  ? "Loading realms..."
                  : "Type realm (e.g., Illidan, Area 52)"
              }
              disabled={realmsLoading}
              className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600 disabled:opacity-60"
            />
            <div className="mt-2 text-xs text-neutral-500">
              Selected:{" "}
              <span className="text-neutral-300">
                {selectedRealmSlug
                  ? `${selectedRealmName} (${selectedRealmSlug})`
                  : "—"}
              </span>
            </div>

            <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-neutral-800 bg-black/20">
              {realmsError ? (
                <div className="p-3 text-sm text-red-300">{realmsError}</div>
              ) : filteredRealms.length === 0 ? (
                <div className="p-3 text-sm text-neutral-500">
                  No realms match.
                </div>
              ) : (
                filteredRealms.map((r) => (
                  <button
                    key={r.slug}
                    type="button"
                    onClick={() => {
                      setSelectedRealmSlug(r.slug);
                      setRealmQuery(r.name);
                    }}
                    className={[
                      "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition",
                      "hover:bg-white/10",
                      selectedRealmSlug === r.slug ? "bg-white/10" : "",
                    ].join(" ")}
                  >
                    <span>{r.name}</span>
                    <span className="text-xs text-neutral-500">{r.slug}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || realmsLoading}
                className="rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-white transition hover:border-neutral-600 disabled:opacity-60"
              >
                {importing ? "Importing..." : "Import Stats"}
              </button>

              
            </div>

            {importError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {importError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual mode */}
      {mode === "manual" && (
        <div className="mt-6">
          <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
            <div className="text-sm font-semibold">Manual Ratings</div>
            <p className="mt-1 text-xs text-neutral-500">
              Type ratings to test “what should I invest into next?” Import is
              optional.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["crit", manualCrit, setManualCrit],
                  ["haste", manualHaste, setManualHaste],
                  ["mastery", manualMastery, setManualMastery],
                  ["vers", manualVers, setManualVers],
                ] as Array<[StatKey, string, (v: string) => void]>
              ).map(([k, val, setVal]) => (
                <div
                  key={k}
                  className="rounded-xl border border-neutral-800 bg-black/30 p-3"
                >
                  <label className="text-xs text-neutral-400">
                    {statLabel(k)} rating
                  </label>
                  <input
                    inputMode="numeric"
                    value={val}
                    onChange={(e) => setVal(normalizeInputString(e.target.value))}
                    placeholder="e.g., 180"
                    className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
                  />
                  <div className="mt-2 text-xs text-neutral-500">
                    Current:{" "}
                    <span className="text-neutral-300">
                      {parseRatingInput(val) === null ? "—" : parseRatingInput(val)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setTab("results")}
                className="rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-white transition hover:border-neutral-600"
              >
                View Results
              </button>

              <button
                type="button"
                onClick={() => {
                  setManualCrit("");
                  setManualHaste("");
                  setManualMastery("");
                  setManualVers("");
                }}
                className="text-xs text-neutral-400 hover:text-white transition"
              >
                Clear manual inputs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const ResultsPanel = (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 space-y-6">
      <div>
        <div className="text-sm font-semibold">Results</div>
        <p className="mt-2 text-sm text-neutral-400">
          The main output is the <span className="text-white">Upgrade Priority</span>{" "}
          line — what to focus next for this spec + profile. (Approximate; not a full sim.)
        </p>
      </div>

      {!impact ? (
        <div className="rounded-xl border border-neutral-800 bg-black/20 p-4 text-sm text-neutral-500">
          {mode === "import"
            ? "Import a character to see results."
            : "Enter at least one rating to see results."}
        </div>
      ) : (
        <>
          {/* Summary bubble */}
          <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-xs text-neutral-400">Profile</div>
              <div className="text-xs text-neutral-500">
                {SPEC_DEFS[spec].group} — {SPEC_DEFS[spec].label} •{" "}
                {contentType === "raid_st" ? "Raid ST" : "Mythic+ AoE"}
              </div>
            </div>

            <div className="mt-2 text-lg font-bold">
              {mode === "import" ? (stats ? stats.name : "—") : "Manual ratings"}
            </div>

            <div className="mt-3 rounded-xl border border-neutral-800 bg-black/30 p-3">
              <div className="text-xs text-neutral-400">Upgrade Priority</div>
              <div className="mt-1 text-base font-semibold">
                {priorityLine(impact.entries)}
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                Focus the first stat when choosing upgrades (enchants/gems/items), then next, etc.
              </div>
            </div>
          </div>

          {/* Ratings display */}
          <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
            <div className="text-sm font-semibold">
              {mode === "import" ? "Imported Ratings" : "Entered Ratings"}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-neutral-800 bg-black/30 p-3">
                <div className="text-xs text-neutral-400">Crit</div>
                <div className="mt-1 text-lg font-bold">{fmtNumber(ratingsSource.crit)}</div>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-black/30 p-3">
                <div className="text-xs text-neutral-400">Haste</div>
                <div className="mt-1 text-lg font-bold">{fmtNumber(ratingsSource.haste)}</div>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-black/30 p-3">
                <div className="text-xs text-neutral-400">Mastery</div>
                <div className="mt-1 text-lg font-bold">{fmtNumber(ratingsSource.mastery)}</div>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-black/30 p-3">
                <div className="text-xs text-neutral-400">Versatility</div>
                <div className="mt-1 text-lg font-bold">{fmtNumber(ratingsSource.vers)}</div>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
            <div className="text-sm font-semibold">Priority Breakdown</div>
            <p className="mt-1 text-xs text-neutral-500">
              Scores are relative to the #1 stat (100). Uses normalized rating × weight.
            </p>

            <div className="mt-4 space-y-3">
              {impact.entries.map((e) => (
                <div
                  key={e.stat}
                  className="rounded-xl border border-neutral-800 bg-black/30 p-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm font-semibold">
                      {e.stat.toUpperCase()}
                      <span className="ml-2 text-xs text-neutral-500">
                        (weight {e.weight.toFixed(2)})
                      </span>
                    </div>
                    <div className="text-xs text-neutral-400">
                      Score: <span className="text-white">{e.score100.toFixed(0)}</span>
                    </div>
                  </div>

                  <div className="mt-2 h-2 w-full rounded-full bg-neutral-800">
                    <div
                      className="h-2 rounded-full bg-white/70"
                      style={{ width: `${Math.max(0, Math.min(100, e.score100))}%` }}
                    />
                  </div>

                  <div className="mt-2 text-xs text-neutral-500">
                    Rating: <span className="text-neutral-300">{Math.round(e.rating)}</span> •{" "}
                    Normalized units:{" "}
                    <span className="text-neutral-300">{e.value.toFixed(3)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Per 100 */}
          <div className="rounded-xl border border-neutral-800 bg-black/20 p-4">
            <div className="text-sm font-semibold">Per 100 Rating</div>
            <p className="mt-1 text-xs text-neutral-500">
              Directional “units” per +100 rating (weight × 100).
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {impact.per100.map((p) => (
                <div
                  key={p.stat}
                  className="flex items-center justify-between rounded-xl border border-neutral-800 bg-black/30 px-3 py-2"
                >
                  <span className="text-sm font-semibold">{p.stat.toUpperCase()}</span>
                  <span className="text-sm text-neutral-300">{p.units.toFixed(0)}u</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="relative space-y-6 pb-24">
      {Disclaimer}

      {/* Mobile tabs */}
      <div className="sm:hidden">{Tabs}</div>

      {/* Mobile: one tab at a time */}
      <div className="sm:hidden">{tab === "import" ? ImportPanel : ResultsPanel}</div>

      {/* Desktop: show Import + Results */}
      <div className="hidden sm:block space-y-6">
        {ImportPanel}
        {ResultsPanel}
      </div>

      {/* Sticky results footer (compact + chips) */}
      <div className="sticky bottom-3 z-20 sm:hidden">
        <div className="mx-auto max-w-5xl px-2">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/90 backdrop-blur ios-glass px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] text-neutral-500">Most important</div>
                <div className="mt-0.5 text-[14px] font-semibold leading-none text-white">
                  {impact ? impact.bestStat.toUpperCase() : "—"}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-neutral-500">Profile</div>
                <div className="mt-0.5 text-[10px] text-neutral-300">
                  {SPEC_DEFS[spec].group} — {SPEC_DEFS[spec].label}
                </div>
                <div className="mt-0.5 text-[10px] text-neutral-600">
                  {contentType === "raid_st" ? "Raid ST" : "Mythic+ AoE"}
                </div>
              </div>
            </div>

            <div className="mt-1">
              <div className="text-[10px] text-neutral-500">Upgrade priority</div>
              <div className="mt-0.5 text-[11px] font-medium text-neutral-200 break-words">
                {impact ? priorityLine(impact.entries) : "Import or enter ratings to see priority"}
              </div>
            </div>

            {/* Chips */}
            {impact && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-neutral-800 bg-black/30 px-2 py-[3px] text-[10px] text-neutral-300">
                  Crit <span className="text-white">{fmtNumber(ratingsSource.crit)}</span>
                </span>
                <span className="rounded-full border border-neutral-800 bg-black/30 px-2 py-[3px] text-[10px] text-neutral-300">
                  Haste <span className="text-white">{fmtNumber(ratingsSource.haste)}</span>
                </span>
                <span className="rounded-full border border-neutral-800 bg-black/30 px-2 py-[3px] text-[10px] text-neutral-300">
                  Mastery <span className="text-white">{fmtNumber(ratingsSource.mastery)}</span>
                </span>
                <span className="rounded-full border border-neutral-800 bg-black/30 px-2 py-[3px] text-[10px] text-neutral-300">
                  Vers <span className="text-white">{fmtNumber(ratingsSource.vers)}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
