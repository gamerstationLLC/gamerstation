"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeCatchChance,
  type RulesetKey,
  type StatusKey as MathStatusKey,
  type BallKey as MathBallKey,
} from "./catchMath";

type GameDef = {
  gameKey: string; // ✅ MUST match by_game filename stem (sv, bdsp, hgss, dp, frlg, etc)
  label: string;
  versionName: string;
  versionGroup: string;
  generation: string;
  pokedex: string;
  rulesetKey: string; // gen1 / gen2 / gen34 / gen5plus / letsgo / pla ...
};

type MonRow = {
  id: number;
  name?: any; // may come in as number/string/etc depending on how JSON was generated
  slug?: any;
  displayName?: any;
  capture_rate: number;
  base_stats?: {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
  };
  sprite?: string;
};

type StatusKey = "none" | "paralysis" | "poison" | "burn" | "sleep" | "freeze";

type BallKey =
  | "poke"
  | "great"
  | "ultra"
  | "master"
  | "premier"
  | "luxury"
  | "quick"
  | "dusk"
  | "repeat"
  | "timer"
  | "nest"
  | "net"
  | "dive";

const STATUS_LABEL: Record<StatusKey, string> = {
  none: "None",
  paralysis: "Paralysis",
  poison: "Poison",
  burn: "Burn",
  sleep: "Sleep",
  freeze: "Freeze",
};

const BALL_LABEL: Record<BallKey, string> = {
  poke: "Poké Ball",
  great: "Great Ball",
  ultra: "Ultra Ball",
  master: "Master Ball",
  premier: "Premier Ball",
  luxury: "Luxury Ball",
  quick: "Quick Ball",
  dusk: "Dusk Ball",
  repeat: "Repeat Ball",
  timer: "Timer Ball",
  nest: "Nest Ball",
  net: "Net Ball",
  dive: "Dive Ball",
};

function fmtPct(x: number) {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(2)}%`;
}

function titleCase(s: string) {
  return (s || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

function getBlobBase(): string {
  const env = (process.env.NEXT_PUBLIC_BLOB_BASE_URL || "").trim();
  return env.replace(/\/+$/, "");
}

function resolveDataUrl(relPath: string) {
  const base = getBlobBase();
  if (base) return `${base}/${relPath.replace(/^\/+/, "")}`;
  return `/${relPath.replace(/^\/+/, "")}`;
}

function normalizeRulesetKey(k?: string | null): RulesetKey {
  const v = (k || "").trim();
  if (
    v === "gen1" ||
    v === "gen2" ||
    v === "gen34" ||
    v === "gen5plus" ||
    v === "letsgo" ||
    v === "pla"
  )
    return v;
  return "gen5plus";
}

/**
 * Some builds accidentally put numeric IDs into name fields.
 * This normalizes "name"/"slug"/"displayName" into a usable string if possible.
 */
function coerceName(v: any): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return ""; // treat pure numbers as "no name"
  return "";
}

function normalizeSlug(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function monDisplayName(m: MonRow, idToName?: Record<string, string>) {
  // 1) Prefer explicit displayName
  const dn = coerceName(m.displayName);
  if (dn) return dn;

  // 2) If "name" looks like a real name (not a number), use it
  const n = coerceName(m.name);
  if (n) return titleCase(n);

  // 3) If we have an id->name map, use it
  const mapped = idToName?.[String(m.id)];
  if (mapped) return mapped;

  // 4) Fallback to slug if present
  const sl = coerceName(m.slug);
  if (sl) return titleCase(sl);

  // 5) Final fallback
  return `#${m.id}`;
}

/**
 * Try to load a local name index first (from your blob/disk),
 * then fallback to PokeAPI *only for the currently selected mon* if needed.
 *
 * If you later add a canonical file, either of these will work automatically:
 * - data/pokemon/pokemon_names.json  (preferred)
 * - data/pokemon/names.json
 *
 * Expected shape examples:
 * 1) { "1": "Bulbasaur", "2": "Ivysaur", ... }
 * 2) [ { "id": 1, "name": "Bulbasaur" }, ... ]
 */
async function tryLoadNameIndex(): Promise<Record<string, string>> {
  const candidates = [
    "data/pokemon/pokemon_names.json",
    "data/pokemon/names.json",
  ];

  for (const rel of candidates) {
    const url = resolveDataUrl(rel);
    try {
      const data = await fetchJson<any>(url);

      // object map form
      if (data && typeof data === "object" && !Array.isArray(data)) {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(data)) {
          const s = typeof v === "string" ? v.trim() : "";
          if (s) out[String(k)] = s;
        }
        if (Object.keys(out).length) return out;
      }

      // array form
      if (Array.isArray(data)) {
        const out: Record<string, string> = {};
        for (const row of data) {
          const id = row?.id;
          const name = row?.name;
          if (Number.isFinite(id) && typeof name === "string" && name.trim()) {
            out[String(id)] = name.trim();
          }
        }
        if (Object.keys(out).length) return out;
      }
    } catch {
      // try next
    }
  }

  return {};
}

/**
 * Minimal PokeAPI fallback:
 * only used when a mon is selected and we still don't have a name.
 * (Avoids hammering the network for the entire dropdown.)
 */
async function fetchPokeApiNameById(id: number): Promise<string> {
  const url = `https://pokeapi.co/api/v2/pokemon-species/${id}/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const json = (await res.json()) as any;
  const name = typeof json?.name === "string" ? json.name.trim() : "";
  return name ? titleCase(name) : "";
}

export default function PokemonCatchCalcClient(props: { games: GameDef[] }) {
  const games = props.games || [];

  const [gameKey, setGameKey] = useState<string>(games[0]?.gameKey || "");
  const [mons, setMons] = useState<MonRow[]>([]);
  const [monId, setMonId] = useState<number | "">("");

  const [hpPctRemaining, setHpPctRemaining] = useState<number>(1);
  const [status, setStatus] = useState<StatusKey>("none");
  const [ball, setBall] = useState<BallKey>("ultra");

  const [loadingMons, setLoadingMons] = useState(false);
  const [error, setError] = useState<string>("");

  // ✅ name helpers
  const [idToName, setIdToName] = useState<Record<string, string>>({});
  const [selectedNameOverride, setSelectedNameOverride] = useState<string>("");

  const didInit = useRef(false);

  const selectedGame = useMemo(
    () => games.find((g) => g.gameKey === gameKey) || null,
    [games, gameKey]
  );

  const selectedMon = useMemo(
    () => mons.find((m) => m.id === monId) || null,
    [mons, monId]
  );

  const card =
    "rounded-2xl border border-neutral-800 bg-black p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]";

  /**
   * Turn removed:
   * - Quick Ball: assume Turn 1 (best-case)
   * - Timer Ball: assume Turn 10 (mid-fight)
   */
  const effectiveTurn = useMemo(() => {
    if (ball === "quick") return 1;
    if (ball === "timer") return 10;
    return 1;
  }, [ball]);

  /**
   * ✅ Load mons for a game.
   *
   * IMPORTANT CHANGE:
   * We always attempt the EXACT key you uploaded: data/pokemon/by_game/${gameKey}.json
   * This matches your blobs: bw.json, bw2.json, hgss.json, dp.json, frlg.json, sv.json, bdsp.json, etc.
   *
   * We keep a small fallback: if someone’s games.json has older keys, we try a normalized slug too.
   */
  async function loadMons(forGameKey: string) {
    setLoadingMons(true);
    setError("");

    const g = games.find((x) => x.gameKey === forGameKey) || null;

    const exactStem = String(forGameKey || "").trim();
    const fallbackStem = g?.label ? normalizeSlug(g.label).replace(/-/g, "") : "";

    const candidates = Array.from(
      new Set([exactStem, fallbackStem].filter(Boolean))
    );

    let lastErr: any = null;

    try {
      for (const stem of candidates) {
        const rel = `data/pokemon/by_game/${stem}.json`;
        const url = resolveDataUrl(rel);

        try {
          const data = await fetchJson<MonRow[]>(url);
          const arr = Array.isArray(data) ? data : [];
          setMons(arr);
          setMonId("");
          setSelectedNameOverride("");
          return arr;
        } catch (e) {
          lastErr = e;
        }
      }

      const msg =
        (lastErr && (lastErr as any).message) ||
        `Failed to load by_game JSON for "${forGameKey}"`;

      setMons([]);
      setMonId("");
      setSelectedNameOverride("");
      setError(
        `${msg}\nTried: ${candidates
          .map((s) => `data/pokemon/by_game/${s}.json`)
          .join(", ")}`
      );
      throw lastErr || new Error(msg);
    } finally {
      setLoadingMons(false);
    }
  }

  /**
   * ✅ First mount:
   * 1) Load name index if you have it (optional)
   * 2) Load mons for initial game (and probe if needed)
   */
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    (async () => {
      if (!games.length) return;

      // 1) Try to load an id->name index (if you add one later, it just works)
      try {
        const map = await tryLoadNameIndex();
        if (map && Object.keys(map).length) setIdToName(map);
      } catch {
        // ignore
      }

      // 2) Try current gameKey first
      if (gameKey) {
        try {
          await loadMons(gameKey);
          return;
        } catch {
          // continue probing
        }
      }

      // 3) Probe games until one loads
      for (const gg of games) {
        try {
          await loadMons(gg.gameKey);
          setGameKey(gg.gameKey);
          return;
        } catch {
          // keep going
        }
      }

      setError("No by_game JSON found for any configured game.");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games]);

  /**
   * Game changes:
   */
  useEffect(() => {
    if (!didInit.current) return;
    if (!gameKey) return;
    loadMons(gameKey).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameKey]);

  /**
   * Selected mon name fallback:
   * If the dropdown items look like numbers (no name fields), we fetch ONLY the selected mon’s name.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setSelectedNameOverride("");

      if (!selectedMon || !Number.isFinite(selectedMon.id)) return;

      // If we already have a usable name, no need to fetch
      const dn = coerceName(selectedMon.displayName);
      const n = coerceName(selectedMon.name);
      const sl = coerceName(selectedMon.slug);
      const mapped = idToName[String(selectedMon.id)];

      if (dn || n || sl || mapped) return;

      try {
        const apiName = await fetchPokeApiNameById(selectedMon.id);
        if (!cancelled && apiName) setSelectedNameOverride(apiName);
      } catch {
        // ignore; we’ll just show #id
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedMon, idToName]);

  const chance = useMemo(() => {
    if (!selectedMon) return NaN;

    const rulesetKey = normalizeRulesetKey(selectedGame?.rulesetKey);

    return computeCatchChance({
      rulesetKey,
      captureRate: selectedMon.capture_rate,
      hpPctRemaining,
      ball: ball as unknown as MathBallKey,
      status: status as unknown as MathStatusKey,
      turn: effectiveTurn,
    });
  }, [selectedMon, selectedGame, ball, status, hpPctRemaining, effectiveTurn]);

  const expectedThrows = useMemo(() => {
    if (!Number.isFinite(chance) || chance <= 0) return Infinity;
    return 1 / chance;
  }, [chance]);

  const selectedMonName = useMemo(() => {
    if (!selectedMon) return "";
    if (selectedNameOverride) return selectedNameOverride;
    return monDisplayName(selectedMon, idToName);
  }, [selectedMon, idToName, selectedNameOverride]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Inputs */}
      <section className={card}>
        <div className="mb-4 text-sm font-semibold text-neutral-200">Inputs</div>

        {/* Game */}
        <label className="block text-xs text-neutral-400">Game</label>
        <select
          className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
          value={gameKey}
          onChange={(e) => setGameKey(e.target.value)}
        >
          {games.map((g) => (
            <option key={g.gameKey} value={g.gameKey}>
              {g.label}
            </option>
          ))}
        </select>

        <div className="mt-2 text-xs text-neutral-500">
          Ruleset: <span className="text-neutral-300">{selectedGame?.rulesetKey || "—"}</span>{" "}
          <span className="text-neutral-700">·</span>{" "}
          Dex: <span className="text-neutral-300">{selectedGame?.pokedex || "—"}</span>
        </div>

        {/* Pokémon */}
        <div className="mt-5">
          <label className="block text-xs text-neutral-400">Pokémon</label>
          <select
            className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600 disabled:opacity-60"
            value={monId}
            disabled={loadingMons || mons.length === 0}
            onChange={(e) => {
              const v = e.target.value;
              setMonId(v ? Number(v) : "");
            }}
          >
            <option value="">
              {loadingMons ? "Loading…" : mons.length ? "Select a Pokémon…" : "No Pokémon loaded"}
            </option>
            {mons.map((m) => {
              const name = monDisplayName(m, idToName);
              return (
                <option key={m.id} value={m.id}>
                  {name.startsWith("#") ? `#${m.id}` : `#${m.id} · ${name}`}
                </option>
              );
            })}
          </select>

          {error ? (
            <div className="mt-2 whitespace-pre-wrap text-xs text-red-400">{error}</div>
          ) : null}
        </div>

        {/* Battle state */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-xs text-neutral-400">
              HP Remaining ({Math.round(hpPctRemaining * 100)}%)
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(hpPctRemaining * 100)}
              onChange={(e) => setHpPctRemaining(Number(e.target.value) / 100)}
              className="mt-2 w-full"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-400">Status</label>
            <select
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusKey)}
            >
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-neutral-400">Ball</label>
            <select
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
              value={ball}
              onChange={(e) => setBall(e.target.value as BallKey)}
            >
              {Object.entries(BALL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>

            {ball === "quick" ? (
              <div className="mt-2 text-[11px] text-neutral-500">
                Quick Ball assumes Turn 1 (best-case).
              </div>
            ) : null}
            {ball === "timer" ? (
              <div className="mt-2 text-[11px] text-neutral-500">
                Timer Ball assumes ~Turn 10 (mid-fight).
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 text-xs text-neutral-600">
          Turn input removed (doesn’t affect most balls). Quick/Timer use safe defaults for now.
        </div>
      </section>

      {/* Results */}
      <section className={card}>
        <div className="mb-4 text-sm font-semibold text-neutral-200">Results</div>

        {!selectedMon ? (
          <div className="text-sm text-neutral-400">Select a Pokémon to see results.</div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              {selectedMon.sprite ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedMon.sprite}
                  alt={selectedMonName}
                  className="h-20 w-20 rounded-xl border border-neutral-800 bg-neutral-950 object-contain"
                  loading="lazy"
                />
              ) : (
                <div className="h-20 w-20 rounded-xl border border-neutral-800 bg-neutral-950" />
              )}

              <div>
                <div className="text-lg font-black tracking-tight">
                  #{selectedMon.id} · {selectedMonName}
                </div>
                <div className="mt-1 text-xs text-neutral-400">
                  Base catch rate:{" "}
                  <span className="text-neutral-200">{selectedMon.capture_rate}</span>
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  Catch chance: <span className="text-neutral-200">{fmtPct(chance)}</span>
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  Expected throws:{" "}
                  <span className="text-neutral-200">
                    {Number.isFinite(expectedThrows) ? expectedThrows.toFixed(2) : "∞"}
                  </span>
                </div>
              </div>
            </div>

            {selectedMon.base_stats ? (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
                <div className="mb-2 text-xs font-semibold text-neutral-300">Base Stats</div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  {(
                    [
                      ["HP", selectedMon.base_stats.hp],
                      ["ATK", selectedMon.base_stats.atk],
                      ["DEF", selectedMon.base_stats.def],
                      ["SpA", selectedMon.base_stats.spa],
                      ["SpD", selectedMon.base_stats.spd],
                      ["SPE", selectedMon.base_stats.spe],
                    ] as const
                  ).map(([label, val]) => (
                    <div key={label} className="rounded-xl border border-neutral-800 bg-black p-3">
                      <div className="text-xs text-neutral-500">{label}</div>
                      <div className="font-semibold">{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="text-xs text-neutral-600">
              Powered by <span className="text-neutral-300">catchMath.ts</span> (Gen 3+ shake-check probability; rulesets
              can be refined later via <span className="text-neutral-300">rulesetKey</span>).
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
