"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChampionIndexRow, ItemRow } from "./page";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function fmt(n: number, digits = 0) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function signFmt(n: number, digits = 0) {
  if (!Number.isFinite(n)) return "—";
  const s = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${s}${Math.abs(n).toFixed(digits)}`;
}

type FlatStats = {
  hp: number;
  ad: number;
  ap: number;
  armor: number;
  mr: number;
  msFlat: number;
  asPct: number;
  critPct: number;
  abilityHaste: number;
  lethality: number;
  armorPenPct: number;
  magicPenFlat: number;
  magicPenPct: number;
  lifestealPct: number;
  omnivampPct: number;
};

function emptyStats(): FlatStats {
  return {
    hp: 0,
    ad: 0,
    ap: 0,
    armor: 0,
    mr: 0,
    msFlat: 0,
    asPct: 0,
    critPct: 0,
    abilityHaste: 0,
    lethality: 0,
    armorPenPct: 0,
    magicPenFlat: 0,
    magicPenPct: 0,
    lifestealPct: 0,
    omnivampPct: 0,
  };
}

function parseItemStats(it: ItemRow | null): FlatStats {
  if (!it) return emptyStats();
  const s = it.stats ?? {};

  const out = emptyStats();
  out.hp = s.FlatHPPoolMod ?? 0;
  out.ad = s.FlatPhysicalDamageMod ?? 0;
  out.ap = s.FlatMagicDamageMod ?? 0;
  out.armor = s.FlatArmorMod ?? 0;
  out.mr = s.FlatSpellBlockMod ?? 0;
  out.msFlat = s.FlatMovementSpeedMod ?? 0;

  out.asPct = (s.PercentAttackSpeedMod ?? 0) * 100;
  out.critPct = (s.FlatCritChanceMod ?? 0) * 100;

  out.lethality = s.FlatArmorPenetrationMod ?? 0;
  out.armorPenPct = (s.PercentArmorPenetrationMod ?? 0) * 100;
  out.magicPenFlat = s.FlatMagicPenetrationMod ?? 0;
  out.magicPenPct = (s.PercentMagicPenetrationMod ?? 0) * 100;

  out.abilityHaste = s.FlatHasteMod ?? 0;
  out.lifestealPct = (s.PercentLifeStealMod ?? 0) * 100;
  out.omnivampPct = (s.PercentOmnivampMod ?? 0) * 100;

  out.critPct = clamp(out.critPct, 0, 100);
  out.armorPenPct = clamp(out.armorPenPct, 0, 100);
  out.magicPenPct = clamp(out.magicPenPct, 0, 100);

  return out;
}

function champAtLevel(ch: ChampionIndexRow | null, lvl: number) {
  if (!ch) return null;
  const L = clamp(lvl, 1, 18);

  const hp = ch.stats.hp + ch.stats.hpperlevel * (L - 1);
  const armor = ch.stats.armor + ch.stats.armorperlevel * (L - 1);
  const mr = ch.stats.spellblock + ch.stats.spellblockperlevel * (L - 1);

  const ad = ch.stats.attackdamage + ch.stats.attackdamageperlevel * (L - 1);

  const as = ch.stats.attackspeed * (1 + (ch.stats.attackspeedperlevel * (L - 1)) / 100);

  return { hp, armor, mr, ad, as };
}

type StatRow = {
  key: keyof FlatStats;
  label: string;
  a: number;
  b: number;
  d: number;
  suffix?: string;
  digits?: number;
};

type MobileTab = "inputs" | "results";

export default function LolItemCompareClient({
  champions,
  items,
  patch,
}: {
  champions: ChampionIndexRow[];
  items: ItemRow[];
  patch: string;
}) {
  const [champQuery, setChampQuery] = useState("");
  const [champId, setChampId] = useState(champions[0]?.id ?? "");
  const [level, setLevel] = useState(13);

  const [aQuery, setAQuery] = useState("");
  const [bQuery, setBQuery] = useState("");
  const [itemAId, setItemAId] = useState<string>("");
  const [itemBId, setItemBId] = useState<string>("");

  const [showAll, setShowAll] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("inputs");

  // ✅ Display patch: start with server prop, then refresh from live route
  const [displayPatch, setDisplayPatch] = useState<string>(patch);

  useEffect(() => {
    let cancelled = false;

    async function loadPatch() {
      try {
        // IMPORTANT: change this if your route is different
        const res = await fetch("/api/lol/patch", { cache: "no-store" });
        if (!res.ok) return;

        const json = (await res.json()) as {
          patch?: string;
          version?: string;
          ddragon?: string;
        };

        // Prefer display patch (26.x); fall back to version; finally keep existing
        const next = (json.patch ?? json.version ?? "").trim();
        if (!cancelled && next) setDisplayPatch(next);
      } catch {
        // ignore; keep server-provided patch
      }
    }

    loadPatch();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedChamp = useMemo(() => champions.find((c) => c.id === champId) ?? null, [champId, champions]);

  const champMatches = useMemo(() => {
    const q = champQuery.trim().toLowerCase();
    if (!q) return champions.slice(0, 5);
    return champions
      .filter((c) => (`${c.name} ${c.title ?? ""} ${(c.tags ?? []).join(" ")}`).toLowerCase().includes(q))
      .slice(0, 5);
  }, [champQuery, champions]);

  const champStats = useMemo(() => champAtLevel(selectedChamp, level), [selectedChamp, level]);

  const itemA = useMemo(() => items.find((it) => it.id === itemAId) ?? null, [items, itemAId]);
  const itemB = useMemo(() => items.find((it) => it.id === itemBId) ?? null, [items, itemBId]);

  const itemAMatches = useMemo(() => {
    const q = aQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return items.filter((it) => it.name.toLowerCase().includes(q)).slice(0, 8);
  }, [aQuery, items]);

  const itemBMatches = useMemo(() => {
    const q = bQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return items.filter((it) => it.name.toLowerCase().includes(q)).slice(0, 8);
  }, [bQuery, items]);

  const aStats = useMemo(() => parseItemStats(itemA), [itemA]);
  const bStats = useMemo(() => parseItemStats(itemB), [itemB]);

  const rows = useMemo(() => {
    const defs: Array<{ key: keyof FlatStats; label: string; suffix?: string; digits?: number }> = [
      { key: "ad", label: "AD", digits: 0 },
      { key: "ap", label: "AP", digits: 0 },
      { key: "hp", label: "HP", digits: 0 },
      { key: "armor", label: "Armor", digits: 0 },
      { key: "mr", label: "MR", digits: 0 },
      { key: "asPct", label: "Attack Speed", suffix: "%", digits: 0 },
      { key: "critPct", label: "Crit Chance", suffix: "%", digits: 0 },
      { key: "abilityHaste", label: "Ability Haste", digits: 0 },
      { key: "msFlat", label: "Move Speed", digits: 0 },
      { key: "lethality", label: "Lethality", digits: 0 },
      { key: "armorPenPct", label: "% Armor Pen", suffix: "%", digits: 0 },
      { key: "magicPenFlat", label: "Magic Pen", digits: 0 },
      { key: "magicPenPct", label: "% Magic Pen", suffix: "%", digits: 0 },
      { key: "lifestealPct", label: "Lifesteal", suffix: "%", digits: 0 },
      { key: "omnivampPct", label: "Omnivamp", suffix: "%", digits: 0 },
    ];

    const out: StatRow[] = defs.map((d) => {
      const a = aStats[d.key] ?? 0;
      const b = bStats[d.key] ?? 0;
      const delta = b - a;
      return { key: d.key, label: d.label, a, b, d: delta, suffix: d.suffix, digits: d.digits };
    });

    const filtered = out.filter((r) => (r.a ?? 0) !== 0 || (r.b ?? 0) !== 0);
    filtered.sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
    return filtered;
  }, [aStats, bStats]);

  const rowsToShow = useMemo(() => {
    if (showAll) return rows;
    return rows.slice(0, 7);
  }, [rows, showAll]);

  const eff = useMemo(() => {
    const base = champStats;
    if (!base) return null;

    const effA = {
      hp: base.hp + aStats.hp,
      armor: base.armor + aStats.armor,
      mr: base.mr + aStats.mr,
      ad: base.ad + aStats.ad,
      ap: aStats.ap,
      as: base.as * (1 + aStats.asPct / 100),
    };

    const effB = {
      hp: base.hp + bStats.hp,
      armor: base.armor + bStats.armor,
      mr: base.mr + bStats.mr,
      ad: base.ad + bStats.ad,
      ap: bStats.ap,
      as: base.as * (1 + bStats.asPct / 100),
    };

    return { base, effA, effB };
  }, [champStats, aStats, bStats]);

  const aBoxRef = useRef<HTMLDivElement | null>(null);
  const bBoxRef = useRef<HTMLDivElement | null>(null);

  const mobileInputsActive = mobileTab === "inputs";
  const mobileResultsActive = mobileTab === "results";

  return (
    <div className="text-white">
      {/* MOBILE: sticky tab header + normal page scrolling */}
      <div className="md:hidden -mx-6 px-6">
        <div className="sticky top-0 z-30 -mx-6 px-6 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
          <div className="flex items-center justify-between py-2">
            <div className="text-sm font-semibold">Item Compare</div>
            <div className="text-[10px] text-neutral-500">
              Patch: <span className="text-neutral-300 font-semibold">{displayPatch}</span>
            </div>
          </div>

          <div className="pb-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMobileTab("inputs")}
                className={`rounded-xl border px-3 py-2 text-[12px] font-semibold ${
                  mobileInputsActive
                    ? "border-neutral-600 bg-black text-white"
                    : "border-neutral-800 bg-neutral-950 text-neutral-300"
                }`}
              >
                Inputs
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("results")}
                className={`rounded-xl border px-3 py-2 text-[12px] font-semibold ${
                  mobileResultsActive
                    ? "border-neutral-600 bg-black text-white"
                    : "border-neutral-800 bg-neutral-950 text-neutral-300"
                }`}
              >
                Results
              </button>
            </div>

            <div className="mt-2 text-[10px] text-neutral-600">
              {champions.length} champs • {items.length} items
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
          {mobileInputsActive && (
            <section className="text-[11px] leading-tight">
              {/* Champion */}
              <div className="rounded-2xl border border-neutral-800 bg-black p-2">
                <div className="text-[10px] text-neutral-400 font-semibold">Champion</div>
                <input
                  value={champQuery}
                  onChange={(e) => setChampQuery(e.target.value)}
                  placeholder="Type champ…"
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-2 py-1.5 text-[12px] text-white outline-none focus:border-neutral-600"
                />

                <div className="mt-1 grid gap-1">
                  {champMatches.length === 0 ? (
                    <div className="rounded-xl border border-neutral-900 bg-black px-2 py-1.5 text-[11px] text-neutral-500">
                      No matches
                    </div>
                  ) : (
                    champMatches.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setChampId(c.id);
                          setChampQuery("");
                        }}
                        className={`w-full rounded-xl border px-2 py-1.5 text-left text-[12px] ${
                          c.id === champId
                            ? "border-neutral-600 bg-neutral-900 text-white"
                            : "border-neutral-900 bg-black text-neutral-200 hover:border-neutral-700"
                        }`}
                        title={c.title ?? ""}
                      >
                        <span className="font-semibold">{c.name}</span>
                        <span className="text-neutral-500"> {c.title ? `— ${c.title}` : ""}</span>
                      </button>
                    ))
                  )}
                </div>

                <div className="mt-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-neutral-400 font-semibold">Level</div>
                    <div className="text-[11px] text-neutral-200 font-semibold">{clamp(level, 1, 18)}</div>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={18}
                    value={clamp(level, 1, 18)}
                    onChange={(e) => setLevel(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                </div>

                {eff?.base && (
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    <div className="rounded-xl border border-neutral-900 bg-black px-2 py-1.5">
                      <div className="text-[10px] text-neutral-500">Base AD</div>
                      <div className="text-[12px] font-semibold">{fmt(eff.base.ad, 0)}</div>
                    </div>
                    <div className="rounded-xl border border-neutral-900 bg-black px-2 py-1.5">
                      <div className="text-[10px] text-neutral-500">Base AS</div>
                      <div className="text-[12px] font-semibold">{fmt(eff.base.as, 3)}</div>
                    </div>
                    <div className="rounded-xl border border-neutral-900 bg-black px-2 py-1.5">
                      <div className="text-[10px] text-neutral-500">Armor</div>
                      <div className="text-[12px] font-semibold">{fmt(eff.base.armor, 0)}</div>
                    </div>
                    <div className="rounded-xl border border-neutral-900 bg-black px-2 py-1.5">
                      <div className="text-[10px] text-neutral-500">MR</div>
                      <div className="text-[12px] font-semibold">{fmt(eff.base.mr, 0)}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-2 grid gap-2">
                <div ref={aBoxRef} className="rounded-2xl border border-neutral-800 bg-black p-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-neutral-400 font-semibold">Item A</div>
                    <button
                      type="button"
                      onClick={() => {
                        setItemAId("");
                        setAQuery("");
                      }}
                      className="text-[10px] text-neutral-500 hover:text-neutral-300"
                    >
                      Clear
                    </button>
                  </div>

                  <input
                    value={aQuery}
                    onChange={(e) => setAQuery(e.target.value)}
                    placeholder="Search item…"
                    className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-2 py-1.5 text-[12px] text-white outline-none focus:border-neutral-600"
                  />

                  {aQuery.trim().length >= 2 && itemAMatches.length > 0 && (
                    <div className="mt-1 grid gap-1">
                      {itemAMatches.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setItemAId(it.id);
                            setAQuery("");
                          }}
                          className="w-full rounded-xl border border-neutral-900 bg-black px-2 py-1.5 text-left text-[12px] text-neutral-200 hover:border-neutral-700"
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">{it.name}</span>
                            <span className="text-[10px] text-neutral-500">{it.gold ? `${it.gold}g` : ""}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-1 text-[11px] text-neutral-400 font-semibold truncate">
                    {itemA ? itemA.name : "—"}
                  </div>
                </div>

                <div ref={bBoxRef} className="rounded-2xl border border-neutral-800 bg-black p-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-neutral-400 font-semibold">Item B</div>
                    <button
                      type="button"
                      onClick={() => {
                        setItemBId("");
                        setBQuery("");
                      }}
                      className="text-[10px] text-neutral-500 hover:text-neutral-300"
                    >
                      Clear
                    </button>
                  </div>

                  <input
                    value={bQuery}
                    onChange={(e) => setBQuery(e.target.value)}
                    placeholder="Search item…"
                    className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-2 py-1.5 text-[12px] text-white outline-none focus:border-neutral-600"
                  />

                  {bQuery.trim().length >= 2 && itemBMatches.length > 0 && (
                    <div className="mt-1 grid gap-1">
                      {itemBMatches.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setItemBId(it.id);
                            setBQuery("");
                          }}
                          className="w-full rounded-xl border border-neutral-900 bg-black px-2 py-1.5 text-left text-[12px] text-neutral-200 hover:border-neutral-700"
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">{it.name}</span>
                            <span className="text-[10px] text-neutral-500">{it.gold ? `${it.gold}g` : ""}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-1 text-[11px] text-neutral-400 font-semibold truncate">
                    {itemB ? itemB.name : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-2 text-[10px] text-neutral-500">
                Patch: <span className="text-neutral-300 font-semibold">{displayPatch}</span>
              </div>
            </section>
          )}

          {mobileResultsActive && (
            <section className="text-[11px] leading-tight">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Results</div>
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="rounded-lg border border-neutral-800 bg-black px-2 py-1 text-[10px] text-neutral-200 hover:border-neutral-600"
                  title="Show more/less rows"
                >
                  {showAll ? "Less" : "More"}
                </button>
              </div>

              {eff ? (
                <div className="mt-2 rounded-2xl border border-neutral-800 bg-black p-2">
                  <div className="text-[10px] text-neutral-400 font-semibold">Effective stats (champ + item)</div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-neutral-900 bg-black px-2 py-1.5">
                      <div className="text-[10px] text-neutral-500 truncate">A: {itemA?.name ?? "—"}</div>
                      <div className="mt-1 grid gap-0.5 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-neutral-500">AD</span>
                          <span className="font-semibold">{fmt(eff.effA.ad, 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">AP</span>
                          <span className="font-semibold">{fmt(eff.effA.ap, 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">AS</span>
                          <span className="font-semibold">{fmt(eff.effA.as, 3)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Arm</span>
                          <span className="font-semibold">{fmt(eff.effA.armor, 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">MR</span>
                          <span className="font-semibold">{fmt(eff.effA.mr, 0)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-neutral-900 bg-black px-2 py-1.5">
                      <div className="text-[10px] text-neutral-500 truncate">B: {itemB?.name ?? "—"}</div>
                      <div className="mt-1 grid gap-0.5 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-neutral-500">AD</span>
                          <span className="font-semibold">{fmt(eff.effB.ad, 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">AP</span>
                          <span className="font-semibold">{fmt(eff.effB.ap, 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">AS</span>
                          <span className="font-semibold">{fmt(eff.effB.as, 3)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Arm</span>
                          <span className="font-semibold">{fmt(eff.effB.armor, 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">MR</span>
                          <span className="font-semibold">{fmt(eff.effB.mr, 0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-[10px] text-neutral-500">
                    Green = Item B better, Red = Item A better (for that stat).
                  </div>
                </div>
              ) : (
                <div className="mt-2 rounded-2xl border border-neutral-800 bg-black p-2 text-[11px] text-neutral-500">
                  Select a champion.
                </div>
              )}

              <div className="mt-2 rounded-2xl border border-neutral-800 bg-black p-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-neutral-400 font-semibold">Stat deltas (B − A)</div>
                  <div className="text-[10px] text-neutral-600">{rows.length} affected</div>
                </div>

                {rows.length === 0 ? (
                  <div className="mt-2 text-[11px] text-neutral-500">Pick Item A and Item B to see differences.</div>
                ) : (
                  <div className="mt-2 grid gap-1">
                    {rowsToShow.map((r) => {
                      const good = r.d > 0;
                      const bad = r.d < 0;

                      return (
                        <div key={String(r.key)} className="rounded-xl border border-neutral-900 bg-black px-2 py-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-neutral-300">{r.label}</span>
                            <span
                              className={`text-[11px] font-semibold ${
                                good ? "text-emerald-400" : bad ? "text-red-400" : "text-neutral-200"
                              }`}
                            >
                              {signFmt(r.d, r.digits ?? 0)}
                              {r.suffix ?? ""}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between text-[10px] text-neutral-600">
                            <span>
                              A: {fmt(r.a, r.digits ?? 0)}
                              {r.suffix ?? ""}
                            </span>
                            <span>
                              B: {fmt(r.b, r.digits ?? 0)}
                              {r.suffix ?? ""}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-2 text-[10px] text-neutral-500">
                Note: Unique passives/actives aren’t modeled here yet—this is core stat compare.
              </div>
            </section>
          )}
        </div>
      </div>

      {/* DESKTOP/TABLET (unchanged layout, just uses displayPatch for the label) */}
      <div className="hidden md:block">
        <div className="grid gap-6 md:grid-cols-2 md:items-start">
          <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Inputs</h2>
              <div className="text-xs text-neutral-500">
                Loaded <span className="text-neutral-300 font-semibold">{champions.length}</span> champs •{" "}
                <span className="text-neutral-300 font-semibold">{items.length}</span> items
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
              <div className="text-sm font-semibold">Champion</div>
              <div className="mt-2 text-xs text-neutral-500">Type to filter. Dropdown shows top 5 matches.</div>

              <input
                value={champQuery}
                onChange={(e) => setChampQuery(e.target.value)}
                placeholder="Search champion…"
                className="mt-3 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
              />

              <div className="mt-3 grid gap-2">
                {champMatches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setChampId(c.id);
                      setChampQuery("");
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                      c.id === champId
                        ? "border-neutral-600 bg-neutral-900 text-white"
                        : "border-neutral-800 bg-black text-neutral-200 hover:border-neutral-600"
                    }`}
                  >
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-neutral-500"> {c.title ? `— ${c.title}` : ""}</span>
                  </button>
                ))}
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-neutral-300">Level</label>
                  <span className="text-sm text-neutral-200 font-semibold">{clamp(level, 1, 18)}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={18}
                  value={clamp(level, 1, 18)}
                  onChange={(e) => setLevel(Number(e.target.value))}
                  className="mt-3 w-full"
                />
              </div>

              {eff?.base && (
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[
                    { k: "Base AD", v: fmt(eff.base.ad, 0) },
                    { k: "Base AS", v: fmt(eff.base.as, 3) },
                    { k: "Armor", v: fmt(eff.base.armor, 0) },
                    { k: "MR", v: fmt(eff.base.mr, 0) },
                  ].map((x) => (
                    <div key={x.k} className="rounded-xl border border-neutral-800 bg-black px-3 py-2">
                      <div className="text-xs text-neutral-500">{x.k}</div>
                      <div className="text-sm font-semibold">{x.v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-neutral-800 bg-black p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Item A</div>
                  <button
                    type="button"
                    onClick={() => {
                      setItemAId("");
                      setAQuery("");
                    }}
                    className="text-xs text-neutral-500 hover:text-neutral-300"
                  >
                    Clear
                  </button>
                </div>

                <input
                  value={aQuery}
                  onChange={(e) => setAQuery(e.target.value)}
                  placeholder="Search item (2+ letters)…"
                  className="mt-3 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                />

                <div className="mt-2 grid gap-2">
                  {aQuery.trim().length >= 2 &&
                    itemAMatches.map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => {
                          setItemAId(it.id);
                          setAQuery("");
                        }}
                        className="w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-left text-sm text-neutral-200 hover:border-neutral-600"
                      >
                        <div className="flex items-center justify-between">
                          <span>{it.name}</span>
                          <span className="text-xs text-neutral-500">{it.gold ? `${it.gold}g` : ""}</span>
                        </div>
                      </button>
                    ))}
                </div>

                <div className="mt-3 text-sm text-neutral-300 font-semibold truncate">{itemA?.name ?? "—"}</div>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-black p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Item B</div>
                  <button
                    type="button"
                    onClick={() => {
                      setItemBId("");
                      setBQuery("");
                    }}
                    className="text-xs text-neutral-500 hover:text-neutral-300"
                  >
                    Clear
                  </button>
                </div>

                <input
                  value={bQuery}
                  onChange={(e) => setBQuery(e.target.value)}
                  placeholder="Search item (2+ letters)…"
                  className="mt-3 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-white outline-none focus:border-neutral-600"
                />

                <div className="mt-2 grid gap-2">
                  {bQuery.trim().length >= 2 &&
                    itemBMatches.map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => {
                          setItemBId(it.id);
                          setBQuery("");
                        }}
                        className="w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-left text-sm text-neutral-200 hover:border-neutral-600"
                      >
                        <div className="flex items-center justify-between">
                          <span>{it.name}</span>
                          <span className="text-xs text-neutral-500">{it.gold ? `${it.gold}g` : ""}</span>
                        </div>
                      </button>
                    ))}
                </div>

                <div className="mt-3 text-sm text-neutral-300 font-semibold truncate">{itemB?.name ?? "—"}</div>
              </div>
            </div>

            <div className="mt-4 text-xs text-neutral-500">
              Patch: <span className="text-neutral-300 font-semibold">{displayPatch}</span>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Results</h2>
            </div>

            {eff ? (
              <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
                <div className="text-sm font-semibold">Effective stats (champ + item)</div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3">
                    <div className="text-xs text-neutral-500 truncate">A: {itemA?.name ?? "—"}</div>
                    <div className="mt-2 grid gap-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">AD</span>
                        <span className="font-semibold">{fmt(eff.effA.ad, 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">AP</span>
                        <span className="font-semibold">{fmt(eff.effA.ap, 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">AS</span>
                        <span className="font-semibold">{fmt(eff.effA.as, 3)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Armor</span>
                        <span className="font-semibold">{fmt(eff.effA.armor, 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">MR</span>
                        <span className="font-semibold">{fmt(eff.effA.mr, 0)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3">
                    <div className="text-xs text-neutral-500 truncate">B: {itemB?.name ?? "—"}</div>
                    <div className="mt-2 grid gap-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">AD</span>
                        <span className="font-semibold">{fmt(eff.effB.ad, 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">AP</span>
                        <span className="font-semibold">{fmt(eff.effB.ap, 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">AS</span>
                        <span className="font-semibold">{fmt(eff.effB.as, 3)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Armor</span>
                        <span className="font-semibold">{fmt(eff.effB.armor, 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">MR</span>
                        <span className="font-semibold">{fmt(eff.effB.mr, 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-neutral-500">
                  Green = Item B better, Red = Item A better (for that stat).
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4 text-sm text-neutral-500">
                Select a champion.
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-neutral-800 bg-black p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Stat deltas (B − A)</div>
                <div className="text-xs text-neutral-500">{rows.length} affected</div>
              </div>

              {rows.length === 0 ? (
                <div className="mt-3 text-sm text-neutral-500">Pick Item A and Item B to see differences.</div>
              ) : (
                <div className="mt-4 grid gap-2">
                  {(showAll ? rows : rows.slice(0, 10)).map((r) => {
                    const good = r.d > 0;
                    const bad = r.d < 0;
                    return (
                      <div key={String(r.key)} className="rounded-xl border border-neutral-800 bg-black px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-neutral-300">{r.label}</div>
                          <div
                            className={`text-sm font-semibold ${
                              good ? "text-emerald-400" : bad ? "text-red-400" : "text-neutral-200"
                            }`}
                          >
                            {signFmt(r.d, r.digits ?? 0)}
                            {r.suffix ?? ""}
                          </div>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
                          <span>
                            A: {fmt(r.a, r.digits ?? 0)}
                            {r.suffix ?? ""}
                          </span>
                          <span>
                            B: {fmt(r.b, r.digits ?? 0)}
                            {r.suffix ?? ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 text-xs text-neutral-500">
              Note: Unique passives/actives aren’t modeled here yet—this is core stat compare.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}