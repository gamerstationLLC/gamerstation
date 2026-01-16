"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type { CodWeaponRow } from "@/lib/codweapons";
import { type CodAttachmentRow } from "@/lib/codattachments";

/**
 * attachments_global columns:
 * attachment_id, attachment_name, slot, applies_to, dmg10_add, dmg25_add, dmg50_add
 *
 * ✅ This client assumes your weapons CSV provides:
 * weapon_id, weapon_name, weapon_type, rpm, headshot_mult, fire_mode, dmg10, dmg25, dmg50
 */

type WeaponClass = "assault_rifles" | "smg" | "lmg";

const COD_CLASSES: { value: WeaponClass; label: string }[] = [
  { value: "assault_rifles", label: "Assault Rifles" },
  { value: "smg", label: "SMGs" },
  { value: "lmg", label: "LMGs" },
];

type UIWeapon = {
  id: string; // weapon_id
  name: string;
  rpm: number;
  headshot_mult: number;
  fire_mode?: string;
  weapon_type?: string;

  // ✅ flat dmg buckets from CSV
  dmg10: number;
  dmg25: number;
  dmg50: number;
};

type UIAttachment = {
  id: string;
  name: string;
  slot: string;
  applies_to: string; // can be weapon_id, "all", or CSV of ids
  dmg10_add: number;
  dmg25_add: number;
  dmg50_add: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function fmtMs(n: number) {
  if (!isFinite(n)) return "—";
  return `${Math.round(n)} ms`;
}

function fmt(n: number, digits = 2) {
  if (!isFinite(n)) return "—";
  return n.toFixed(digits);
}

function toNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeTypeToClass(t: string): WeaponClass | null {
  const s = (t || "").trim().toLowerCase();
  if (s.includes("assault")) return "assault_rifles";
  if (s.includes("smg")) return "smg";
  if (s.includes("lmg")) return "lmg";
  return null;
}

// Normalize for matching query -> weapon names
function norm(s: string) {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s\-]/g, "");
}

// ✅ uses flat dmg buckets (10/25/50) instead of a damage_profile array
function damageAtMeters(weapon: UIWeapon | undefined, meters: number) {
  if (!weapon) return 0;
  if (meters <= 10) return toNum(weapon.dmg10);
  if (meters <= 25) return toNum(weapon.dmg25);
  return toNum(weapon.dmg50);
}

// your simplified distance buckets (used for barrel adds)
function bucketForDistance(meters: number): "dmg10" | "dmg25" | "dmg50" {
  if (meters <= 10) return "dmg10";
  if (meters <= 25) return "dmg25";
  return "dmg50";
}

type RangeKey = "r10" | "r25" | "r50" | "rMax";
const RANGES: { key: RangeKey; label: string; meters: number }[] = [
  { key: "r10", label: "0–10m", meters: 10 },
  { key: "r25", label: "10–25m", meters: 25 },
  { key: "r50", label: "25–50m", meters: 50 },
  { key: "rMax", label: "50m+", meters: 999 },
];

export default function CodTtkClient({
  sheetWeapons,
  sheetAttachments = [],
}: {
  sheetWeapons: CodWeaponRow[];
  sheetAttachments?: CodAttachmentRow[];
}) {
  const searchParams = useSearchParams();

  const [weaponClass, setWeaponClass] = useState<WeaponClass>("smg");

  // ✅ MOBILE ONLY tab state
  const [mobileTab, setMobileTab] = useState<"inputs" | "results">("inputs");

  // ✅ NEW: hit-zone toggle (torso default)
  const [hitZone, setHitZone] = useState<"torso" | "headshots">("torso");

  // ✅ Build a full lookup across ALL weapons (unfiltered)
  const allWeaponLookup = useMemo(() => {
    const rows = sheetWeapons ?? [];
    return rows
      .map((w: any) => {
        const id = String(w.weapon_id ?? "").trim();
        const name = String(w.weapon_name ?? "").trim();
        const cls = normalizeTypeToClass(String(w.weapon_type ?? ""));
        if (!id || !name || !cls) return null;

        return {
          id,
          name,
          cls,
          nameNorm: norm(name),
          idNorm: norm(id),
        };
      })
      .filter(Boolean) as { id: string; name: string; cls: WeaponClass; nameNorm: string; idNorm: string }[];
  }, [sheetWeapons]);

  // ✅ map sheet rows -> UIWeapon (expects dmg10/dmg25/dmg50 on each row)
  const weapons: UIWeapon[] = useMemo(() => {
    const wanted = weaponClass;

    return (sheetWeapons ?? [])
      .filter((w: any) => normalizeTypeToClass(w.weapon_type) === wanted)
      .map((w: any) => {
        const id = String(w.weapon_id ?? "").trim();
        if (!id) return null;

        return {
          id,
          name: String(w.weapon_name ?? "").trim() || id,
          rpm: toNum(w.rpm),
          headshot_mult: toNum(w.headshot_mult) || 1,
          fire_mode: w.fire_mode,
          weapon_type: w.weapon_type,

          // ✅ damage buckets from CSV
          dmg10: toNum((w as any).dmg10),
          dmg25: toNum((w as any).dmg25),
          dmg50: toNum((w as any).dmg50),
        };
      })
      .filter(Boolean) as UIWeapon[];
  }, [sheetWeapons, weaponClass]);

  const [weaponId, setWeaponId] = useState<string>("");

  // ✅ Apply deep-link only once
  const appliedDeepLinkRef = useRef(false);

  useEffect(() => {
    if (appliedDeepLinkRef.current) return;

    const weaponParamRaw = searchParams.get("weapon") || "";
    const weaponIdRaw = searchParams.get("weaponId") || "";

    const weaponParam = norm(weaponParamRaw);
    const weaponIdParam = norm(weaponIdRaw);

    if (!weaponParam && !weaponIdParam) return;
    if (allWeaponLookup.length === 0) return;

    // Try match by weaponId first (if provided), else by name
    let match =
      (weaponIdParam
        ? allWeaponLookup.find((w) => w.idNorm === weaponIdParam)
        : null) ||
      (weaponParam
        ? allWeaponLookup.find((w) => w.nameNorm === weaponParam) ||
          allWeaponLookup.find((w) => w.nameNorm.includes(weaponParam)) ||
          allWeaponLookup.find((w) => weaponParam.includes(w.nameNorm))
        : null);

    if (!match) return;

    appliedDeepLinkRef.current = true;

    // Set class first so the weapon appears in the filtered dropdown
    setWeaponClass(match.cls);

    // Then set weapon id
    setWeaponId(match.id);

    // (Optional UX) jump to results on mobile if desired:
    // setMobileTab("results");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, allWeaponLookup.length]);

  useEffect(() => {
    if (appliedDeepLinkRef.current) return;
    if (weapons.length === 0) {
      setWeaponId("");
      return;
    }
    if (!weapons.some((w) => w.id === weaponId)) {
      setWeaponId(weapons[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weaponClass, weapons.length]);

  const selected = useMemo(
    () => weapons.find((w) => w.id === weaponId) ?? weapons[0],
    [weapons, weaponId]
  );

  const attachments: UIAttachment[] = useMemo(() => {
    return (sheetAttachments ?? []).map((a: any) => ({
      id: String(a.attachment_id ?? "").trim(),
      name: String(a.attachment_name ?? "").trim(),
      slot: String(a.slot ?? "").trim(),
      applies_to: String(a.applies_to ?? "").trim(),
      dmg10_add: toNum(a.dmg10_add),
      dmg25_add: toNum(a.dmg25_add),
      dmg50_add: toNum(a.dmg50_add),
    }));
  }, [sheetAttachments]);

  // ✅ barrels match by weapon_id (selected.id) <-> applies_to
  const barrels = useMemo(() => {
    const wid = String(selected?.id ?? "").trim().toLowerCase();
    if (!wid) return [];

    return attachments.filter((a) => {
      const slot = String(a.slot ?? "").trim().toLowerCase();
      if (slot !== "barrel") return false;

      const applies = String(a.applies_to ?? "")
        .toLowerCase()
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      return applies.includes("all") || applies.includes(wid);
    });
  }, [attachments, selected?.id]);

  const [barrelId, setBarrelId] = useState<string>("");

  // prevent holding an invalid barrel ID when switching weapons
  useEffect(() => {
    if (appliedDeepLinkRef.current) return;
    setBarrelId("");
  }, [selected?.id]);

  const selectedBarrel = useMemo(
    () => barrels.find((b) => b.id === barrelId),
    [barrels, barrelId]
  );

  // Mode + plates
  const [mode, setMode] = useState<"mp" | "wz">("mp");
  const [plates, setPlates] = useState<number>(3);

  // ACCURACY: string state so iOS users can delete/backspace normally
  const [accuracyStr, setAccuracyStr] = useState<string>("100");

  // Editable overrides (RPM only)
  const [rpmOverride, setRpmOverride] = useState<number | "">("");

  const baseHp = 100;
  const armorHp = mode === "wz" ? clamp(plates, 0, 3) * 50 : 0;
  const totalHp = baseHp + armorHp;

  const rpm =
    rpmOverride === "" ? selected?.rpm ?? 0 : clamp(Number(rpmOverride), 1, 3000);

  const shotsPerSecond = rpm / 60;
  const sheetHsm = selected?.headshot_mult ?? 1.0;

  // convert accuracy string to number only for math
  const accuracyNumRaw = accuracyStr === "" ? 0 : Number(accuracyStr);
  const accuracyNum = clamp(
    Number.isFinite(accuracyNumRaw) ? accuracyNumRaw : 0,
    1,
    100
  );
  const acc = accuracyNum / 100;

  // ✅ per-range calc (torso default, headshots toggled)
  const rangeResults = useMemo(() => {
    return RANGES.map((r) => {
      const meters = r.meters;

      // base damage from sheet (bucketed)
      const sheetDmg = damageAtMeters(selected, meters);

      // barrel adds by distance bucket
      const bucket = bucketForDistance(meters);
      const barrelAdd =
        bucket === "dmg10"
          ? selectedBarrel?.dmg10_add ?? 0
          : bucket === "dmg25"
          ? selectedBarrel?.dmg25_add ?? 0
          : selectedBarrel?.dmg50_add ?? 0;

      const basePlusAdds = Math.max(0, sheetDmg + barrelAdd);

      // ✅ torso = base damage; headshots = apply headshot mult
      const dmg =
        hitZone === "headshots"
          ? basePlusAdds * clamp(sheetHsm, 1, 5)
          : basePlusAdds;

      const shotsToKill = dmg > 0 ? Math.ceil(totalHp / dmg) : 0;

      const ttkMs =
        shotsToKill > 0 && shotsPerSecond > 0
          ? ((shotsToKill - 1) / shotsPerSecond) * 1000
          : NaN;

      const effectiveShots = shotsToKill > 0 ? Math.ceil(shotsToKill / acc) : 0;

      const ttkMsWithAccuracy =
        effectiveShots > 0 && shotsPerSecond > 0
          ? ((effectiveShots - 1) / shotsPerSecond) * 1000
          : NaN;

      return {
        key: r.key,
        label: r.label,
        meters,
        bucket,
        barrelAdd,
        sheetDmg,
        basePlusAdds,
        dmg,
        shotsToKill,
        ttkMs,
        ttkMsWithAccuracy,
      };
    });
  }, [selected, selectedBarrel, hitZone, sheetHsm, totalHp, shotsPerSecond, acc]);

  // ✅ sticky bottom bar display (prefer accuracy TTK if user set < 100)
  const showAccTtk = accuracyStr !== "" && Number(accuracyStr) < 100;

  return (
    <main
      className="
        min-h-screen bg-black text-white px-6
        pt-10 pb-[calc(92px+env(safe-area-inset-bottom))]
        lg:py-10
      "
    >
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <Link
            href="/games/cod"
            className="text-sm text-neutral-300 hover:text-white"
          >
            ← Back to Call of Duty
          </Link>
          <div className="text-sm text-neutral-400">Call of Duty • TTK</div>
        </header>

        <div className="mt-8">
          <h1 className="text-4xl font-bold tracking-tight">
            COD TTK Calculator
          </h1>
          <p className="mt-3 text-neutral-300 max-w-2xl">
            Pick a weapon, choose Multiplayer or Warzone plates, and get
            shots-to-kill + time-to-kill.
          </p>
          <div className="mt-4 italic text-[11px] text-neutral-400">
            Damage values are modeled in tiered ranges and may be approximations.
          </div>
        </div>

        {/* ✅ MOBILE ONLY: sticky Inputs/Results tabs */}
        <div className="lg:hidden sticky top-0 z-40 -mx-6 mt-6 px-6">
          <div className="rounded-2xl border border-neutral-800 bg-black/70 backdrop-blur">
            <div className="flex gap-2 p-2">
              <button
                type="button"
                onClick={() => setMobileTab("inputs")}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
                  mobileTab === "inputs"
                    ? "bg-white/10 text-white"
                    : "bg-transparent text-neutral-300 hover:bg-white/5"
                }`}
              >
                Inputs
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("results")}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
                  mobileTab === "results"
                    ? "bg-white/10 text-white"
                    : "bg-transparent text-neutral-300 hover:bg-white/5"
                }`}
              >
                Results
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Inputs */}
          <section
            className={`rounded-2xl border border-neutral-800 bg-neutral-950 p-6 ${
              mobileTab === "inputs" ? "block" : "hidden"
            } lg:block`}
          >
            <div className="text-sm font-semibold">Inputs</div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <div className="text-xs text-neutral-400">Mode</div>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as "mp" | "wz")}
                  className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                >
                  <option value="mp">Multiplayer (100 HP)</option>
                  <option value="wz">Warzone (100 HP + plates)</option>
                </select>
              </label>

              <label className="block">
                <div className="text-xs text-neutral-400">Plates (Warzone)</div>
                <select
                  value={plates}
                  onChange={(e) => setPlates(Number(e.target.value))}
                  disabled={mode !== "wz"}
                  className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none disabled:opacity-50 focus:border-neutral-600"
                >
                  <option value={0}>0 (100 total HP)</option>
                  <option value={1}>1 (150 total HP)</option>
                  <option value={2}>2 (200 total HP)</option>
                  <option value={3}>3 (250 total HP)</option>
                </select>
              </label>

              <label className="block">
                <div className="text-xs text-neutral-400">Weapon class</div>
                <select
                  value={weaponClass}
                  onChange={(e) => setWeaponClass(e.target.value as WeaponClass)}
                  className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                >
                  {COD_CLASSES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="text-xs text-neutral-400">Weapon</div>
                <select
                  value={weaponId}
                  onChange={(e) => setWeaponId(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                >
                  {weapons.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Attachments */}
            <div className="mt-6 rounded-2xl border border-neutral-800 bg-black/40 p-4">
              <div className="text-sm font-semibold">Attachments</div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <div className="text-xs text-neutral-400">Barrel</div>
                  <select
                    value={barrelId}
                    onChange={(e) => setBarrelId(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                  >
                    <option value="">None</option>
                    {barrels.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    Note: Barrels only. Other attachments typically have no effect on TTK.
                  </div>

                  <div className="mt-1 text-[11px] text-neutral-500">
                    Only barrels that affect damage ranges and TTK are included in this calculator.
                  </div>
                </label>

                {/* ✅ Minimal replacement: show adds for each bucket instead of one */}
                <div className="rounded-xl border border-neutral-800 bg-black/40 p-3">
                  <div className="text-xs text-neutral-400">Barrel adds</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-neutral-300">
                    <div className="flex items-center justify-between rounded-md border border-neutral-800 bg-black/30 px-2 py-1">
                      <span className="opacity-70">0–10m</span>
                      <span className="font-semibold tabular-nums">
                        +{selectedBarrel?.dmg10_add ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-neutral-800 bg-black/30 px-2 py-1">
                      <span className="opacity-70">10–25m</span>
                      <span className="font-semibold tabular-nums">
                        +{selectedBarrel?.dmg25_add ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-neutral-800 bg-black/30 px-2 py-1">
                      <span className="opacity-70">25m+</span>
                      <span className="font-semibold tabular-nums">
                        +{selectedBarrel?.dmg50_add ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <label className="block">
                <div className="text-xs text-neutral-400">Accuracy (%)</div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={accuracyStr}
                  onChange={(e) => {
                    const val = e.target.value;

                    if (val === "") {
                      setAccuracyStr("");
                      return;
                    }

                    if (/^\d{0,3}$/.test(val)) {
                      const asNum = Number(val);
                      if (Number.isFinite(asNum) && asNum <= 100)
                        setAccuracyStr(val);
                      else if (val.length <= 2) setAccuracyStr(val);
                    }
                  }}
                  className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                  placeholder="100"
                />

                {/* ✅ NEW: tiny toggle buttons right under Accuracy */}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setHitZone("torso")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${
                      hitZone === "torso"
                        ? "border-neutral-600 bg-white/10 text-white"
                        : "border-neutral-800 bg-black/40 text-neutral-300 hover:bg-white/5"
                    }`}
                  >
                    Torso
                  </button>
                  <button
                    type="button"
                    onClick={() => setHitZone("headshots")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${
                      hitZone === "headshots"
                        ? "border-neutral-600 bg-white/10 text-white"
                        : "border-neutral-800 bg-black/40 text-neutral-300 hover:bg-white/5"
                    }`}
                  >
                    Headshots
                  </button>
                </div>
              </label>

              <div className="rounded-xl border border-neutral-800 bg-black/40 p-3 sm:col-span-2">
                <div className="text-xs text-neutral-400">Target HP</div>
                <div className="mt-1 text-lg font-semibold">{totalHp}</div>
                <div className="text-xs text-neutral-500">
                  {mode === "wz" ? "100 base + plates" : "Multiplayer baseline"}
                </div>
              </div>
            </div>

            {/* Weapon stats */}
            <div className="mt-6 rounded-2xl border border-neutral-800 bg-black/40 p-4">
              <div className="text-sm font-semibold">Weapon stats</div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <div className="text-xs text-neutral-400">RPM</div>
                  <input
                    value={rpmOverride}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRpmOverride(v === "" ? "" : Number(v));
                    }}
                    placeholder={String(selected?.rpm ?? "")}
                    type="number"
                    step="1"
                    min={1}
                    className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                  />
                  <div className="mt-1 text-[11px] text-neutral-500">
                    Leave blank to use sheet value.
                  </div>
                </label>

                <div className="rounded-xl border border-neutral-800 bg-black/40 p-3">
                  <div className="text-xs text-neutral-400">Headshot mult</div>
                  <div className="mt-1 text-lg font-semibold">{fmt(sheetHsm, 2)}</div>
                  <div className="text-[11px] text-neutral-500">
                    Only used when Headshots is enabled.
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Results */}
          <section
            className={`rounded-2xl border border-neutral-800 bg-neutral-950 p-4 h-fit self-start ${
              mobileTab === "results" ? "block" : "hidden"
            } lg:block`}
          >
            <div className="text-sm font-semibold">Results</div>

            <div className="mt-5 grid gap-3">
              <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-black/40 px-4 py-3">
                <div className="text-sm text-neutral-300">Selected weapon</div>
                <div className="text-sm font-semibold">
                  {selected?.name ?? "—"}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-black/40 px-4 py-3">
                <div className="text-sm text-neutral-300">Hit zone</div>
                <div className="text-sm font-semibold">
                  {hitZone === "torso" ? "Torso" : "Headshots only"}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-black/40 px-4 py-3">
                <div className="text-sm text-neutral-300">Shots per second</div>
                <div className="text-sm font-semibold">{fmt(shotsPerSecond, 2)}</div>
              </div>

              {/* ✅ NEW: TTK-by-range in Results tab */}
              <div className="rounded-xl border border-neutral-800 bg-black/40 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-neutral-300">TTK by range</div>
                  <div className="text-[11px] text-neutral-500">
                    {showAccTtk ? "Accuracy applied" : "Perfect accuracy"}
                  </div>
                </div>

                <div className="mt-3 grid gap-2">
                  {rangeResults.map((r) => {
                    const shownTtk = showAccTtk ? r.ttkMsWithAccuracy : r.ttkMs;
                    return (
                      <div
                        key={r.key}
                        className="flex items-center justify-between rounded-lg border border-neutral-800 bg-black/30 px-3 py-2"
                      >
                        <div className="text-sm text-neutral-300">{r.label}</div>
                        <div className="text-sm font-semibold tabular-nums">
                          {fmtMs(shownTtk)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 text-xs text-neutral-500 leading-relaxed">
              Note: Real in-game TTK depends on range breakpoints, limb
              modifiers, headshot rules, sprint-to-fire, ADS, recoil, and server
              tick/latency. This tool is meant as a clean baseline.
            </div>
          </section>
        </div>
      </div>

   {/* ✅ MOBILE ONLY: sticky bottom TTK bar now shows ranges */}
<div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
  <div className="border-t border-neutral-800 bg-black/80 backdrop-blur">
    <div className="mx-auto max-w-6xl px-7 py-1">
      {/* OUTER: not a button (prevents nested button hydration error) */}
      <div
        role="button"
        tabIndex={0}
        
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setMobileTab("results");
        }}
        className="w-full text-left"
      >
        {/* header + button share SAME row & width */}
        <div className="flex items-start justify-between gap-3">
          <div className="text-[10px] leading-tight text-neutral-400">
            {selected?.name ?? "—"} •{" "}
            {mode === "wz" ? `WZ (${plates} plates)` : "MP"} •{" "}
            {hitZone === "torso" ? "Torso" : "Headshots"}
            {showAccTtk ? " • acc" : ""}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMobileTab(mobileTab === "inputs" ? "results" : "inputs");
            }}
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-neutral-200 hover:bg-white/10"
          >
            {mobileTab === "inputs" ? "View results" : "Edit inputs"}
          </button>
        </div>

        {/* ✅ CHANGED: 4-column grid so chips have a true right edge */}
        <div className="mt-2 grid grid-cols-4 gap-1.5 text-[10px] leading-tight">
          {rangeResults.map((r) => {
            const shownTtk = showAccTtk ? r.ttkMsWithAccuracy : r.ttkMs;

            const shortLabel =
              r.key === "r10"
                ? "0–10"
                : r.key === "r25"
                ? "10–25"
                : r.key === "r50"
                ? "25–50"
                : "50+";

            return (
              <div
                key={r.key}
                className="flex w-full items-center justify-between rounded border border-neutral-800 bg-black/30 px-2 py"
              >
                <span className="opacity-70">{shortLabel}</span>
                <span className="font-semibold tabular-nums">
                  {isFinite(shownTtk) ? `${Math.round(shownTtk)}ms` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </div>
</div>





    </main>
  );
}
