"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CodWeaponRow } from "@/lib/codweapons";

type WeaponClass = "assault_rifles" | "smg" | "lmg";

const COD_CLASSES: { value: WeaponClass; label: string }[] = [
  { value: "assault_rifles", label: "Assault Rifles" },
  { value: "smg", label: "SMGs" },
  { value: "lmg", label: "LMGs" },
];

type UIWeapon = {
  id: string;
  name: string;
  meta?: boolean;
  rpm?: number;
  headshot_mult?: number;
  fire_mode?: string;
  weapon_type?: string;
  damage_profile?: { meters: number; damage: number }[];
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

function normalizeTypeToClass(t: string): WeaponClass | null {
  const s = (t || "").trim().toLowerCase();

  // from your sheet: "Assault Rifle", "SMG", "LMG"
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

export default function CodTtkClient({ sheetWeapons }: { sheetWeapons: CodWeaponRow[] }) {
  const [weaponClass, setWeaponClass] = useState<WeaponClass>("smg");

  const weapons: UIWeapon[] = useMemo(() => {
    const wanted = weaponClass;

    return (sheetWeapons ?? [])
      .filter((w) => normalizeTypeToClass(w.weapon_type) === wanted)
      .map((w) => ({
        id: w.weapon_name,
        name: w.weapon_name,
        meta: false,
        rpm: w.rpm ?? 0,
        headshot_mult: w.headshot_mult,
        fire_mode: w.fire_mode,
        weapon_type: w.weapon_type,
        damage_profile: w.damage_profile ?? [],
      }));
  }, [sheetWeapons, weaponClass]);

  const [weaponId, setWeaponId] = useState<string>(weapons[0]?.id ?? "");

  // keep weaponId valid when weapons load/update or class changes
  useMemo(() => {
    if (weapons.length === 0) {
      setWeaponId("");
      return;
    }
    if (!weapons.some((w) => w.id === weaponId)) {
      setWeaponId(weapons[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weaponClass, weapons.length]);

  const selected = useMemo(
    () => weapons.find((w) => w.id === weaponId) ?? weapons[0],
    [weapons, weaponId]
  );

  // Mode + plates
  const [mode, setMode] = useState<"mp" | "wz">("mp");
  const [plates, setPlates] = useState<number>(3); // WZ only (0–3)
  const [accuracy, setAccuracy] = useState<number>(100);

  // Distance buckets
  const [distanceM, setDistanceM] = useState<number>(25);

  // Editable overrides (RPM only)
  const [rpmOverride, setRpmOverride] = useState<number | "">("");

  const baseHp = mode === "mp" ? 100 : 100;
  const armorHp = mode === "wz" ? clamp(plates, 0, 3) * 50 : 0;
  const totalHp = baseHp + armorHp;

  const rpm = rpmOverride === "" ? selected?.rpm ?? 0 : clamp(Number(rpmOverride), 1, 3000);

  // ✅ Base damage from sheet at distance + headshot mult from sheet
  const sheetDmg = damageAtMeters(selected, distanceM);
  const sheetHsm = selected?.headshot_mult ?? 1.0;

  // This tool shows "damage per shot after multiplier" as: baseDamage * headshot_mult
  const dmg = sheetDmg * clamp(sheetHsm, 1, 5);

  const shotsPerSecond = rpm / 60;
  const shotsToKill = dmg > 0 ? Math.ceil(totalHp / dmg) : 0;

  const ttkMs =
    shotsToKill > 0 && shotsPerSecond > 0 ? ((shotsToKill - 1) / shotsPerSecond) * 1000 : NaN;

  const acc = clamp(accuracy, 1, 100) / 100;
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
          <h1 className="text-4xl font-bold tracking-tight">BO7 TTK Calculator</h1>
          <p className="mt-3 text-neutral-300 max-w-2xl">
            Pick a weapon, choose Multiplayer or Warzone plates, and get shots-to-kill + time-to-kill.
          </p>
          <p className="mt-6 text-neutral-300 max-w-2xl">More weapon options coming soon!</p>
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
                      {w.meta ? "★ " : ""}
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <label className="block">
                <div className="text-xs text-neutral-400">Accuracy (%)</div>
                <input
                  value={accuracy}
                  onChange={(e) => setAccuracy(Number(e.target.value))}
                  type="number"
                  step="1"
                  min={1}
                  max={100}
                  className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-neutral-600"
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

              {/* Distance on top, RPM + Base Damage aligned on next row */}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {/* Distance (row 1, left) */}
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

                {/* Spacer (row 1, right) */}
                <div />

                {/* RPM (row 2, left) */}
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

                {/* Base Damage (row 2, right) */}
                <label className="block">
                  <div className="text-xs text-neutral-400">Base Damage @{distanceM}m</div>
                  <input
                    value={sheetDmg || 0}
                    readOnly
                    className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none"
                  />
                  <div className="mt-1 text-[11px] text-neutral-500">
                    Headshot mult (sheet): {fmt(sheetHsm, 2)}
                  </div>
                </label>
              </div>
            </div>
          </section>

          {/* Results */}
          <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
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
              Note: Real in-game TTK depends on range multipliers, limb modifiers, headshot rules,
              sprint-to-fire, ADS, recoil, and server tick/latency. This tool is meant as a clean baseline.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
