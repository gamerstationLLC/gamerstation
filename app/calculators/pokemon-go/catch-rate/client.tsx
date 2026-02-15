"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PogoMon = {
  id: string;
  form: string; // canonical: `${id}_${FORM}` preferred (script should enforce)
  name: string;
  baseCaptureRate: number | null; // 0..1
  baseFleeRate: number | null; // 0..1
  type1?: string | null;
  type2?: string | null;
};

type CpRow = { level: number; cpm: number };

type MonsJson = { updatedAt: number; mons: PogoMon[] };
type CpmJson = { updatedAt: number; cp: CpRow[] };

const MEDAL_MULTIPLIERS: Record<string, number> = {
  None: 1.0,
  Bronze: 1.1,
  Silver: 1.2,
  Gold: 1.3,
  Platinum: 1.4,
};

const BALL_MULTIPLIERS: Record<string, number> = {
  "Poké Ball": 1.0,
  "Great Ball": 1.5,
  "Ultra Ball": 2.0,
};

const BERRY_MULTIPLIERS: Record<string, number> = {
  None: 1.0,
  Razz: 1.5,
  "Golden Razz": 2.5,
  "Silver Pinap": 1.8,
  Pinap: 1.0,
};

const THROW_MULTIPLIERS: Record<string, number> = {
  "No bonus": 1.0,
  Nice: 1.3,
  Great: 1.5,
  Excellent: 1.7,
};

function clamp01(x: number) {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function pct(x: number, digits = 2) {
  return `${(x * 100).toFixed(digits)}%`;
}

function formatUpdatedAt(ts: number | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "—";
  }
}

function pickCpm(level: number, cp: CpRow[]) {
  const target = Math.round(level * 2) / 2;
  let best = cp[0];
  let bestDist = Infinity;
  for (const row of cp) {
    const d = Math.abs(row.level - target);
    if (d < bestDist) {
      bestDist = d;
      best = row;
      if (d === 0) break;
    }
  }
  return best?.cpm ?? 0;
}

/**
 * Pokémon GO catch probability per throw:
 *   P = 1 - (1 - (BCR / (2*CPM))) ^ M
 * where M is the product of multipliers (ball, berry, throw, curve, medal).
 */
function catchChancePerThrow(bcr: number, cpm: number, multiplierM: number) {
  if (bcr <= 0 || cpm <= 0) return 0;

  const base = 1 - bcr / (2 * cpm);
  if (base <= 0) return 1;

  const p = 1 - Math.pow(base, multiplierM);
  return clamp01(p);
}

function cumulativeChance(pSingle: number, nThrows: number) {
  const n = Math.max(1, Math.floor(nThrows));
  const p = clamp01(pSingle);
  return 1 - Math.pow(1 - p, n);
}

function formLabel(id: string, form: string) {
  // display: remove leading `${id}_` if present
  const prefix = `${id}_`;
  const raw = form.startsWith(prefix) ? form.slice(prefix.length) : form;
  return raw || "NORMAL";
}

function typeLabel(t?: string | null) {
  if (!t) return "—";
  return t.replace("POKEMON_TYPE_", "");
}

const card =
  "rounded-2xl border border-white/10 bg-black/35 p-5 shadow-sm";
const cardTitle = "text-sm font-semibold text-white/80";
const subText = "text-xs text-white/55";
const input =
  "w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm outline-none placeholder:text-white/35 focus:border-white/25";
const select =
  "w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm outline-none focus:border-white/25";
const statBox =
  "rounded-xl border border-white/10 bg-black/45 px-3 py-2";

export default function CatchRateClient() {
  const [mons, setMons] = useState<PogoMon[] | null>(null);
  const [cp, setCp] = useState<CpRow[] | null>(null);
  const [updatedMons, setUpdatedMons] = useState<number | null>(null);
  const [updatedCp, setUpdatedCp] = useState<number | null>(null);

  const [q, setQ] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Inputs (feel similar to your other tool)
  const [level, setLevel] = useState(20);
  const [balls, setBalls] = useState(10);

  const [ball, setBall] = useState<keyof typeof BALL_MULTIPLIERS>("Ultra Ball");
  const [berry, setBerry] = useState<keyof typeof BERRY_MULTIPLIERS>("Golden Razz");
  const [throwBonus, setThrowBonus] = useState<keyof typeof THROW_MULTIPLIERS>("Great");
  const [isCurve, setIsCurve] = useState(true);

  const [medalType1, setMedalType1] = useState<keyof typeof MEDAL_MULTIPLIERS>("Platinum");
  const [medalType2, setMedalType2] = useState<keyof typeof MEDAL_MULTIPLIERS>("Platinum");

  const [preset, setPreset] = useState<"Raid" | "WB Raid" | "Research" | "Custom">("Raid");

  // Dropdown behavior
  const [isOpen, setIsOpen] = useState(false);
  const blurTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [monsRes, cpRes] = await Promise.all([
        fetch("/data/pogo/pokemon_encounter.json", { cache: "no-store" }),
        fetch("/data/pogo/cp_multiplier.json", { cache: "no-store" }),
      ]);

      if (!monsRes.ok) throw new Error("Failed to load pokemon_encounter.json");
      if (!cpRes.ok) throw new Error("Failed to load cp_multiplier.json");

      const monsJson = (await monsRes.json()) as MonsJson;
      const cpJson = (await cpRes.json()) as CpmJson;

      if (!mounted) return;
      setMons(monsJson.mons || []);
      setUpdatedMons(monsJson.updatedAt || null);
      setCp(cpJson.cp || []);
      setUpdatedCp(cpJson.updatedAt || null);
    }

    load().catch((e) => {
      console.error(e);
      if (!mounted) return;
      setMons([]);
      setCp([]);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (preset === "Custom") return;
    if (preset === "Raid") setLevel(20);
    if (preset === "WB Raid") setLevel(25);
    if (preset === "Research") setLevel(15);
  }, [preset]);

  useEffect(() => {
    if (!q.trim()) setIsOpen(false);
  }, [q]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    };
  }, []);

  function closeDropdownSoon() {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    blurTimerRef.current = window.setTimeout(() => setIsOpen(false), 120);
  }

  function cancelCloseDropdown() {
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  }

  const selected = useMemo(() => {
    if (!mons || !selectedKey) return null;
    return mons.find((m) => `${m.id}__${m.form}` === selectedKey) ?? null;
  }, [mons, selectedKey]);

  const filtered = useMemo(() => {
    if (!mons) return [];
    const query = q.trim().toLowerCase();
    if (!query) return [];

    const starts: PogoMon[] = [];
    const includes: PogoMon[] = [];

    for (const m of mons) {
      const label = `${m.name} ${formLabel(m.id, m.form)}`.toLowerCase();
      if (m.name.toLowerCase().startsWith(query)) starts.push(m);
      else if (label.includes(query) || m.id.toLowerCase().includes(query)) includes.push(m);
      if (starts.length + includes.length >= 16) break; // tighter list like your other UI
    }

    return [...starts, ...includes].slice(0, 16);
  }, [mons, q]);

  const cpm = useMemo(() => {
    if (!cp) return 0;
    return pickCpm(level, cp);
  }, [cp, level]);

  const medalMultiplier = useMemo(() => {
    const t1 = selected?.type1 ?? null;
    const t2 = selected?.type2 ?? null;

    const m1 = MEDAL_MULTIPLIERS[medalType1] ?? 1;
    const m2 = MEDAL_MULTIPLIERS[medalType2] ?? 1;

    // If dual-type, use average of the 2 medals (common convention)
    if (t1 && t2 && t1 !== t2) return (m1 + m2) / 2;
    return m1;
  }, [selected?.type1, selected?.type2, medalType1, medalType2]);

  const multiplierM = useMemo(() => {
    const ballM = BALL_MULTIPLIERS[ball] ?? 1;
    const berryM = BERRY_MULTIPLIERS[berry] ?? 1;
    const throwM = THROW_MULTIPLIERS[throwBonus] ?? 1;
    const curveM = isCurve ? 1.7 : 1.0;

    return ballM * berryM * throwM * curveM * medalMultiplier;
  }, [ball, berry, throwBonus, isCurve, medalMultiplier]);

  const perThrow = useMemo(() => {
    const bcr = selected?.baseCaptureRate;
    if (!selected || bcr == null || bcr <= 0 || !cpm) return null;
    return catchChancePerThrow(bcr, cpm, multiplierM);
  }, [selected, cpm, multiplierM]);

  const cumulative = useMemo(() => {
    if (perThrow == null) return null;
    return cumulativeChance(perThrow, balls);
  }, [perThrow, balls]);

  function onPick(m: PogoMon) {
    const key = `${m.id}__${m.form}`;
    setSelectedKey(key);
    setQ(m.name);
    setIsOpen(false);
    cancelCloseDropdown();
    setTimeout(() => inputRef.current?.blur(), 0);
  }

  const hasData = !!mons && !!cp;
  const showDropdown = hasData && isOpen && !!q.trim() && filtered.length > 0;

  const missingRates =
    selected && (selected.baseCaptureRate == null || selected.baseCaptureRate <= 0);

  const ballM = BALL_MULTIPLIERS[ball] ?? 1;
  const berryM = BERRY_MULTIPLIERS[berry] ?? 1;
  const throwM = THROW_MULTIPLIERS[throwBonus] ?? 1;
  const curveM = isCurve ? 1.7 : 1.0;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
      {/* Inputs */}
      <section className={`md:col-span-6 ${card}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className={cardTitle}>Inputs</div>
            <div className={subText}>
              Data: Pokémon {formatUpdatedAt(updatedMons)} · CPM {formatUpdatedAt(updatedCp)}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <PresetButton
              active={preset === "Raid"}
              onClick={() => setPreset("Raid")}
              label="Raid / GBL (L20)"
            />
            <PresetButton
              active={preset === "WB Raid"}
              onClick={() => setPreset("WB Raid")}
              label="Weather Raid (L25)"
            />
            <PresetButton
              active={preset === "Research"}
              onClick={() => setPreset("Research")}
              label="Research (L15)"
            />
            <PresetButton
              active={preset === "Custom"}
              onClick={() => setPreset("Custom")}
              label="Custom"
            />
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {/* Pokemon search */}
          <div className="relative">
            <label className="mb-1 block text-xs font-semibold text-white/70">
              Pokémon
            </label>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => {
                cancelCloseDropdown();
                if (q.trim()) setIsOpen(true);
              }}
              onBlur={() => closeDropdownSoon()}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsOpen(false);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder={hasData ? "Search (e.g., Pikachu)" : "Loading…"}
              className={input}
            />

            {showDropdown && (
              <div
                className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-black/95 shadow-xl"
                onMouseDown={() => cancelCloseDropdown()}
              >
                {filtered.map((m) => {
                  const key = `${m.id}__${m.form}`;
                  const active = key === selectedKey;
                  const fLabel = formLabel(m.id, m.form);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onPick(m)}
                      className={[
                        "flex w-full items-center justify-between px-3 py-2 text-left text-sm",
                        "hover:bg-white/5",
                        active ? "bg-white/10" : "",
                      ].join(" ")}
                    >
                      <span className="font-semibold">{m.name}</span>
                      <span className="text-xs text-white/60">{fLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-2 text-xs text-white/45">
              Ruleset: Pokémon GO · Model uses BCR + CPM
            </div>
          </div>

          {/* Level */}
          <div>
            <div className="flex items-end justify-between gap-3">
              <label className="block text-xs font-semibold text-white/70">
                Pokémon Level (CPM)
              </label>
              <div className="text-xs text-white/55">
                CPM: {cpm ? cpm.toFixed(6) : "—"}
              </div>
            </div>

            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={50}
                step={0.5}
                value={level}
                onChange={(e) => {
                  setPreset("Custom");
                  setLevel(parseFloat(e.target.value));
                }}
                className="w-full"
              />
              <div className="min-w-[70px] rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-center text-sm font-bold">
                {level.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Status row style: two columns like your other tool */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-white/70">
                Balls (for cumulative)
              </label>
              <input
                type="number"
                min={1}
                max={999}
                value={balls}
                onChange={(e) => setBalls(parseInt(e.target.value || "1", 10))}
                className={input}
              />
              <div className="mt-2 text-xs text-white/45">
                Uses: 1 − (1 − P)^n
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/45 p-3">
              <div className="text-xs font-semibold text-white/70">Curveball</div>
              <button
                type="button"
                onClick={() => setIsCurve((s) => !s)}
                className={[
                  "mt-2 w-full rounded-xl px-3 py-2 text-sm font-bold transition",
                  isCurve
                    ? "bg-white text-black"
                    : "bg-white/10 text-white hover:bg-white/15",
                ].join(" ")}
              >
                {isCurve ? "On (×1.7)" : "Off (×1.0)"}
              </button>
              <div className="mt-2 text-xs text-white/45">
                Curve is a multiplier in this model.
              </div>
            </div>
          </div>

          {/* Ball / Berry */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-white/70">
                Ball
              </label>
              <select
                value={ball}
                onChange={(e) => setBall(e.target.value as any)}
                className={select}
              >
                {Object.keys(BALL_MULTIPLIERS).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-white/70">
                Berry
              </label>
              <select
                value={berry}
                onChange={(e) => setBerry(e.target.value as any)}
                className={select}
              >
                {Object.keys(BERRY_MULTIPLIERS).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Throw + Medals */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-white/70">
                Throw Bonus
              </label>
              <select
                value={throwBonus}
                onChange={(e) => setThrowBonus(e.target.value as any)}
                className={select}
              >
                {Object.keys(THROW_MULTIPLIERS).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-white/70">
                Type Medals (auto uses selected mon types)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={medalType1}
                  onChange={(e) => setMedalType1(e.target.value as any)}
                  className={select}
                >
                  {Object.keys(MEDAL_MULTIPLIERS).map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <select
                  value={medalType2}
                  onChange={(e) => setMedalType2(e.target.value as any)}
                  className={select}
                >
                  {Object.keys(MEDAL_MULTIPLIERS).map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Summary row like your tool */}
          <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className={statBox}>
              <div className="text-[11px] font-semibold text-white/55">Ball</div>
              <div className="text-sm font-black text-white">×{ballM.toFixed(2)}</div>
            </div>
            <div className={statBox}>
              <div className="text-[11px] font-semibold text-white/55">Berry</div>
              <div className="text-sm font-black text-white">×{berryM.toFixed(2)}</div>
            </div>
            <div className={statBox}>
              <div className="text-[11px] font-semibold text-white/55">Throw</div>
              <div className="text-sm font-black text-white">×{throwM.toFixed(2)}</div>
            </div>
            <div className={statBox}>
              <div className="text-[11px] font-semibold text-white/55">Curve</div>
              <div className="text-sm font-black text-white">×{curveM.toFixed(2)}</div>
            </div>
            <div className={statBox}>
              <div className="text-[11px] font-semibold text-white/55">Medal</div>
              <div className="text-sm font-black text-white">×{medalMultiplier.toFixed(2)}</div>
            </div>
            <div className={statBox}>
              <div className="text-[11px] font-semibold text-white/55">Total M</div>
              <div className="text-sm font-black text-white">{multiplierM.toFixed(3)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className={`md:col-span-6 ${card}`}>
        <div className={cardTitle}>Results</div>
        <div className="mt-2 text-xs text-white/55">
          {selected ? "Catch odds for your current inputs." : "Select a Pokémon to see results."}
        </div>

        {!selected ? (
          <div className="mt-6 rounded-xl border border-white/10 bg-black/45 p-4 text-sm text-white/70">
            Select a Pokémon to see results.
          </div>
        ) : missingRates ? (
          <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            Missing base capture rate for this entry in your dataset.
            Re-run your build script and make sure it’s using a modern GM file with encounter rates.
          </div>
        ) : (
          <>
            {/* Selected summary */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/45 p-5">
              <div className="text-lg font-black">{selected.name}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-white/70">
                <div className="rounded-xl border border-white/10 bg-black/50 px-3 py-2">
                  <div className="text-[11px] font-semibold text-white/55">Form</div>
                  <div className="text-sm font-black text-white">
                    {formLabel(selected.id, selected.form)}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/50 px-3 py-2">
                  <div className="text-[11px] font-semibold text-white/55">Type</div>
                  <div className="text-sm font-black text-white">
                    {typeLabel(selected.type1)}
                    {selected.type2 ? ` / ${typeLabel(selected.type2)}` : ""}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/50 px-3 py-2">
                  <div className="text-[11px] font-semibold text-white/55">Base Capture Rate</div>
                  <div className="text-sm font-black text-white">
                    {selected.baseCaptureRate != null ? pct(selected.baseCaptureRate, 2) : "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/50 px-3 py-2">
                  <div className="text-[11px] font-semibold text-white/55">Base Flee Rate</div>
                  <div className="text-sm font-black text-white">
                    {selected.baseFleeRate != null ? pct(selected.baseFleeRate, 2) : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Big results */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <ResultCard
                title="Catch chance (per throw)"
                big={perThrow != null ? pct(perThrow, 2) : "—"}
                sub={
                  perThrow != null
                    ? `Level ${level.toFixed(1)} (CPM ${cpm.toFixed(6)})`
                    : "—"
                }
              />
              <ResultCard
                title={`Catch chance within ${Math.max(1, Math.floor(balls))} balls`}
                big={cumulative != null ? pct(cumulative, 2) : "—"}
                sub={cumulative != null ? "Assuming identical throws" : "—"}
              />
            </div>

            {/* Formula footer */}
            <div className="mt-6 rounded-xl border border-white/10 bg-black/45 p-4 text-xs text-white/60">
              Model: P = 1 − (1 − BCR/(2×CPM))^M, where M is the product of your bonuses.
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function PresetButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl px-3 py-2 text-xs font-bold transition",
        active
          ? "bg-white text-black"
          : "bg-white/10 text-white hover:bg-white/15",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function ResultCard({
  title,
  big,
  sub,
}: {
  title: string;
  big: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/45 p-5">
      <div className="text-xs font-semibold text-white/70">{title}</div>
      <div className="mt-2 text-4xl font-black tracking-tight text-white">{big}</div>
      <div className="mt-2 text-xs text-white/60">{sub}</div>
    </div>
  );
}
