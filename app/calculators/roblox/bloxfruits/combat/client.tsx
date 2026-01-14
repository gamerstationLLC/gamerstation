"use client";

import { useEffect, useMemo, useState } from "react";

type ItemType = "fruit" | "sword" | "gun" | "accessory" | "material" | "other";

type BloxItem = {
  id: string;
  name: string;
  type: ItemType;
  buffs?: {
    damagePct?: number;   // +% damage
    defensePct?: number;  // +% defense (shown, not used in DPS)
    speedPct?: number;    // +% move speed (shown)
    energyPct?: number;   // +% energy/regen (shown)
    cooldownPct?: number; // -% cooldown (optional: can bump hit rate a bit)
    xpPct?: number;       // +% xp (not used here)
  };
  source?: { wikiPage?: string };
};

type Mode = "pve" | "pvp";
type Primary = "fruit" | "sword" | "gun" | "style";

type Tab = "inputs" | "results";

function fmt(n: number, digits = 1) {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function toNum(s: string) {
  const t = s.trim();
  if (t === "") return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function percentToMult(pct: number | undefined) {
  const p = typeof pct === "number" && Number.isFinite(pct) ? pct : 0;
  return 1 + p / 100;
}

/**
 * Optional: very small effect for cooldown reduction on "hits/sec"
 * We keep this conservative so we don't lie with fake precision.
 */
function cooldownToRateMult(cooldownPct?: number) {
  const c = typeof cooldownPct === "number" && Number.isFinite(cooldownPct) ? cooldownPct : 0;
  const mult = 1 / (1 - clamp(c / 100, 0, 0.5)); // cap at 50% reduction
  return Number.isFinite(mult) ? mult : 1;
}

const DEFAULT_STYLES = [
  "Godhuman",
  "Sharkman Karate",
  "Electric Claw",
  "Dragon Talon",
  "Death Step",
  "Superhuman",
  "Sanguine Art",
];

export default function BloxFruitsCombatClient() {
  const [items, setItems] = useState<BloxItem[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Tabs (mobile)
  const [tab, setTab] = useState<Tab>("inputs");

  // Core components
  const [mode, setMode] = useState<Mode>("pve");
  const [primary, setPrimary] = useState<Primary>("fruit");

  const [fruitId, setFruitId] = useState("");
  const [swordId, setSwordId] = useState("");
  const [gunId, setGunId] = useState("");

  // Fighting style (not in your json yet, so we offer a dropdown + custom input)
  const [styleName, setStyleName] = useState(DEFAULT_STYLES[0]);
  const [customStyle, setCustomStyle] = useState("");

  const [accessoryId, setAccessoryId] = useState("");

  // Stats distribution (strings so you can delete input)
  const [statMelee, setStatMelee] = useState("0");
  const [statSword, setStatSword] = useState("0");
  const [statGun, setStatGun] = useState("0");
  const [statFruit, setStatFruit] = useState("0");

  // Combat knobs (v1 transparent math)
  const [targetHp, setTargetHp] = useState("100000");
  const [baseDamagePerHit, setBaseDamagePerHit] = useState("5000");
  const [hitsPerSecond, setHitsPerSecond] = useState("2");

  // Load items json (client-side, no server load)
  useEffect(() => {
    let alive = true;

    fetch("/data/roblox/bloxfruits/items.v2.json", { cache: "force-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`items.json failed (${r.status})`);
        return r.json();
      })
      .then((d) => {
        if (!alive) return;
        setItems(Array.isArray(d) ? (d as BloxItem[]) : []);
        setLoadErr(null);
      })
      .catch((e) => {
        if (!alive) return;
        setLoadErr(e?.message ?? "Failed to load item data");
        setItems([]);
      });

    return () => {
      alive = false;
    };
  }, []);

  // Derived lists
  const fruits = useMemo(() => items.filter((x) => x.type === "fruit"), [items]);
  const swords = useMemo(() => items.filter((x) => x.type === "sword"), [items]);
  const guns = useMemo(() => items.filter((x) => x.type === "gun"), [items]);
  const accessories = useMemo(() => items.filter((x) => x.type === "accessory"), [items]);

  const selectedFruit = useMemo(() => fruits.find((x) => x.id === fruitId) ?? null, [fruits, fruitId]);
  const selectedSword = useMemo(() => swords.find((x) => x.id === swordId) ?? null, [swords, swordId]);
  const selectedGun = useMemo(() => guns.find((x) => x.id === gunId) ?? null, [guns, gunId]);
  const selectedAccessory = useMemo(
    () => accessories.find((x) => x.id === accessoryId) ?? null,
    [accessories, accessoryId]
  );

  const activeStyle = (customStyle.trim() ? customStyle.trim() : styleName).slice(0, 40);

  // Stats used (only the relevant one matters based on primary)
  const relevantStat = useMemo(() => {
    const melee = toNum(statMelee);
    const sword = toNum(statSword);
    const gun = toNum(statGun);
    const fruit = toNum(statFruit);

    if (primary === "style") return Number.isFinite(melee) ? melee : 0;
    if (primary === "sword") return Number.isFinite(sword) ? sword : 0;
    if (primary === "gun") return Number.isFinite(gun) ? gun : 0;
    return Number.isFinite(fruit) ? fruit : 0;
  }, [primary, statMelee, statSword, statGun, statFruit]);

  // Simple, transparent scaling:
  // - base damage * (1 + relevantStat / 5000)  (tunable)
  // - accessory damagePct applies multiplicatively
  // - optional cooldownPct slightly increases hit rate (capped)
  const dmg = useMemo(() => {
    const base = toNum(baseDamagePerHit);
    if (!Number.isFinite(base) || base <= 0) return 0;

    const statMult = 1 + clamp(relevantStat / 5000, 0, 1.5); // cap at +150%
    const accMult = percentToMult(selectedAccessory?.buffs?.damagePct);

    return base * statMult * accMult;
  }, [baseDamagePerHit, relevantStat, selectedAccessory]);

  const rate = useMemo(() => {
    const hps = toNum(hitsPerSecond);
    if (!Number.isFinite(hps) || hps <= 0) return 0;

    const cdMult = cooldownToRateMult(selectedAccessory?.buffs?.cooldownPct);
    return hps * cdMult;
  }, [hitsPerSecond, selectedAccessory]);

  const dps = useMemo(() => {
    if (dmg <= 0 || rate <= 0) return 0;
    return dmg * rate;
  }, [dmg, rate]);

  const ttkSeconds = useMemo(() => {
    const hp = toNum(targetHp);
    if (!Number.isFinite(hp) || hp <= 0 || dps <= 0) return 0;
    return hp / dps;
  }, [targetHp, dps]);

  const primaryLabel = useMemo(() => {
    if (primary === "fruit") return selectedFruit?.name || "—";
    if (primary === "sword") return selectedSword?.name || "—";
    if (primary === "gun") return selectedGun?.name || "—";
    return activeStyle || "—";
  }, [primary, selectedFruit, selectedSword, selectedGun, activeStyle]);

  // Small helper UI pieces
  function TabButton({ id, label }: { id: Tab; label: string }) {
    const active = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        className={[
          "flex-1 rounded-xl px-3 py-2 text-sm border transition",
          active
            ? "border-neutral-500 bg-neutral-900 text-white"
            : "border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-600",
        ].join(" ")}
      >
        {label}
      </button>
    );
  }

  const ResultsPanel = (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="text-sm font-semibold">Results</div>

      <div className="mt-5 grid gap-3">
        <div className="rounded-xl border border-neutral-800 bg-black p-4">
          <div className="text-xs text-neutral-500">Build</div>
          <div className="mt-1 text-base font-semibold">
            {mode.toUpperCase()} • Primary: {primary === "style" ? "Fighting Style" : primary[0].toUpperCase() + primary.slice(1)}
          </div>
          <div className="mt-1 text-sm text-neutral-400">{primaryLabel}</div>
          <div className="mt-2 text-xs text-neutral-500">
            Fruit: {selectedFruit?.name || "—"} • Sword: {selectedSword?.name || "—"} • Gun:{" "}
            {selectedGun?.name || "—"} • Style: {activeStyle || "—"} • Accessory:{" "}
            {selectedAccessory?.name || "—"}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black p-4">
          <div className="text-xs text-neutral-500">Effective damage per hit</div>
          <div className="mt-1 text-2xl font-bold">{dmg > 0 ? fmt(dmg, 0) : "—"}</div>
          <div className="mt-1 text-xs text-neutral-500">Base × (1 + relevantStat/5000) × accessory damage%</div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black p-4">
          <div className="text-xs text-neutral-500">Effective hits per second</div>
          <div className="mt-1 text-2xl font-bold">{rate > 0 ? fmt(rate, 2) : "—"}</div>
          <div className="mt-1 text-xs text-neutral-500">Hits/sec × (cooldown reduction effect, capped)</div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black p-4">
          <div className="text-xs text-neutral-500">DPS</div>
          <div className="mt-1 text-2xl font-bold">{dps > 0 ? fmt(dps, 0) : "—"}</div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black p-4">
          <div className="text-xs text-neutral-500">Time-to-kill</div>
          <div className="mt-1 text-2xl font-bold">{ttkSeconds > 0 ? `${fmt(ttkSeconds, 1)}s` : "—"}</div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-black p-4">
          <div className="text-xs text-neutral-500">Accessory buffs</div>
          {selectedAccessory?.buffs ? (
            <ul className="mt-2 space-y-1 text-sm text-neutral-300">
              {Object.entries(selectedAccessory.buffs).map(([k, v]) => (
                <li key={k}>
                  <span className="text-neutral-400">{k}:</span> {v}%
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-2 text-sm text-neutral-400">—</div>
          )}
        </div>
      </div>

      <div className="mt-4 text-xs text-neutral-500">
        Next step: once you decide the “official v1 model” (how fruit/sword/gun/style scale),
        we replace base damage/hit rate with real per-item defaults.
      </div>
    </div>
  );

  const InputsPanel = (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="text-sm font-semibold">Inputs</div>
      <div className="mt-2 text-sm text-neutral-400">
        V1 uses transparent inputs (base damage + hit rate) and applies your selected stats/accessory buffs.
      </div>

      {loadErr && (
        <div className="mt-4 rounded-xl border border-neutral-800 bg-black p-3 text-sm text-red-300">
          {loadErr}. (You can still use manual damage inputs below.)
        </div>
      )}

      {/* PvE / PvP */}
      <div className="mt-5 flex flex-wrap gap-2">
        {(["pve", "pvp"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={[
              "rounded-xl px-3 py-2 text-sm border transition",
              mode === m
                ? "border-neutral-500 bg-neutral-900 text-white"
                : "border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-600",
            ].join(" ")}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Primary damage source */}
      <div className="mt-4">
        <div className="text-sm text-neutral-300">Primary damage source</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["fruit", "sword", "gun", "style"] as Primary[]).map((p) => (
            <button
              key={p}
              onClick={() => setPrimary(p)}
              className={[
                "rounded-xl px-3 py-2 text-sm border transition",
                primary === p
                  ? "border-neutral-500 bg-neutral-900 text-white"
                  : "border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-600",
              ].join(" ")}
            >
              {p === "style" ? "Fighting Style" : p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Pickers */}
      <div className="mt-5 grid gap-3">
        <label className="text-sm text-neutral-300">
          Fruit
          <select
            value={fruitId}
            onChange={(e) => setFruitId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
          >
            <option value="">— Select fruit —</option>
            {fruits.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-neutral-300">
          Sword
          <select
            value={swordId}
            onChange={(e) => setSwordId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
          >
            <option value="">— Select sword —</option>
            {swords.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-neutral-300">
          Gun
          <select
            value={gunId}
            onChange={(e) => setGunId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
          >
            <option value="">— Select gun —</option>
            {guns.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name}
              </option>
            ))}
          </select>
        </label>

        {/* Fighting style */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-neutral-300">
            Fighting style
            <select
              value={styleName}
              onChange={(e) => setStyleName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
            >
              {DEFAULT_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-neutral-300">
            Custom style (optional)
            <input
              value={customStyle}
              onChange={(e) => setCustomStyle(e.target.value)}
              placeholder="Type a style name…"
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
            />
          </label>
        </div>

        <label className="text-sm text-neutral-300">
          Accessory
          <select
            value={accessoryId}
            onChange={(e) => setAccessoryId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
          >
            <option value="">— None —</option>
            {accessories.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Stats */}
      <div className="mt-6">
        <div className="text-sm font-semibold">Stats</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-neutral-300">
            Melee
            <input
              type="number"
              inputMode="numeric"
              value={statMelee}
              onChange={(e) => setStatMelee(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
            />
          </label>

          <label className="text-sm text-neutral-300">
            Sword
            <input
              type="number"
              inputMode="numeric"
              value={statSword}
              onChange={(e) => setStatSword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
            />
          </label>

          <label className="text-sm text-neutral-300">
            Gun
            <input
              type="number"
              inputMode="numeric"
              value={statGun}
              onChange={(e) => setStatGun(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
            />
          </label>

          <label className="text-sm text-neutral-300">
            Fruit
            <input
              type="number"
              inputMode="numeric"
              value={statFruit}
              onChange={(e) => setStatFruit(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
            />
          </label>
        </div>

        <div className="mt-2 text-xs text-neutral-500">
          For v1, we use the relevant stat based on your Primary selection.
        </div>
      </div>

      {/* Transparent combat knobs */}
      <div className="mt-6">
        <div className="text-sm font-semibold">Combat Inputs (v1)</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-neutral-300">
            Base damage per hit
            <input
              type="number"
              inputMode="numeric"
              value={baseDamagePerHit}
              onChange={(e) => setBaseDamagePerHit(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
            />
          </label>

          <label className="text-sm text-neutral-300">
            Hits per second
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={hitsPerSecond}
              onChange={(e) => setHitsPerSecond(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
            />
          </label>

          <label className="text-sm text-neutral-300 sm:col-span-2">
            Target HP
            <input
              type="number"
              inputMode="numeric"
              value={targetHp}
              onChange={(e) => setTargetHp(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
            />
          </label>
        </div>

        <div className="mt-2 text-xs text-neutral-500">
          These keep the calculator honest while we decide the exact scaling rules for each fruit/weapon/style.
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {/* Mobile tabs header (sticky at top) */}
      <div className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur md:hidden">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex gap-2">
            <TabButton id="inputs" label="Inputs" />
            <TabButton id="results" label="Results" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 pb-24 md:pb-0">
        {/* Desktop: 2-col. Mobile: tabbed */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Inputs */}
          <div className={["md:block", tab === "inputs" ? "block" : "hidden md:block"].join(" ")}>
            {InputsPanel}
          </div>

          {/* Results */}
          <div className={["md:block", tab === "results" ? "block" : "hidden md:block"].join(" ")}>
            {ResultsPanel}
          </div>
        </div>
      </div>

      {/* Sticky results footer (mobile only) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur md:hidden">
        <button
          onClick={() => setTab("results")}
          className="w-full"
          aria-label="Open Results"
        >
          <div className="mx-auto max-w-6xl px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-neutral-400">Quick Results</div>
                <div className="truncate text-sm font-semibold text-white">
                  DPS: {dps > 0 ? fmt(dps, 0) : "—"} • TTK: {ttkSeconds > 0 ? `${fmt(ttkSeconds, 1)}s` : "—"}
                </div>
              </div>

              <div className="shrink-0 rounded-xl border border-neutral-800 bg-black px-3 py-2 text-xs text-neutral-300">
                View
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
