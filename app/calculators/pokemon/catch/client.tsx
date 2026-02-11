// app/calculators/pokemon/catch/client.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeCatchChance,
  type RulesetKey,
  type StatusKey as MathStatusKey,
  type BallKey as MathBallKey,
} from "./catchMath";
import type { GameDef } from "./page";

type MonRow = {
  id: number;
  name?: string;
  slug?: string;
  displayName?: string;
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

function monDisplayName(m: MonRow) {
  const dn = (m.displayName || "").trim();
  if (dn) return dn;

  const n = (m.name || "").trim();
  if (n) return titleCase(n);

  const sl = (m.slug || "").trim();
  if (sl) return titleCase(sl);

  return `#${m.id}`;
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
 * ✅ Preferred: `games.json` should include `byGameFile` and we use that.
 * Fallback alias map kept for safety.
 */
const BY_GAME_ALIAS: Record<string, string> = {
  // gen 9
  sv: "sv",
  scarletviolet: "sv",
  "scarlet-violet": "sv",
  "scarlet / violet": "sv",
  "scarlet & violet": "sv",

  // gen 8
  swsh: "swsh",
  swordshield: "swsh",
  "sword-shield": "swsh",
  "sword / shield": "swsh",

  // let's go (if you use it)
  lgpe: "lgpe",
  letsgo: "lgpe",
  letsgopikachueevee: "lgpe",
  "let's go pikachu / eevee": "lgpe",
};

function candidateByGameKeys(gameKey: string, label?: string, explicit?: string) {
  const out: string[] = [];

  const norm = (s: string) => String(s || "").trim().toLowerCase();

  const alnum = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "");
  const hyphen = (s: string) =>
    norm(s)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

  const push = (x?: string) => {
    const v = norm(x || "");
    if (v && !out.includes(v)) out.push(v);
  };

  // 1) explicit from games.json (best)
  if (explicit) push(explicit);

  // 2) alias from explicit/gameKey/label
  const tryAlias = (s?: string) => {
    if (!s) return;
    const n = norm(s);
    const a1 = BY_GAME_ALIAS[n];
    if (a1) push(a1);

    const a2 = BY_GAME_ALIAS[alnum(s)];
    if (a2) push(a2);

    const a3 = BY_GAME_ALIAS[hyphen(s)];
    if (a3) push(a3);
  };

  tryAlias(explicit);
  tryAlias(gameKey);
  tryAlias(label);

  // 3) raw stems to try (alnum + hyphen)
  const addStems = (s?: string) => {
    if (!s) return;
    push(alnum(s));
    push(hyphen(s));
  };

  addStems(explicit);
  addStems(gameKey);
  addStems(label);

  return Array.from(new Set(out)).filter(Boolean);
}

/**
 * If older blobs are missing displayName, synthesize it here so dropdown never shows bare numbers.
 */
function normalizeMons(rows: MonRow[]): MonRow[] {
  return (Array.isArray(rows) ? rows : [])
    .filter((m) => m && typeof m.id === "number")
    .map((m) => {
      const name = (m.name || m.slug || "").trim();
      const displayName = (m.displayName || "").trim() || (name ? titleCase(name) : "");
      return {
        ...m,
        name: m.name || (name || undefined),
        slug: m.slug || (name || undefined),
        displayName: displayName || undefined,
      };
    })
    .sort((a, b) => a.id - b.id);
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
    "rounded-2xl border border-neutral-800 bg-black/[.7] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]";

  const effectiveTurn = useMemo(() => {
    if (ball === "quick") return 1;
    if (ball === "timer") return 10;
    return 1;
  }, [ball]);

  async function loadMons(forGameKey: string) {
    setLoadingMons(true);
    setError("");

    const g = games.find((x) => x.gameKey === forGameKey) || null;

    const candidates = candidateByGameKeys(forGameKey, g?.label, (g as any)?.byGameFile);

    let lastErr: unknown = null;

    try {
      for (const key of candidates) {
        const rel = `data/pokemon/by_game/${key}.json`;
        const url = resolveDataUrl(rel);

        try {
          const data = await fetchJson<MonRow[]>(url);
          const arr = normalizeMons(data);
          setMons(arr);
          setMonId("");
          return arr;
        } catch (e) {
          lastErr = e;
        }
      }

      const msg =
        (lastErr && (lastErr as any).message) || `Failed to load by_game JSON for "${forGameKey}"`;

      setMons([]);
      setMonId("");
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

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    (async () => {
      if (!games.length) return;

      if (gameKey) {
        try {
          await loadMons(gameKey);
          return;
        } catch {}
      }

      for (const gg of games) {
        try {
          await loadMons(gg.gameKey);
          setGameKey(gg.gameKey);
          return;
        } catch {}
      }

      setError("No by_game JSON found for any configured game.");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games]);

  useEffect(() => {
    if (!didInit.current) return;
    if (!gameKey) return;
    loadMons(gameKey).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameKey]);

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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className={card}>
        <div className="mb-4 text-sm font-semibold text-neutral-200">Inputs</div>

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
            {mons.map((m) => (
              <option key={m.id} value={m.id}>
                #{m.id} · {monDisplayName(m)}
              </option>
            ))}
          </select>

          {error ? (
            <div className="mt-2 whitespace-pre-wrap text-xs text-red-400">{error}</div>
          ) : null}
        </div>

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
                  alt={monDisplayName(selectedMon)}
                  className="h-20 w-20 rounded-xl border border-neutral-800 bg-neutral-950 object-contain"
                  loading="lazy"
                />
              ) : (
                <div className="h-20 w-20 rounded-xl border border-neutral-800 bg-neutral-950" />
              )}

              <div>
                <div className="text-lg font-black tracking-tight">
                  #{selectedMon.id} · {monDisplayName(selectedMon)}
                </div>
                <div className="mt-1 text-xs text-neutral-400">
                  Base catch rate: <span className="text-neutral-200">{selectedMon.capture_rate}</span>
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
              Powered by <span className="text-neutral-300">catchMath.ts</span>.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
