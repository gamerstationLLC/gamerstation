"use client";

import { useEffect, useMemo, useState } from "react";

type MetaMode = "ranked" | "casual";
type Role = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";
type RoleFilter = "ALL" | Role;

type ChampionRow = {
  key: string; // ddragon numeric string e.g. "266"
  id: string; // "Aatrox"
  name: string;
  title?: string;
};

type MetaRoleEntry = {
  boots: number | null;
  core: number[];
  items?: number[]; // optional, some scripts include it
  summoners?: number[];
  runesSig?: string;

  games: number;
  wins: number;
  winrate: number; // 0..1
  score: number;
  buildSig: string;
  lowSample?: boolean;
};

// ✅ IMPORTANT: role value is an ARRAY of builds (top N)
type MetaJson = {
  generatedAt: string;
  queues: number[];
  useTimeline: boolean;
  patchMajorMinorOnly: boolean;
  minSample: number;
  minDisplaySample: number;
  bayesK: number;
  priorWinrate: number;
  patches: Record<string, Record<string, Partial<Record<Role, MetaRoleEntry[]>>>>;
};

type ItemsDdragon = {
  version?: string;
  data?: Record<
    string,
    { name?: string; plaintext?: string; image?: { full?: string }; tags?: string[] }
  >;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function toPatchNum(p: string) {
  const [a, b] = String(p).split(".");
  return Number(a || 0) * 1000 + Number(b || 0);
}

function formatPct(x: number) {
  if (!Number.isFinite(x)) return "—";
  return `${Math.round(x * 100)}%`;
}

function shortRole(r: Role) {
  if (r === "JUNGLE") return "Jg";
  if (r === "MIDDLE") return "Mid";
  if (r === "BOTTOM") return "Bot";
  if (r === "UTILITY") return "Sup";
  return "Top";
}

function readModeFromUrl(): MetaMode {
  if (typeof window === "undefined") return "ranked";
  const p = new URLSearchParams(window.location.search);
  return p.get("mode") === "casual" ? "casual" : "ranked";
}

function pushModeToUrl(mode: MetaMode) {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  u.searchParams.set("mode", mode);
  window.history.replaceState(null, "", u.toString());
}

async function safeFetchJson<T = any>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function normalizeChampionRows(raw: any): ChampionRow[] {
  const arr = Array.isArray(raw?.champions) ? raw.champions : null;
  if (!arr) return [];
  return arr
    .map((x: any) => {
      const key = x?.key != null ? String(x.key) : "";
      const id = x?.id != null ? String(x.id) : "";
      const name = x?.name != null ? String(x.name) : id;
      const title = x?.title != null ? String(x.title) : undefined;
      return { key, id, name, title };
    })
    .filter((c: ChampionRow) => c.key && c.id && c.name);
}

function formatGeneratedAtStable(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return `${d.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function champIconUrl(version: string, champId: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champId}.png`;
}

function itemIconUrl(version: string, itemId: number) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`;
}

function canUseClipboard() {
  return typeof navigator !== "undefined" && !!navigator.clipboard?.writeText;
}

export default function MetaClient() {
  const [mode, setMode] = useState<MetaMode>("ranked");
  const [hydrated, setHydrated] = useState(false);

  const [meta, setMeta] = useState<MetaJson | null>(null);
  const [champions, setChampions] = useState<ChampionRow[]>([]);
  const [itemsById, setItemsById] = useState<Map<number, string>>(new Map());

  const [ddVersion, setDdVersion] = useState<string>("");

  const [patch, setPatch] = useState<string>("");
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [q, setQ] = useState<string>("");

  const [showItemNames, setShowItemNames] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // copy feedback
  const [copiedKey, setCopiedKey] = useState<string>("");

  const CHAMPS_URL = "/data/lol/champions_index.json";
  const ITEMS_URL = "/data/lol/items.json";

  useEffect(() => {
    setHydrated(true);
    setMode(readModeFromUrl());
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      const champsRaw = await safeFetchJson<any>(CHAMPS_URL);
      const champRows = normalizeChampionRows(champsRaw);
      if (!alive) return;

      setChampions(champRows);

      const v = typeof champsRaw?.version === "string" ? champsRaw.version : "";
      if (v) setDdVersion(v);

      const itemsRaw = await safeFetchJson<ItemsDdragon>(ITEMS_URL);
      if (!alive) return;

      if (itemsRaw?.data) {
        const m = new Map<number, string>();
        for (const [k, v2] of Object.entries(itemsRaw.data)) {
          const id = Number(k);
          if (!Number.isFinite(id) || id <= 0) continue;
          const nm = v2?.name ? String(v2.name) : "";
          if (nm) m.set(id, nm);
        }
        setItemsById(m);
      }

      if (!v && typeof itemsRaw?.version === "string") {
        setDdVersion(itemsRaw.version);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    let alive = true;

    (async () => {
      setMeta(null);

      const url =
        mode === "ranked"
          ? "/data/lol/meta_builds_ranked.json"
          : "/data/lol/meta_builds_casual.json";

      const json = await safeFetchJson<MetaJson>(url);
      if (!json || !json.patches) throw new Error(`Failed to load meta json: ${url}`);

      if (!alive) return;
      setMeta(json);

      const patches = Object.keys(json.patches || {}).sort((a, b) => toPatchNum(b) - toPatchNum(a));
      const newest = patches[0] || "";
      setPatch((prev) => prev || newest);

      setExpanded({});
      pushModeToUrl(mode);
    })().catch((e) => {
      console.error(e);
      if (!alive) return;
      setMeta(null);
    });

    return () => {
      alive = false;
    };
  }, [mode, hydrated]);

  const champByKey = useMemo(() => {
    const map = new Map<string, ChampionRow>();
    for (const c of champions) map.set(String(c.key), c);
    return map;
  }, [champions]);

  const patchOptions = useMemo(() => {
    if (!meta) return [];
    return Object.keys(meta.patches || {}).sort((a, b) => toPatchNum(b) - toPatchNum(a));
  }, [meta]);

  const patchChampMap = useMemo(() => {
    if (!meta || !patch) return {} as MetaJson["patches"][string];
    return meta.patches?.[patch] || ({} as any);
  }, [meta, patch]);

  function itemLabel(id: number) {
    if (!showItemNames) return String(id);
    const nm = itemsById.get(id);
    return nm ? nm : String(id);
  }

  function bestBuildForRole(roleBuilds: MetaRoleEntry[] | undefined) {
    if (!Array.isArray(roleBuilds) || !roleBuilds.length) return null;
    return roleBuilds[0];
  }

  function isStatSig(e: MetaRoleEntry | null) {
    if (!e || !meta) return false;
    if (e.lowSample) return false;
    return (e.games ?? 0) >= (meta.minDisplaySample ?? 0);
  }

  function champHasAnySigData(roleMap: Partial<Record<Role, MetaRoleEntry[]>>) {
    return (["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as Role[]).some((r) => {
      const best = bestBuildForRole(roleMap[r]);
      return isStatSig(best);
    });
  }

  function pickBestSigEntry(roleMap: Partial<Record<Role, MetaRoleEntry[]>>) {
    if (!meta) return null;

    let best: { role: Role; entry: MetaRoleEntry } | null = null;

    for (const r of ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as Role[]) {
      const e = bestBuildForRole(roleMap[r]);
      if (!e) continue;

      if (
        !best ||
        (e.score ?? 0) > (best.entry.score ?? 0) ||
        ((e.score ?? 0) === (best.entry.score ?? 0) && (e.games ?? 0) > (best.entry.games ?? 0))
      ) {
        best = { role: r, entry: e };
      }
    }

    return best;
  }

  function buildShareUrl(champId: string, champKey: string, roleSel: RoleFilter) {
    if (typeof window === "undefined") return "";
    const u = new URL(window.location.href);

    u.searchParams.set("mode", mode);
    if (patch) u.searchParams.set("patch", patch);
    if (roleSel !== "ALL") u.searchParams.set("role", roleSel);
    u.searchParams.set("champ", champId || champKey);

    return u.toString();
  }

  function itemsToText(ids: number[]) {
    if (!ids.length) return "—";
    if (!showItemNames) return ids.map(String).join(", ");
    return ids
      .map((id) => {
        const nm = itemsById.get(id);
        return nm ? `${nm} (${id})` : String(id);
      })
      .join(", ");
  }

  function buildShareText(args: {
    champName: string;
    champId: string;
    champKey: string;
    role: Role;
    entry: MetaRoleEntry;
  }) {
    const { champName, champId, champKey, role: r, entry } = args;

    const boots = entry.boots ? [entry.boots] : [];
    const core = Array.isArray(entry.core) ? entry.core : [];
    const full = Array.isArray(entry.items) && entry.items.length ? entry.items : [...boots, ...core];

    const line1 = `${champName} • Patch ${patch || "—"} • ${
      mode === "ranked" ? "Ranked" : "Casual"
    } • ${shortRole(r)}`;
    const line2 = `Boots: ${boots.length ? itemsToText(boots) : "—"}`;
    const line3 = `Core: ${core.length ? itemsToText(core) : "—"}`;
    const line4 = full.length ? `Items: ${itemsToText(full)}` : "";
    const line5 = `Winrate: ${formatPct(entry.winrate)} • Games: ${entry.games} • Score: ${Math.round(
      entry.score ?? 0
    )}`;

    const s =
      Array.isArray(entry.summoners) && entry.summoners.length
        ? `Summoners: ${entry.summoners.join(", ")}`
        : "";
    const rSig = entry.runesSig ? `Runes: ${entry.runesSig}` : "";

    const url = buildShareUrl(champId, champKey, role);

    return [line1, line2, line3, line4, line5, s, rSig, url].filter(Boolean).join("\n");
  }

  async function copyBuildText(text: string, keyForToast: string) {
    try {
      if (!canUseClipboard()) return;
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyForToast);
      window.setTimeout(() => setCopiedKey(""), 1200);
    } catch {
      // no-op
    }
  }

  function roleEntryUi(
    roleBuilds: MetaRoleEntry[] | undefined,
    champCtx?: { champKey: string; champId: string; champName: string },
    roleCtx?: Role
  ) {
    const entry = bestBuildForRole(roleBuilds);
    if (!entry) return null;

    const boots = entry.boots ? itemLabel(entry.boots) : "—";
    const core =
      Array.isArray(entry.core) && entry.core.length ? entry.core.map(itemLabel).join(" • ") : "—";
    const wr = formatPct(entry.winrate);
    const games = entry.games;

    const sig = isStatSig(entry);

    const canCopy = canUseClipboard() && !!champCtx && !!roleCtx;

    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-white/90">{wr}</div>

          <div className="flex items-center gap-2">
            {!sig ? (
              <span
                className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/55"
                title={`Low sample: fewer than ${meta?.minDisplaySample ?? 0} games. Small samples can show inflated winrates.`}
              >
                low sample
              </span>
            ) : null}
            <div className="text-xs text-white/55">{games}g</div>

            {canCopy ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const text = buildShareText({
                    champName: champCtx!.champName,
                    champId: champCtx!.champId,
                    champKey: champCtx!.champKey,
                    role: roleCtx!,
                    entry,
                  });
                  copyBuildText(text, `${champCtx!.champKey}-${roleCtx!}`);
                }}
                className="ml-1 rounded-md border border-white/10 bg-white/[0.02] px-2 py-1 text-[11px] text-white/75 hover:border-white/20 hover:text-white"
                title="Copy build + link"
              >
                {copiedKey === `${champCtx!.champKey}-${roleCtx!}` ? "Copied" : "Copy"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-2 text-xs text-white/65">
          <div>
            <span className="text-white/45">Boots:</span> {boots}
          </div>
          <div className="mt-1">
            <span className="text-white/45">Core:</span> {core}
          </div>
        </div>
      </div>
    );
  }

  // ✅ FIXED: wraps the image (no forced pill/circle), and the row wraps on mobile.
  function BuildPreview({ roleLabel, entry }: { roleLabel: string; entry: MetaRoleEntry }) {
    const v = ddVersion || "16.1.1";
    const boots = entry.boots ? entry.boots : null;
    const core = Array.isArray(entry.core) ? entry.core : [];

    const previewItems = [...(boots ? [boots] : []), ...core.slice(0, 3)].filter(
      (x) => Number.isFinite(x) && x > 0
    ) as number[];

    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="shrink-0 text-xs font-semibold text-white/65">{roleLabel}</div>

        <div className="flex flex-wrap items-center gap-1.5">
          {previewItems.length ? (
            previewItems.map((id) => (
              <div key={id} className="group relative">
                <span className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] p-0.5">
                  <img
                    src={itemIconUrl(v, id)}
                    alt={String(id)}
                    className="h-6 w-6 rounded-md bg-white/[0.02] object-contain sm:h-7 sm:w-7"
                    loading="lazy"
                  />
                </span>

                <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black px-2 py-1 text-[11px] text-white/80 shadow-lg group-hover:block">
                  {showItemNames
                    ? itemLabel(id)
                    : `${id}${itemsById.get(id) ? ` • ${itemsById.get(id)}` : ""}`}
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-white/45">No item data</div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs text-white/60">
          <span className="text-white/80">{formatPct(entry.winrate)}</span>
          <span className="text-white/40">{entry.games}g</span>
        </div>
      </div>
    );
  }

  const championCards = useMemo(() => {
    const entries = Object.entries(patchChampMap || {});
    const search = q.trim().toLowerCase();

    const filtered = entries.filter(([champKey]) => {
      const c = champByKey.get(champKey);
      const name = (c?.name || "").toLowerCase();
      const id = (c?.id || "").toLowerCase();
      if (!search) return true;
      return name.includes(search) || id.includes(search) || champKey.includes(search);
    });

    filtered.sort((a, b) => {
      const ca = champByKey.get(a[0])?.name || a[0];
      const cb = champByKey.get(b[0])?.name || b[0];
      return ca.localeCompare(cb);
    });

    return filtered.map(([champKey, roleMap]) => {
      const c = champByKey.get(champKey);
      return {
        champKey,
        name: c?.name || champKey,
        title: c?.title || "",
        id: c?.id || champKey,
        roleMap: (roleMap || {}) as Partial<Record<Role, MetaRoleEntry[]>>,
      };
    });
  }, [patchChampMap, champByKey, q]);

  const visibleCards = useMemo(() => {
    if (role === "ALL") return championCards;
    return championCards.filter((c) => Boolean(bestBuildForRole(c.roleMap?.[role] as any)));
  }, [championCards, role]);

  function setAllExpanded(next: boolean) {
    const obj: Record<string, boolean> = {};
    for (const c of visibleCards) obj[c.champKey] = next;
    setExpanded(obj);
  }

  const headerBadges = useMemo(() => {
    if (!meta) return null;

    const modeLabel =
      mode === "ranked"
        ? `Ranked (Q${meta.queues?.[0] ?? 420})`
        : `Casual (Q${meta.queues?.join(",") || "400,430"})`;

    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/60">
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
          Patch {patch || "—"}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
          {modeLabel}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
          Min display {meta.minDisplaySample}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
          Timeline {meta.useTimeline ? "ON" : "OFF"}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
          Generated {formatGeneratedAtStable(meta.generatedAt)}
        </span>
      </div>
    );
  }, [meta, mode, patch]);

  const confidenceNote = useMemo(() => {
    if (!meta) return null;

    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/65">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white/85">About these winrates</div>
            <div className="mt-1 text-white/60">
              Builds are based on recent match data. Any build under{" "}
              <span className="text-white/80">{meta.minDisplaySample}</span> games is labeled{" "}
              <span className="text-white/80">low sample</span> and should be treated as “not enough
              data yet.”
            </div>
            <div className="mt-2 text-white/55">
              Winrate scoring uses smoothing (Bayes K={meta.bayesK}, prior=
              {Math.round(meta.priorWinrate * 100)}%), but low samples can still be noisy.
            </div>
          </div>

          <div className="shrink-0">
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white/65">
              Tip: check games played
            </span>
          </div>
        </div>
      </div>
    );
  }, [meta]);

  const vForIcons = ddVersion || "16.1.1";

  function toggleCard(champKey: string) {
    setExpanded((prev) => ({ ...prev, [champKey]: !prev[champKey] }));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-2">
            <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center lg:gap-2">
              <button
                onClick={() => setMode("ranked")}
                className={cx(
                  "w-full rounded-lg border px-3 py-1.5 text-sm transition lg:w-auto",
                  mode === "ranked"
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 bg-transparent text-white/70 hover:text-white"
                )}
              >
                Ranked
              </button>
              <button
                onClick={() => setMode("casual")}
                className={cx(
                  "w-full rounded-lg border px-3 py-1.5 text-sm transition lg:w-auto",
                  mode === "casual"
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 bg-transparent text-white/70 hover:text-white"
                )}
              >
                Casual
              </button>

              <div className="mx-2 hidden h-6 w-px bg-white/10 lg:block" />

              <label className="col-span-2 flex items-center justify-between gap-2 text-sm text-white/70 lg:col-span-1 lg:justify-start">
                Patch
                <select
                  value={patch}
                  onChange={(e) => setPatch(e.target.value)}
                  className="w-40 rounded-lg border border-white/10 bg-black px-2 py-1 text-sm text-white outline-none lg:w-auto"
                >
                  {patchOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-row lg:items-center">
              <label className="flex w-full items-center justify-between gap-2 text-sm text-white/70 sm:w-auto sm:justify-start">
                Role
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as RoleFilter)}
                  className="w-40 rounded-lg border border-white/10 bg-black px-2 py-1 text-sm text-white outline-none sm:w-auto"
                >
                  <option value="ALL">All</option>
                  <option value="TOP">Top</option>
                  <option value="JUNGLE">Jungle</option>
                  <option value="MIDDLE">Mid</option>
                  <option value="BOTTOM">Bot</option>
                  <option value="UTILITY">Support</option>
                </select>
              </label>

              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search champ..."
                className="w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 lg:w-64"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center lg:gap-2">
            <button
              onClick={() => setAllExpanded(true)}
              className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white/80 hover:border-white/20 hover:text-white lg:w-auto"
            >
              Expand all
            </button>
            <button
              onClick={() => setAllExpanded(false)}
              className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white/80 hover:border-white/20 hover:text-white lg:w-auto"
            >
              Collapse all
            </button>

            <label className="col-span-2 flex w-full items-center gap-2 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white/80 lg:col-span-1 lg:w-auto">
              <input
                type="checkbox"
                checked={showItemNames}
                onChange={(e) => setShowItemNames(e.target.checked)}
              />
              Show item names
            </label>
          </div>
        </div>

        {headerBadges}
        {confidenceNote}

        <div className="mt-3 text-sm text-white/60">
          Showing <span className="text-white/85">{visibleCards.length}</span> champions{" "}
          <span className="text-white/35">
            (patch contains {Object.keys(patchChampMap || {}).length})
          </span>
        </div>

        {!meta && <div className="mt-3 text-sm text-white/60">Loading meta…</div>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        {visibleCards.map((c) => {
          const isOpen = Boolean(expanded[c.champKey]);
          const hasSig = champHasAnySigData(c.roleMap);
          const best = pickBestSigEntry(c.roleMap);

          const canCopy = canUseClipboard() && !!best;
          const copyToastKey = `${c.champKey}-best`;

          return (
            <div key={c.champKey} className="border-b border-white/10 last:border-b-0">
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleCard(c.champKey)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleCard(c.champKey);
                  }
                }}
                className="flex w-full cursor-pointer items-start justify-between gap-3 bg-white/[0.02] px-4 py-3 text-left hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              >
                <div className="flex min-w-0 gap-3">
                  <img
                    src={champIconUrl(vForIcons, c.id)}
                    alt={c.name}
                    className="mt-0.5 h-9 w-9 shrink-0 rounded-xl border border-white/10 bg-white/[0.02] object-cover sm:h-10 sm:w-10"
                    loading="lazy"
                  />

                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <div className="truncate text-sm font-semibold text-white/95">{c.name}</div>
                      {c.title ? (
                        <div className="truncate text-xs text-white/45">{c.title}</div>
                      ) : null}
                    </div>

                    <div className="mt-0.5 text-xs text-white/45">
                      {hasSig ? "Stat-sig build available" : "No stat-sig data yet"} • key{" "}
                      {c.champKey}
                    </div>

                    {best ? (
                      <BuildPreview roleLabel={shortRole(best.role)} entry={best.entry} />
                    ) : (
                      <div className="mt-2 text-xs text-white/45">
                        No builds ≥ {meta?.minDisplaySample ?? "—"} games for this champ on this patch.
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 pt-1">
                  <div className="flex items-center gap-2">
                    {canCopy ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!best) return;
                          const text = buildShareText({
                            champName: c.name,
                            champId: c.id,
                            champKey: c.champKey,
                            role: best.role,
                            entry: best.entry,
                          });
                          copyBuildText(text, copyToastKey);
                        }}
                        className="rounded-lg border border-white/10 bg-transparent px-2.5 py-1.5 text-xs text-white/80 hover:border-white/20 hover:text-white"
                        title="Copy best build + link"
                      >
                        {copiedKey === copyToastKey ? "Copied" : "Copy"}
                      </button>
                    ) : null}

                    <div className="text-xs text-white/60">{isOpen ? "Collapse" : "Expand"}</div>
                  </div>
                </div>
              </div>

              {isOpen ? (
                <div className="bg-black px-4 pb-4 pt-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as Role[]).map((r) => (
                      <div key={r} className="space-y-2">
                        <div className="text-xs font-semibold text-white/70">{shortRole(r)}</div>

                        {roleEntryUi(
                          c.roleMap[r],
                          { champKey: c.champKey, champId: c.id, champName: c.name },
                          r
                        ) ?? (
                          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/45">
                            No data yet
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
