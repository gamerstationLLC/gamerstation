// app/calculators/lol/meta/client.tsx
"use client";

import Link from "next/link";
import { blobUrl } from "@/lib/blob-client";
import { useEffect, useMemo, useRef, useState } from "react";

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

type ItemData = {
  name?: string;
  plaintext?: string;
  description?: string;
  gold?: { total?: number };
  image?: { full?: string };
  from?: string[];
  into?: string[];
  tags?: string[];
  stats?: Record<string, number>;
};

type ItemsDdragon = {
  version?: string;
  data?: Record<string, ItemData>;
};

function stripHtml(html: string) {
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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

function SeoBlock() {
  return (
    <section className="mt-10 border-t border-white/10 pt-8">
      {/* Collapsed by default, but still server-rendered content for crawlers */}
      <details className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6" open={false}>
        <summary className="cursor-pointer select-none list-none">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-white">About these LoL Meta Builds</h2>
              <p className="mt-1 text-xs text-white/65">
                Patch/role builds, ranked vs normals, core items, and popular skill orders. (Tap to
                expand)
              </p>
            </div>
            <span className="text-white/65" aria-hidden>
              ▸
            </span>
          </div>
        </summary>

        <div className="mt-4 space-y-5 text-sm text-white/80">
          <p>
            GamerStation’s <strong>League of Legends meta builds</strong> page helps you find the{" "}
            <strong>best builds</strong> for the current patch — including <strong>items</strong>,{" "}
            <strong>runes</strong>, and <strong>role-based builds</strong> for each champion. You can
            toggle between <strong>Ranked (Solo/Duo)</strong> and <strong>Casual (Normals)</strong>{" "}
            to see what’s working in different environments.
          </p>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">What you’ll find here</h3>
            <ul className="list-disc pl-5 text-sm text-white/80">
              <li>
                <strong>LoL meta builds by patch</strong> (current patch focus)
              </li>
              <li>
                <strong>Champion builds by role</strong> (Top/Jungle/Mid/ADC/Support)
              </li>
              <li>
                Common <strong>core item</strong> paths and build variations
              </li>
              <li>
                <strong>Runes</strong> selections that pair with those builds
              </li>
              <li>
                Quick “what’s strong right now?” browsing via compact champion cards
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">Related tools</h3>
            <ul className="list-disc pl-5">
              <li>
                <Link href="/calculators/lol" className="text-white hover:underline">
                  LoL Damage Calculator
                </Link>{" "}
                (test burst, DPS, and TTK with items)
              </li>
              <li>
                <Link href="/tools/lol/champion-tiers" className="text-white hover:underline">
                  Champion tiers
                </Link>{" "}
                (who’s strongest right now)
              </li>
              <li>
                <Link href="/calculators/lol/champions" className="text-white hover:underline">
                  Champion stats by level index
                </Link>{" "}
                (base stats + per-level scaling)
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">FAQ</h3>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold text-white">
                Are these “best builds” for ranked?
              </div>
              <p className="mt-1 text-sm text-white/80">
                Yes — you can view ranked builds (Solo/Duo) and compare them to normals to see what
                changes between competitive and casual play.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold text-white">
                Do builds change by role?
              </div>
              <p className="mt-1 text-sm text-white/80">
                Yes — champions often have different item/rune priorities depending on role, so the
                page is organized around role-based build patterns.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold text-white">
                Can I use this for ARAM?
              </div>
              <p className="mt-1 text-sm text-white/80">
                This page focuses on Summoner’s Rift environments (ranked/normals). ARAM-specific
                builds can be added later as a dedicated mode.
              </p>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
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

const FALLBACK_MIN_GAMES = 10; // show something if we have at least this
const Z_95 = 1.96; // ~95% confidence

function wilsonLowerBound(p: number, n: number, z = Z_95) {
  if (!Number.isFinite(p) || !Number.isFinite(n) || n <= 0) return -1;
  p = Math.min(1, Math.max(0, p));
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const adj = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return (center - adj) / denom;
}

/**
 * Picks the "best" build from an array, but:
 * - only considers builds with >= fallbackMin games
 * - strongly prefers builds with >= preferredMin games if any exist
 * - uses Wilson LB so low-game 100% WR doesn't beat good high-sample builds
 */
function pickBestBuild(
  roleBuilds: MetaRoleEntry[] | undefined,
  preferredMin: number,
  fallbackMin = FALLBACK_MIN_GAMES
) {
  if (!Array.isArray(roleBuilds) || roleBuilds.length === 0) return null;

  const viable = roleBuilds.filter((b) => (b?.games ?? 0) >= fallbackMin);
  if (!viable.length) return null;

  const strong = viable.filter((b) => (b?.games ?? 0) >= preferredMin);
  const pool = strong.length ? strong : viable;

  let best = pool[0];
  let bestScore = wilsonLowerBound(best.winrate, best.games);

  for (let i = 1; i < pool.length; i++) {
    const b = pool[i];
    const s = wilsonLowerBound(b.winrate, b.games);

    // primary: Wilson LB (sample-size-aware)
    if (s > bestScore) {
      best = b;
      bestScore = s;
      continue;
    }

    // tie-breakers: more games, then your server-side score
    if (s === bestScore) {
      const ng = b.games ?? 0;
      const bg = best.games ?? 0;
      if (ng > bg) {
        best = b;
        bestScore = s;
        continue;
      }
      if (ng === bg && (b.score ?? 0) > (best.score ?? 0)) {
        best = b;
        bestScore = s;
      }
    }
  }

  return best;
}

// ✅ URL role parsing guard (used only for hydration)
function isRole(x: string | null): x is Role {
  return x === "TOP" || x === "JUNGLE" || x === "MIDDLE" || x === "BOTTOM" || x === "UTILITY";
}

export default function MetaClient() {
  const [mode, setMode] = useState<MetaMode>("ranked");
  const [hydrated, setHydrated] = useState(false);

  const [meta, setMeta] = useState<MetaJson | null>(null);
  const [champions, setChampions] = useState<ChampionRow[]>([]);
  const [itemsById, setItemsById] = useState<Map<number, ItemData>>(new Map());

  // ddVersion = "icon version" we can use, often comes from your cached champs/items json
  const [ddVersion, setDdVersion] = useState<string>("");

  // patch = dataset patch key (comes from meta json keys)
  const [patch, setPatch] = useState<string>("");

  // displayPatch = label patch from blob version.json (your "26 stuff")
  const [displayPatch, setDisplayPatch] = useState<string>("");

  const [role, setRole] = useState<RoleFilter>("ALL");
  const [q, setQ] = useState<string>("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // copy feedback
  const [copiedKey, setCopiedKey] = useState<string>("");

  // ✅ mobile item tap feedback (since hover tooltips don't work on iOS)
  const [itemToast, setItemToast] = useState<{ id: number; text: string } | null>(null);

  // ✅ per-champ selected item (for showing only the name of what you tapped)
  const [selectedItemByChamp, setSelectedItemByChamp] = useState<Record<string, number | null>>({});

  // ✅ per-champ active role for the expanded view (shows only one role at a time)
  const [activeRoleByChamp, setActiveRoleByChamp] = useState<Record<string, Role>>({});

  // ✅ per-champ selected item in the expanded view (shows full info panel)
  const [selectedExpandedItemByChamp, setSelectedExpandedItemByChamp] = useState<
    Record<string, number | null>
  >({});

  // Local (repo) endpoints
  const CHAMPS_URL = "/data/lol/champions_index.json";
  const ITEMS_URL = "/data/lol/items.json";

  // ✅ URL hydration refs (share link hydration)
  const didHydrateRef = useRef(false);
  const patchFromUrlRef = useRef<string>("");

  // ✅ hydration effect (mode + role + champ + patch)
  useEffect(() => {
    setHydrated(true);

    if (typeof window === "undefined") {
      setMode(readModeFromUrl());
      return;
    }

    if (didHydrateRef.current) return;
    didHydrateRef.current = true;

    const sp = new URLSearchParams(window.location.search);

    // mode
    const urlMode = sp.get("mode") === "casual" ? "casual" : "ranked";
    setMode(urlMode);

    // role (optional)
    const urlRole = sp.get("role");
    if (isRole(urlRole)) setRole(urlRole);

    // champ (auto-fill search bar)
    const urlChamp = sp.get("champ");
    if (typeof urlChamp === "string" && urlChamp.trim()) {
      setQ(urlChamp.trim());
    }

    // patch (validate after meta loads)
    const urlPatch = sp.get("patch");
    patchFromUrlRef.current = typeof urlPatch === "string" ? urlPatch : "";
  }, []);

  // ✅ load champs + items + blob version label
  useEffect(() => {
    let alive = true;

    (async () => {
      // displayPatch from blob (your "26 stuff")
      const vj = await safeFetchJson<{ version?: string }>(blobUrl("data/lol/version.json"));
      if (alive) {
        const v = String(vj?.version ?? "").trim();
        if (v) setDisplayPatch(v);
      }

      // champs index
      const champsRaw = await safeFetchJson<any>(CHAMPS_URL);
      const champRows = normalizeChampionRows(champsRaw);
      if (!alive) return;

      setChampions(champRows);

      const v = typeof champsRaw?.version === "string" ? champsRaw.version : "";
      if (v) setDdVersion(v);

      // items
      const itemsRaw = await safeFetchJson<ItemsDdragon>(ITEMS_URL);
      if (!alive) return;

      if (itemsRaw?.data) {
        const m = new Map<number, ItemData>();
        for (const [k, v2] of Object.entries(itemsRaw.data)) {
          const id = Number(k);
          if (!Number.isFinite(id) || id <= 0) continue;
          const item: ItemData = v2 ? (v2 as ItemData) : {};
          if (item && item.name) m.set(id, item);
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

  // ✅ load meta json from Blob when mode changes
  useEffect(() => {
    if (!hydrated) return;

    let alive = true;

    (async () => {
      setMeta(null);

      const url =
        mode === "ranked"
          ? blobUrl("data/lol/meta_builds_ranked.json")
          : blobUrl("data/lol/meta_builds_casual.json");

      const json = await safeFetchJson<MetaJson>(url);
      if (!json || !json.patches) throw new Error(`Failed to load meta json: ${url}`);

      if (!alive) return;
      setMeta(json);

      const patches = Object.keys(json.patches || {}).sort((a, b) => toPatchNum(b) - toPatchNum(a));
      const newest = patches[0] || "";

      // apply URL patch if it exists in the dataset
      const urlPatch = patchFromUrlRef.current;
      if (urlPatch && json.patches?.[urlPatch]) {
        setPatch(urlPatch);
      } else {
        setPatch((prev) => prev || newest);
      }

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

  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  const patchOptions = useMemo(() => {
    if (!meta) return [];
    return Object.keys(meta.patches || {}).sort((a, b) => toPatchNum(b) - toPatchNum(a));
  }, [meta]);

  const patchChampMap = useMemo(() => {
    if (!meta || !patch) return {} as MetaJson["patches"][string];
    return meta.patches?.[patch] || ({} as any);
  }, [meta, patch]);

  type VisibleCard = {
    champKey: string;
    champId: string;
    name: string;
    title?: string;
    roleMap: Partial<Record<Role, MetaRoleEntry[]>>;
    roleSummaries: Array<{ role: Role; entry: MetaRoleEntry }>;
  };

  function itemLabel(id: number) {
    const item = itemsById.get(id);
    return item?.name ? String(item.name) : String(id);
  }

  function bestBuildForRole(roleBuilds: MetaRoleEntry[] | undefined) {
    const preferred = meta?.minDisplaySample ?? 25; // "good sample" target
    return pickBestBuild(roleBuilds, preferred, FALLBACK_MIN_GAMES);
  }

  function isStatSig(e: MetaRoleEntry | null) {
    if (!e || !meta) return false;
    if (e.lowSample) return false;
    return (e.games ?? 0) >= (meta.minDisplaySample ?? 25);
  }

  function pickBestSigEntry(roleMap: Partial<Record<Role, MetaRoleEntry[]>>) {
    if (!meta) return null;

    const preferred = meta.minDisplaySample ?? 25;

    let best: { role: Role; entry: MetaRoleEntry; s: number } | null = null;

    for (const r of ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as Role[]) {
      const e = pickBestBuild(roleMap[r], preferred, FALLBACK_MIN_GAMES);
      if (!e) continue;

      const s = wilsonLowerBound(e.winrate, e.games);

      if (!best || s > best.s || (s === best.s && (e.games ?? 0) > (best.entry.games ?? 0))) {
        best = { role: r, entry: e, s };
      }
    }

    return best ? { role: best.role, entry: best.entry } : null;
  }

  // Champions shown in the list (search + optional role filter)
  const visibleCards = useMemo<VisibleCard[]>(() => {
    if (!meta || !patch) return [];

    const needle = q.trim().toLowerCase();
    const rows: VisibleCard[] = champions.map((c) => {
      const champKey = String(c.key);
      return {
        champKey,
        champId: c.id,
        name: c.name,
        title: c.title,
        roleMap: (patchChampMap?.[champKey] || {}) as Partial<Record<Role, MetaRoleEntry[]>>,
        roleSummaries: (["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as Role[])
          .map((r) => {
            const arr = (patchChampMap?.[champKey] as Partial<Record<Role, MetaRoleEntry[]> | undefined>)?.[r];
            const best = bestBuildForRole(arr);
            return best ? { role: r, entry: best } : null;
          })
          .filter(Boolean) as Array<{ role: Role; entry: MetaRoleEntry }>,
      };
    });

    const filteredByQuery = needle
      ? rows.filter((c) => {
          const hay = `${c.name} ${c.champId} ${c.title || ""}`.toLowerCase();
          return hay.includes(needle);
        })
      : rows;

    if (role === "ALL") return filteredByQuery;

    // If a global role filter is selected, only show champs that actually have any builds for that role.
    return filteredByQuery.filter((c) => {
      const arr = c.roleMap[role];
      return !!bestBuildForRole(arr);
    });
  }, [meta, patch, champions, patchChampMap, q, role]); // eslint-disable-line react-hooks/exhaustive-deps

  function buildShareUrl(champId: string, champKey: string, roleSel: RoleFilter) {
    if (typeof window === "undefined") return "";
    const u = new URL(window.location.href);

    u.searchParams.set("mode", mode);
    if (patch) u.searchParams.set("patch", patch);
    if (roleSel !== "ALL") u.searchParams.set("role", roleSel);

    // store champ as "Akali" etc so the search bar can auto-fill on open
    u.searchParams.set("champ", champId?.trim() ? champId.trim() : String(champKey));

    return u.toString();
  }

  function itemsToText(ids: number[]) {
    if (!ids.length) return "—";
    return ids.map((id) => itemsById.get(id)?.name ?? String(id)).join(", ");
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

  // ✅ helper: show item name on tap (mobile) WITHOUT toggling expand
  function showItemNameToast(id: number) {
    const nm = itemsById.get(id)?.name ?? String(id);
    const text = nm ? `${nm} (${id})` : String(id);
    setItemToast({ id, text });
    window.setTimeout(() => setItemToast(null), 1200);
  }

  // ✅ single source of truth for icons (never hardcode 16.x)
  const iconVersion = ddVersion || displayPatch || patch || "current";

  function BuildPreviewList({
    summaries,
    version,
  }: {
    summaries: Array<{ role: Role; entry: MetaRoleEntry }>;
    version: string;
  }) {
    const v = version || iconVersion || "current";

    return (
      <div className="mt-2 space-y-2">
        {summaries.map(({ role, entry }) => (
          <div key={role} className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="shrink-0 text-xs font-semibold text-white/65">{shortRole(role)}</div>
              <div className="shrink-0 text-xs text-white/55">
                {formatPct(entry.winrate)} · {entry.games} games
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {entry.boots ? (
                <img
                  src={itemIconUrl(v, entry.boots)}
                  alt="Boots"
                  className="h-7 w-7 rounded-md object-cover"
                  loading="lazy"
                />
              ) : null}

              {entry.core.map((id, idx) => (
                <img
                  key={`${role}-${id}-${idx}`}
                  src={itemIconUrl(v, id)}
                  alt={`Core item ${idx + 1}`}
                  className="h-7 w-7 rounded-md object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function BuildPreview({
    roleLabel,
    entry,
    champKey,
  }: {
    roleLabel: string;
    entry: MetaRoleEntry;
    champKey: string;
  }) {
    const v = iconVersion;
    const boots = entry.boots ? entry.boots : null;
    const core = Array.isArray(entry.core) ? entry.core : [];

    const previewItems = [...(boots ? [boots] : []), ...core.slice(0, 3)].filter(
      (x) => Number.isFinite(x) && x > 0
    ) as number[];

    const selected = selectedItemByChamp[champKey] ?? null;
    const selectedName = selected ? itemsById.get(selected)?.name : "";

    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="shrink-0 text-xs font-semibold text-white/65">{roleLabel}</div>
        <div className="shrink-0 text-xs text-white/55">
          {formatPct(entry.winrate)} · {entry.games} games
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {previewItems.length ? (
            previewItems.map((id) => {
              const nm = itemsById.get(id)?.name ?? String(id);
              const isSelected = selected === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedItemByChamp((prev) => ({
                      ...prev,
                      [champKey]: prev[champKey] === id ? null : id,
                    }));
                  }}
                  className={cx(
                    "group relative grid place-items-center rounded-lg border bg-white/[0.02] p-0.5",
                    isSelected ? "border-white/30" : "border-white/10 hover:border-white/20"
                  )}
                  title={nm}
                >
                  <img
                    src={itemIconUrl(v, id)}
                    alt={nm}
                    className="h-7 w-7 rounded-md object-cover"
                    loading="lazy"
                  />
                </button>
              );
            })
          ) : (
            <div className="text-xs text-white/45">—</div>
          )}
        </div>

        {selectedName ? (
          <div className="min-w-0 truncate text-xs text-white/75">{selectedName}</div>
        ) : null}
      </div>
    );
  }

  function setAllExpanded(next: boolean) {
    const obj: Record<string, boolean> = {};
    for (const c of visibleCards) obj[c.champKey] = next;
    setExpanded(obj);
  }

  const headerBadges = useMemo(() => {
    if (!meta) return null;

    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/60">
        {/* ✅ label from blob (displayPatch) but keep dataset patch available */}
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
          Patch {displayPatch || patch || "—"}
        </span>

        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
          Min display {meta.minDisplaySample}
        </span>

    
      </div>
    );
  }, [meta, patch, displayPatch]);

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
              <span className="text-white/80">low sample</span> and should be treated as “not enough data
              yet.”
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

  function toggleCard(champKey: string) {
    setExpanded((prev) => ({ ...prev, [champKey]: !prev[champKey] }));
  }

  return (
    <div>
      {/* ✅ Non-Tools nav belongs below the page description, left-aligned */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Link href="/calculators/lol/hub" className={navBtn}>
          LoL Hub
        </Link>
        <Link href="/tools/lol/champion-tiers" className={navBtn}>
          Tiers List
        </Link>
      </div>

      <div className="space-y-4">
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/[.6] p-4">
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
            </div>
          </div>

          {headerBadges}
          {confidenceNote}

          <div className="mt-3 text-sm text-white/60">
            Showing <span className="text-white/85">{visibleCards.length}</span> champions{" "}
            <span className="text-white/35">(patch contains {Object.keys(patchChampMap || {}).length})</span>
          </div>

          {!meta && <div className="mt-3 text-sm text-white/60">Loading meta…</div>}
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          {visibleCards.map((c) => {
            const isOpen = Boolean(expanded[c.champKey]);

            const best = pickBestSigEntry(c.roleMap);

            const rolesAll: Role[] = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
            const rolesWithData = rolesAll.filter((r) => bestBuildForRole(c.roleMap[r]));
            const activeRole = (activeRoleByChamp[c.champKey] as Role | undefined) ?? rolesWithData[0];
            const activeEntry = activeRole ? bestBuildForRole(c.roleMap[activeRole]) : null;

            // ✅ slug pages are lowercase
            const champHref = `/calculators/lol/champions/${String(c.champId).toLowerCase()}`;

            const canCopy = canUseClipboard() && (!!activeEntry || !!best);
            const copyToastKey = `${c.champKey}-${activeRole || "best"}`;

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
                    <Link
                      href={champHref}
                      prefetch={false}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="
                        group mt-0.5 shrink-0 rounded-xl
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60
                      "
                      aria-label={`Open ${c.name} page`}
                    >
                      <img
                        src={champIconUrl(iconVersion, c.champId)}
                        alt={c.name}
                        className="
                          h-9 w-9 rounded-xl object-cover sm:h-10 sm:w-10
                          border border-white/10 bg-white/[0.02]
                          transition
                          group-hover:border-cyan-400/60
                          group-hover:shadow-[0_0_20px_rgba(0,255,255,0.45)]
                        "
                        loading="lazy"
                        draggable={false}
                        onError={(e) => {
                          const img = e.currentTarget;
                          img.onerror = null;
                          img.src = champIconUrl("current", c.champId);
                        }}
                      />
                    </Link>

                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <div className="truncate text-sm font-semibold text-white/95">{c.name}</div>
                        {c.title ? <div className="truncate text-xs text-white/45">{c.title}</div> : null}
                      </div>

                      {c.roleSummaries.length ? (
                        <BuildPreviewList summaries={c.roleSummaries} version={iconVersion} />
                      ) : (
                        <div className="mt-2 text-xs text-white/45">
                          No builds ≥ {FALLBACK_MIN_GAMES} games for this champ on this patch yet.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 pt-1">
                    <div className="flex flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleCard(c.champKey);
                        }}
                        className="rounded-lg border border-white/10 bg-transparent px-2.5 py-1.5 text-xs text-white/80 hover:border-white/20 hover:text-white"
                        title={isOpen ? "Hide build" : "View build"}
                      >
                        {isOpen ? "Hide build ▴" : "View build ▾"}
                      </button>

                      {isOpen && canCopy ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const entryToCopy = activeEntry ?? best?.entry;
                            const roleToCopy = activeRole ?? best?.role;
                            if (!entryToCopy || !roleToCopy) return;
                            const text = buildShareText({
                              champName: c.name,
                              champId: c.champId,
                              champKey: c.champKey,
                              role: roleToCopy,
                              entry: entryToCopy,
                            });
                            copyBuildText(text, copyToastKey);
                          }}
                          className="rounded-lg border border-white/10 bg-transparent px-2.5 py-1.5 text-xs text-white/80 hover:border-white/20 hover:text-white"
                          title="Copy build + link"
                        >
                          {copiedKey === copyToastKey ? "Copied" : "Copy"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                {isOpen ? (
                  <div className="bg-black px-4 pb-4 pt-3">
                    {(() => {
                      const rolesAll2: Role[] = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
                      const rolesWithData2 = rolesAll2.filter((r) => bestBuildForRole(c.roleMap[r]));
                      if (!rolesWithData2.length) {
                        return (
                          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/45">
                            No data yet
                          </div>
                        );
                      }

                      const active =
                        (activeRoleByChamp[c.champKey] as Role | undefined) ?? rolesWithData2[0];
                      const entry = bestBuildForRole(c.roleMap[active])!;

                      const wr = formatPct(entry.winrate);
                      const sig = isStatSig(entry);

                      const allItems = [
                        ...(entry.boots ? [entry.boots] : []),
                        ...(Array.isArray(entry.core) ? entry.core : []),
                        ...(Array.isArray(entry.items) ? entry.items : []),
                      ]
                        .filter((x) => Number.isFinite(x) && x > 0)
                        .map((x) => Number(x));

                      const seen = new Set<number>();
                      const uniqItems = allItems.filter((id) => {
                        if (seen.has(id)) return false;
                        seen.add(id);
                        return true;
                      });

                      const selectedItem =
                        selectedExpandedItemByChamp[c.champKey] ?? uniqItems[0] ?? null;
                      const selectedObj = selectedItem ? itemsById.get(selectedItem) : undefined;

                      return (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {rolesWithData2.map((r) => {
                              const isActive = r === active;
                              return (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() =>
                                    setActiveRoleByChamp((prev) => ({
                                      ...prev,
                                      [c.champKey]: r,
                                    }))
                                  }
                                  className={cx(
                                    "rounded-full border px-3 py-1 text-xs font-semibold",
                                    isActive
                                      ? "border-white/25 bg-white/[0.06] text-white"
                                      : "border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20 hover:text-white"
                                  )}
                                >
                                  {shortRole(r)}
                                </button>
                              );
                            })}

                            <div className="ml-auto flex items-center gap-2 text-xs text-white/55">
                              {!sig ? (
                                <span
                                  className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/55"
                                  title={`Low sample: fewer than ${meta?.minDisplaySample ?? 0} games. Small samples can show inflated winrates.`}
                                >
                                  low sample
                                </span>
                              ) : null}
                              <span className="text-white/60">{wr}</span>
                              <span>{entry.games} games</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {uniqItems.map((id) => {
                              const nm = itemsById.get(id)?.name ?? String(id);
                              const isSelected = selectedItem === id;

                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedExpandedItemByChamp((prev) => ({
                                      ...prev,
                                      [c.champKey]: prev[c.champKey] === id ? null : id,
                                    }));
                                  }}
                                  className={cx(
                                    "group relative grid place-items-center rounded-lg border bg-white/[0.02] p-0.5",
                                    isSelected ? "border-white/30" : "border-white/10 hover:border-white/20"
                                  )}
                                  title={nm}
                                >
                                  <img
                                    src={itemIconUrl(iconVersion, id)}
                                    alt={nm}
                                    className="h-10 w-10 rounded-md object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      const img = e.currentTarget;
                                      img.onerror = null;
                                      img.src = itemIconUrl("current", id);
                                    }}
                                  />
                                </button>
                              );
                            })}
                          </div>

                          {selectedItem && selectedObj ? (
                            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-white/90">
                                    {selectedObj.name ?? selectedItem}
                                  </div>
                                  {selectedObj.plaintext ? (
                                    <div className="mt-0.5 text-xs text-white/55">
                                      {selectedObj.plaintext}
                                    </div>
                                  ) : null}
                                </div>

                                {typeof selectedObj.gold?.total === "number" ? (
                                  <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/60">
                                    {selectedObj.gold.total}g
                                  </div>
                                ) : null}
                              </div>

                              {selectedObj.description ? (
                                <div className="mt-2 text-xs leading-relaxed text-white/70">
                                  {stripHtml(selectedObj.description)}
                                </div>
                              ) : null}

                              {selectedObj.stats && Object.keys(selectedObj.stats).length ? (
                                <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                                  {Object.entries(selectedObj.stats).map(([k, v]) => (
                                    <div key={k} className="text-[11px] text-white/60">
                                      <span className="text-white/45">{k}:</span>{" "}
                                      <span className="text-white/75">{String(v)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
            );
          })}
          
        </div>
<SeoBlock />
        {itemToast ? (
          <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/15 bg-black/80 px-3 py-1 text-xs text-white/85 shadow-lg">
            {itemToast.text}
          </div>
        ) : null}
      </div>
    </div>
  );
}
