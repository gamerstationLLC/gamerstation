"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { CodWeaponRow } from "@/lib/codweapons";
import { type CodAttachmentRow, getCodAttachments } from "@/lib/codattachments";



/**
 * attachments_global columns:
 * attachment_id, attachment_name, slot, applies_to, dmg10_add, dmg25_add, dmg50_add
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
  damage_profile: { meters: number; damage: number }[];
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

function damageAtMeters(weapon: UIWeapon | undefined, meters: number) {
  if (!weapon) return 0;
  const profile = weapon.damage_profile ?? [];
  if (profile.length === 0) return 0;

  // choose last breakpoint <= meters
  let chosen = profile[0].damage;
  for (const p of profile) {
    if (meters >= p.meters) chosen = p.damage;
    else break;
  }
  return chosen;
}

// your simplified distance buckets
function bucketForDistance(meters: number): "dmg10" | "dmg25" | "dmg50" {
  if (meters <= 10) return "dmg10";
  if (meters <= 25) return "dmg25";
  return "dmg50";
}

export default function CodTtkClient({
  sheetWeapons,
  sheetAttachments = [],
}: {
  sheetWeapons: CodWeaponRow[];
  sheetAttachments?: CodAttachmentRow[];
}) {
  const [weaponClass, setWeaponClass] = useState<WeaponClass>("smg");

  /**
   * ✅ CRITICAL FIX:
   * Weapon IDs MUST be the exact `weapon_id` values used by attachments.applies_to.
   * No fallback to name/id, because that breaks matching (e.g. "Ryden 45K" vs "ryden_45k").
   */
  const weapons: UIWeapon[] = useMemo(() => {
  const wanted = weaponClass;

  // Build a set of weapon ids that attachments actually reference
  const appliesSet = new Set<string>();
  for (const a of sheetAttachments ?? []) {
    const raw = String((a as any).applies_to ?? "").trim();
    if (!raw) continue;
    raw.split(",").forEach((s) => {
      const v = s.trim();
      if (v) appliesSet.add(v);
    });
  }

  const slugify = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  return (sheetWeapons ?? [])
    .filter((w: any) => normalizeTypeToClass(w.weapon_type) === wanted)
    .map((w: any) => {
      const name = String(w.weapon_name ?? w.weaponName ?? "").trim();

      // try common key variants
      const candidates = [
        w.weapon_id,
        w.weaponId,
        w.weaponID,
        w.id,
        name ? slugify(name) : "",
      ]
        .map((v) => String(v ?? "").trim())
        .filter(Boolean);

      // prefer an id that exists in attachments.applies_to
      const matched = candidates.find((c) => appliesSet.has(c));
      const id = matched ?? candidates[0]; // fallback so weapons still render

      if (!id) return null;

      return {
        id,
        name: name || id,
        rpm: toNum(w.rpm),
        headshot_mult: toNum(w.headshot_mult) || 1,
        fire_mode: w.fire_mode,
        weapon_type: w.weapon_type,
        damage_profile: (w.damage_profile ?? []) as { meters: number; damage: number }[],
      };
    })
    .filter(Boolean) as UIWeapon[];
}, [sheetWeapons, sheetAttachments, weaponClass]);


  const [weaponId, setWeaponId] = useState<string>("");

  useEffect(() => {
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
      id: String(a.attachment_id),
      name: String(a.attachment_name),
      slot: String(a.slot),
      applies_to: String(a.applies_to),
      dmg10_add: toNum(a.dmg10_add),
      dmg25_add: toNum(a.dmg25_add),
      dmg50_add: toNum(a.dmg50_add),
    }));
  }, [sheetAttachments]);

  // ✅ BARRELS: normalize slot + allow applies_to "all" OR CSV list containing selected weapon_id
  const barrels = useMemo(() => {
    const wid = String(selected?.id ?? "").trim();
    if (!wid) return [];

    return attachments.filter((a) => {
      const slot = String(a.slot ?? "").trim().toLowerCase();
      if (slot !== "barrel") return false;

      const applies = String(a.applies_to ?? "")
        .split(",")
        .map((s) => s.trim());

      return applies.includes("all") || applies.includes(wid);
    });
  }, [attachments, selected?.id]);

  const [barrelId, setBarrelId] = useState<string>("");

  // ✅ prevent holding an invalid barrel ID when switching weapons
  useEffect(() => {
    setBarrelId("");
  }, [selected?.id]);

  const selectedBarrel = useMemo(
    () => barrels.find((b) => b.id === barrelId),
    [barrels, barrelId]
  );

  // Mode + plates
  const [mode, setMode] = useState<"mp" | "wz">("mp");
  const [plates, setPlates] = useState<number>(3);

  // ✅ ACCURACY: string state so iOS users can delete/backspace normally
  const [accuracyStr, setAccuracyStr] = useState<string>("100");

  // Distance buckets
  const [distanceM, setDistanceM] = useState<number>(25);

  // Editable overrides (RPM only)
  const [rpmOverride, setRpmOverride] = useState<number | "">("");

  const baseHp = 100;
  const armorHp = mode === "wz" ? clamp(plates, 0, 3) * 50 : 0;
  const totalHp = baseHp + armorHp;

  const rpm = rpmOverride === "" ? selected?.rpm ?? 0 : clamp(Number(rpmOverride), 1, 3000);

  // base damage from sheet
  const sheetDmg = damageAtMeters(selected, distanceM);
  const sheetHsm = selected?.headshot_mult ?? 1.0;

  // barrel adds by distance bucket
  const bucket = bucketForDistance(distanceM);
  const barrelAdd =
    bucket === "dmg10"
      ? selectedBarrel?.dmg10_add ?? 0
      : bucket === "dmg25"
      ? selectedBarrel?.dmg25_add ?? 0
      : selectedBarrel?.dmg50_add ?? 0;

  const basePlusAdds = Math.max(0, sheetDmg + barrelAdd);

  // same behavior you had: show "damage per shot after multiplier"
  const dmg = basePlusAdds * clamp(sheetHsm, 1, 5);

  const shotsPerSecond = rpm / 60;
  const shotsToKill = dmg > 0 ? Math.ceil(totalHp / dmg) : 0;

  const ttkMs =
    shotsToKill > 0 && shotsPerSecond > 0 ? ((shotsToKill - 1) / shotsPerSecond) * 1000 : NaN;

  // convert accuracy string to number only for math
  const accuracyNumRaw = accuracyStr === "" ? 0 : Number(accuracyStr);
  const accuracyNum = clamp(Number.isFinite(accuracyNumRaw) ? accuracyNumRaw : 0, 1, 100);

  const acc = accuracyNum / 100;
  const effectiveShots = shotsToKill > 0 ? Math.ceil(shotsToKill / acc) : 0;
  const ttkMsWithAccuracy =
    effectiveShots > 0 && shotsPerSecond > 0 ? ((effectiveShots - 1) / shotsPerSecond) * 1000 : NaN;

  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <Link href="/calculators" className="text-sm text-neutral-300 hover:text-white">
            ← Back to calculators
          </Link>
          <div className="text-sm text-neutral-400">Call of Duty • TTK</div>
        </header>

        <div className="mt-8">
          <h1 className="text-4xl font-bold tracking-tight"> COD TTK Calculator</h1>
          <p className="mt-3 text-neutral-300 max-w-2xl">
            Pick a weapon, choose Multiplayer or Warzone plates, and get shots-to-kill + time-to-kill.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Inputs */}
          <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
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
                    Note: Most barrels in Call of Duty primarily affect recoil, range, or bullet velocity. Many do not change damage values, and therefore may not affect time-to-kill. This calculator reflects damage-based TTK only.
                  </div>
                </label>

                <div className="rounded-xl border border-neutral-800 bg-black/40 p-3">
                  <div className="text-xs text-neutral-400">Current add</div>
                  <div className="mt-1 text-lg font-semibold">+{barrelAdd}</div>
                  <div className="text-xs text-neutral-500">
                    Bucket: {bucket === "dmg10" ? "10m" : bucket === "dmg25" ? "25m" : "50m"}
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
                      if (Number.isFinite(asNum) && asNum <= 100) setAccuracyStr(val);
                      else if (val.length <= 2) setAccuracyStr(val);
                    }
                  }}
                  className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                  placeholder="100"
                />
              </label>

              <div className="rounded-xl border border-neutral-800 bg-black/40 p-3 sm:col-span-2">
                <div className="text-xs text-neutral-400">Target HP</div>
                <div className="mt-1 text-lg font-semibold">{totalHp}</div>
                <div className="text-xs text-neutral-500">
                  {mode === "wz" ? "100 base + plates" : "Multiplayer baseline"}
                </div>
              </div>
            </div>

            {/* Distance + stats */}
            <div className="mt-6 rounded-2xl border border-neutral-800 bg-black/40 p-4">
              <div className="text-sm font-semibold">Weapon stats</div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <div className="text-xs text-neutral-400">Distance</div>
                  <select
                    value={distanceM}
                    onChange={(e) => setDistanceM(Number(e.target.value))}
                    className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
                  >
                    <option value={10}>10m (close)</option>
                    <option value={25}>25m (mid)</option>
                    <option value={50}>50m (long)</option>
                  </select>
                </label>

                <div />

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
                  <div className="mt-1 text-[11px] text-neutral-500">Leave blank to use sheet value.</div>
                </label>

                <label className="block">
                  <div className="text-xs text-neutral-400">Base Damage @{distanceM}m + add</div>
                  <input
                    value={`${sheetDmg || 0} + ${barrelAdd} = ${basePlusAdds}`}
                    readOnly
                    className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none"
                  />
                  <div className="mt-1 text-[11px] text-neutral-500">Headshot mult (sheet): {fmt(sheetHsm, 2)}</div>
                </label>
              </div>
            </div>
          </section>


          {/* Results */}
      


          <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 h-fit self-start">

            
            <div className="text-sm font-semibold">Results</div>

            <div className="mt-5 grid gap-3">
              <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-black/40 px-4 py-3">
                <div className="text-sm text-neutral-300">Selected weapon</div>
                <div className="text-sm font-semibold">{selected?.name ?? "—"}</div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-black/40 px-4 py-3">
                <div className="text-sm text-neutral-300">Distance</div>
                <div className="text-sm font-semibold">{distanceM}m</div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-black/40 px-4 py-3">
                <div className="text-sm text-neutral-300">Shots per second</div>
                <div className="text-sm font-semibold">{fmt(shotsPerSecond, 2)}</div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-black/40 px-4 py-3">
                <div className="text-sm text-neutral-300">Damage per shot (after multiplier)</div>
                <div className="text-sm font-semibold">{fmt(dmg, 2)}</div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-black/40 px-4 py-3">
                <div className="text-sm text-neutral-300">Shots to kill</div>
                <div className="text-sm font-semibold">{isFinite(ttkMs) ? shotsToKill : "—"}</div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-black/40 px-4 py-3">
                <div className="text-sm text-neutral-300">TTK (perfect accuracy)</div>
                <div className="text-sm font-semibold">{fmtMs(ttkMs)}</div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-black/40 px-4 py-3">
                <div className="text-sm text-neutral-300">TTK (with accuracy %)</div>
                <div className="text-sm font-semibold">{fmtMs(ttkMsWithAccuracy)}</div>
              </div>
            </div>

            <div className="mt-6 text-xs text-neutral-500 leading-relaxed">
              Note: Real in-game TTK depends on range breakpoints, limb modifiers, headshot rules, sprint-to-fire, ADS,
              recoil, and server tick/latency. This tool is meant as a clean baseline.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
