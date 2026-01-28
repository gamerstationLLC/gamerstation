"use client";

import { useEffect, useMemo, useState } from "react";

type Weapon = {
  id: string;
  name: string;
  fireMode?: string | null;

  rpm?: number | null;
  magSize?: number | null;
  reloadSec?: number | null;

  damage?: {
    base?: number | null;
    headMultiplier?: number | null;
  } | null;
};

type WeaponsFileV1 = {
  updatedAt?: string;
  source?: { name?: string; url?: string };
  weapons?: Weapon[];
  data?: { weapons?: Weapon[] };
};

function safeNum(n: unknown): number | null {
  const x = typeof n === "string" ? Number(n) : n;
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const pow = Math.pow(10, digits);
  return String(Math.round(n * pow) / pow);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeFireMode(raw?: string | null) {
  const v = (raw || "").toLowerCase().trim();
  if (!v) return "—";
  if (v.includes("auto")) return "Auto";
  if (v.includes("semi") || v.includes("single")) return "Semi";
  if (v.includes("burst")) return "Burst";
  return "Other";
}

/** Allows deleteable input: "" is allowed while typing. */
function toIntOrEmpty(s: string) {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export default function ArsenalClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  // Selection
  const [selectedId, setSelectedId] = useState<string>("");

  // Desktop list search
  const [query, setQuery] = useState("");

  // Mobile picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  // Mobile tabs
  const [mobileTab, setMobileTab] = useState<"inputs" | "results">("inputs");

  // Inputs (string so "0" is deleteable)
  const [targetHpStr, setTargetHpStr] = useState<string>("100");
  const [headshotPctStr, setHeadshotPctStr] = useState<string>("0");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/data/roblox/arsenal/weapons.v1.json", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Failed to load weapons.v1.json (HTTP ${res.status})`);

        const json = (await res.json()) as WeaponsFileV1;

        const list =
          json?.weapons ??
          json?.data?.weapons ??
          (Array.isArray(json as any) ? ((json as any) as Weapon[]) : []);

        if (!Array.isArray(list) || list.length === 0) {
          throw new Error("weapons.v1.json loaded, but no weapons array was found.");
        }

        if (cancelled) return;

        const sorted = [...list].sort((a, b) =>
          (a.name || a.id).localeCompare(b.name || b.id)
        );

        setWeapons(sorted);
        setUpdatedAt(json?.updatedAt ?? null);
        setSourceName(json?.source?.name ?? null);
        setSourceUrl(json?.source?.url ?? null);
        setSelectedId(sorted[0]?.id ?? "");
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load Arsenal weapons data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(() => {
    return weapons.find((w) => w.id === selectedId) ?? weapons[0] ?? null;
  }, [weapons, selectedId]);

  const filteredDesktop = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return weapons;
    return weapons.filter((w) => {
      const hay = `${w.name ?? ""} ${w.id ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [weapons, query]);

  const filteredPicker = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return weapons;
    return weapons.filter((w) => {
      const hay = `${w.name ?? ""} ${w.id ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [weapons, pickerQuery]);

  const derived = useMemo(() => {
    if (!selected) return null;

    const base = safeNum(selected.damage?.base);
    const headMult = safeNum(selected.damage?.headMultiplier);
    const head = base !== null && headMult !== null ? base * headMult : null;

    const rpm = safeNum(selected.rpm);
    const rps = rpm !== null ? rpm / 60 : null;

    const magSize = safeNum(selected.magSize);
    const reloadSec = safeNum(selected.reloadSec);

    const hpParsed = toIntOrEmpty(targetHpStr);
    const hsParsed = toIntOrEmpty(headshotPctStr);

    // Defaults if empty/invalid while typing
    const hp = clamp(hpParsed ?? 100, 1, 10000);
    const hsPct = clamp(hsParsed ?? 0, 0, 100) / 100;

    const expPerShot =
      base !== null
        ? head !== null
          ? base * (1 - hsPct) + head * hsPct
          : base
        : null;

    const shotsToKill = expPerShot !== null ? Math.ceil(hp / expPerShot) : null;

    const ttkSec =
      shotsToKill !== null && rps !== null && shotsToKill > 0 ? (shotsToKill - 1) / rps : null;

    const dps = expPerShot !== null && rps !== null ? expPerShot * rps : null;

    const dmgPerMag =
      expPerShot !== null && magSize !== null ? expPerShot * magSize : null;

    const timeToEmpty =
      magSize !== null && rps !== null && magSize > 0 ? (magSize - 1) / rps : null;

    const sustainedDps =
      dmgPerMag !== null && timeToEmpty !== null && reloadSec !== null
        ? dmgPerMag / (timeToEmpty + reloadSec)
        : null;

    const rpmMissing = rpm === null;

    // When RPM is missing, only show:
    // Damage block (full), Weapon stats: Magazine only, Results: Shots to kill only
    return {
      rpmMissing,
      base,
      headMult,
      head,
      expPerShot,
      magSize,
      shotsToKill,

      // time-based (only if rpm exists)
      rpm,
      rps,
      reloadSec,
      ttkSec,
      dps,
      dmgPerMag,
      sustainedDps,
    };
  }, [selected, targetHpStr, headshotPctStr]);

  const rpmMissing = derived?.rpmMissing ?? true;

  // Mobile sticky footer values (only)
  const footerBody = derived?.base ?? null;
  const footerSTK = derived?.shotsToKill ?? null;

  function handleSelectWeapon(id: string) {
    setSelectedId(id);
    setPickerOpen(false);
    setPickerQuery("");
    // After selecting, make results tab visible (feels good on mobile)
    setMobileTab("results");
  }

  function normalizeNumberInput(
    v: string,
    kind: "hp" | "hs"
  ): string {
    // Allow empty
    if (v === "") return "";

    // Only digits
    if (!/^\d+$/.test(v)) return v.replace(/[^\d]/g, "");

    // Remove leading zeros like "0005" -> "5" (but allow single "0")
    if (v.length > 1) v = v.replace(/^0+/, "") || "0";

    const n = Number(v);
    if (!Number.isFinite(n)) return "";

    if (kind === "hp") return String(clamp(n, 1, 10000));
    return String(clamp(n, 0, 100));
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-neutral-900 bg-neutral-950 p-6">
        <div className="text-sm text-neutral-300">Loading Arsenal weapons…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-6">
        <div className="text-sm font-semibold">Couldn’t load Arsenal data</div>
        <div className="mt-2 text-sm text-neutral-300">{error}</div>
        <div className="mt-4 text-xs text-neutral-500">
          Expected file:{" "}
          <span className="text-neutral-300">public/data/roblox/arsenal/weapons.v1.json</span>
        </div>
      </div>
    );
  }

  return (
    <section className="relative">
      {/* MOBILE: Weapon picker modal */}
      {pickerOpen ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setPickerOpen(false)}
          />
          <div className="absolute inset-x-0 top-0 mx-auto max-w-xl p-4">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-900">
                <div className="text-sm font-semibold">Select weapon</div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="rounded-lg border border-neutral-800 bg-black/30 px-2 py-1 text-xs text-neutral-200 hover:border-neutral-600 transition"
                >
                  Close
                </button>
              </div>

              <div className="p-4">
                <input
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="Search weapon…"
                  autoFocus
                  className="w-full rounded-xl border border-neutral-800 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-neutral-600"
                />
              </div>

              <div className="max-h-[60vh] overflow-auto border-t border-neutral-900">
                {filteredPicker.map((w) => {
                  const isActive = w.id === selectedId;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => handleSelectWeapon(w.id)}
                      className={[
                        "w-full text-left px-4 py-3 border-b border-neutral-900 last:border-b-0",
                        "hover:bg-white/5 transition",
                        isActive ? "bg-white/10" : "bg-transparent",
                      ].join(" ")}
                    >
                      <div className="text-sm font-medium">{w.name || w.id}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Desktop: compact 2-col. Mobile: single column */}
      <div className="grid gap-5 lg:grid-cols-[330px_1fr] lg:items-start">

        {/* LEFT (Desktop only): compact weapon list */}
        <div className="hidden lg:block rounded-2xl border border-neutral-900 bg-neutral-950 p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Weapons</div>
            <div className="text-xs text-neutral-500">{filteredDesktop.length} shown</div>
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search weapon…"
            className="mt-3 w-full rounded-xl border border-neutral-800 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-neutral-600"
          />

          <div className="mt-3 flex flex-col">
  <div className="max-h-[420px] overflow-auto rounded-xl border border-neutral-900">
    {filteredDesktop.map((w) => {
      const isActive = w.id === selectedId;
      return (
        <button
          key={w.id}
          type="button"
          onClick={() => setSelectedId(w.id)}
          className={[
            "w-full text-left px-3 py-2 border-b border-neutral-900 last:border-b-0",
            "hover:bg-white/5 transition",
            isActive ? "bg-white/10" : "bg-transparent",
          ].join(" ")}
        >
          <div className="text-sm font-medium">{w.name || w.id}</div>
        </button>
      );
    })}
  </div>

  <div className="mt-2 text-[11px] text-neutral-500">
    {updatedAt ? (
      <div>
        Updated: <span className="text-neutral-300">{updatedAt}</span>
      </div>
    ) : null}
    {sourceUrl ? (
      <div className="mt-1">
        Source:{" "}
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-neutral-300 hover:text-white underline underline-offset-4"
        >
          {sourceName || "Arsenal Wiki"}
        </a>
      </div>
    ) : null}
  </div>
</div>

        </div>

        {/* RIGHT (Main) */}
        <div className="rounded-2xl border border-neutral-900 bg-neutral-950 p-4 lg:p-5">
          {/* Header row */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            
             

            {/* Desktop inputs (compact) */}
            <div className="hidden lg:grid grid-cols-2 gap-3 w-[340px]">
              <LabelInput label="Target HP">
                <input
                  inputMode="numeric"
                  value={targetHpStr}
                  onChange={(e) => setTargetHpStr(normalizeNumberInput(e.target.value, "hp"))}
                  className="mt-2 w-full rounded-lg border border-neutral-800 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
                />
              </LabelInput>

              <LabelInput label="Headshot %">
                <input
                  inputMode="numeric"
                  value={headshotPctStr}
                  onChange={(e) => setHeadshotPctStr(normalizeNumberInput(e.target.value, "hs"))}
                  className="mt-2 w-full rounded-lg border border-neutral-800 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
                />
              </LabelInput>
            </div>
          </div>

          {/* MOBILE: weapon dropdown + inputs + tabs */}
          <div className="lg:hidden mt-4">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="w-full rounded-2xl border border-neutral-800 bg-black/30 px-4 py-3 text-left hover:border-neutral-600 transition"
            >
              <div className="text-xs text-neutral-500">Weapon</div>
              <div className="mt-1 text-base font-semibold">{selected?.name || "—"}</div>
            </button>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <LabelInput label="Target HP">
                <input
                  inputMode="numeric"
                  value={targetHpStr}
                  onChange={(e) => setTargetHpStr(normalizeNumberInput(e.target.value, "hp"))}
                  placeholder="100"
                  className="mt-2 w-full rounded-lg border border-neutral-800 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
                />
              </LabelInput>

              <LabelInput label="Headshot %">
                <input
                  inputMode="numeric"
                  value={headshotPctStr}
                  onChange={(e) => setHeadshotPctStr(normalizeNumberInput(e.target.value, "hs"))}
                  placeholder="0"
                  className="mt-2 w-full rounded-lg border border-neutral-800 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-neutral-600"
                />
              </LabelInput>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-neutral-900 bg-black/30 p-2">
              <TabButton
                active={mobileTab === "inputs"}
                onClick={() => setMobileTab("inputs")}
              >
                Inputs
              </TabButton>
              <TabButton
                active={mobileTab === "results"}
                onClick={() => setMobileTab("results")}
              >
                Results
              </TabButton>
            </div>
          </div>

          {/* CONTENT */}
          <div className="mt-4 lg:mt-5 grid gap-4">
            {/* Desktop shows everything; Mobile shows tabbed blocks */}
            {mobileTab === "inputs" ? (
              <div className="lg:hidden grid gap-4">
                <Block title="Damage">
                  <Row label="Body / shot" value={fmt(derived?.base, 0)} />
                  <Row
                    label="Head mult"
                    value={derived?.headMult != null ? `${fmt(derived.headMult)}×` : "—"}
                  />
                  <Row label="Head / shot" value={fmt(derived?.head, 0)} />
                  <Row label="Expected / shot" value={fmt(derived?.expPerShot, 2)} />
                </Block>

                <Block title="Weapon stats">
                  <Row label="Magazine" value={fmt(derived?.magSize, 0)} />
                  {!rpmMissing && derived?.reloadSec != null ? (
                    <Row label="Reload (sec)" value={fmt(derived?.reloadSec, 2)} />
                  ) : null}
                  {!rpmMissing ? (
                    <>
                      <Row label="RPM" value={fmt(derived?.rpm, 0)} />
                      <Row label="Shots / sec" value={fmt(derived?.rps, 2)} />
                    </>
                  ) : null}
                </Block>
              </div>
            ) : null}

            {mobileTab === "results" ? (
              <div className="lg:hidden grid gap-4">
                <Block title="Results">
                  <Row
                    label="Shots to kill"
                    value={derived?.shotsToKill != null ? String(derived.shotsToKill) : "—"}
                  />

                  {!rpmMissing ? (
                    <>
                      <Row label="TTK (sec)" value={fmt(derived?.ttkSec, 2)} />
                      <Row label="DPS (expected)" value={fmt(derived?.dps, 2)} />
                      <Row label="Damage / mag" value={fmt(derived?.dmgPerMag, 0)} />
                      {derived?.reloadSec != null ? (
                        <Row label="Sustained DPS" value={fmt(derived?.sustainedDps, 2)} />
                      ) : null}
                    </>
                  ) : null}
                </Block>

                <div className="text-xs text-neutral-500">
                  Some weapons don’t list full fire-rate/reload details on the wiki—those values won’t be shown.
                </div>
              </div>
            ) : null}

            {/* Desktop blocks (always visible) */}
            <div className="hidden lg:grid gap-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Block title="Damage">
                  <Row label="Body / shot" value={fmt(derived?.base, 0)} />
                  <Row
                    label="Head mult"
                    value={derived?.headMult != null ? `${fmt(derived.headMult)}×` : "—"}
                  />
                  <Row label="Head / shot" value={fmt(derived?.head, 0)} />
                  <Row label="Expected / shot" value={fmt(derived?.expPerShot, 2)} />
                </Block>

                <Block title="Weapon stats">
                  <Row label="Magazine" value={fmt(derived?.magSize, 0)} />
                  {!rpmMissing && derived?.reloadSec != null ? (
                    <Row label="Reload (sec)" value={fmt(derived?.reloadSec, 2)} />
                  ) : null}
                  {!rpmMissing ? (
                    <>
                      <Row label="RPM" value={fmt(derived?.rpm, 0)} />
                      <Row label="Shots / sec" value={fmt(derived?.rps, 2)} />
                    </>
                  ) : null}
                </Block>
              </div>

              <Block title="Results">
                <Row
                  label="Shots to kill"
                  value={derived?.shotsToKill != null ? String(derived.shotsToKill) : "—"}
                />

                {!rpmMissing ? (
                  <>
                    <Row label="TTK (sec)" value={fmt(derived?.ttkSec, 2)} />
                    <Row label="DPS (expected)" value={fmt(derived?.dps, 2)} />
                    <Row label="Damage / mag" value={fmt(derived?.dmgPerMag, 0)} />
                    {derived?.reloadSec != null ? (
                      <Row label="Sustained DPS" value={fmt(derived?.sustainedDps, 2)} />
                    ) : null}
                  </>
                ) : null}
              </Block>

              <div className="text-xs text-neutral-500">
                Some weapons don’t list full fire-rate/reload details on the wiki—those values won’t be shown.
              </div>
            </div>
          </div>

          {/* Desktop footer info */}
          <div className="hidden lg:block mt-4 text-[11px] text-neutral-500">
            {updatedAt ? (
              <span>
                Updated: <span className="text-neutral-300">{updatedAt}</span>
              </span>
            ) : null}
            {sourceUrl ? (
              <span className="ml-3">
                Source:{" "}
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-neutral-300 hover:text-white underline underline-offset-4"
                >
                  {sourceName || "Arsenal Wiki"}
                </a>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* MOBILE sticky results footer */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
        <div className="border-t border-neutral-900 bg-black/85 backdrop-blur ios-glass px-4 py-3">
          <div className="mx-auto max-w-xl flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] text-neutral-400">Body / shot</div>
              <div className="text-base font-semibold text-white tabular-nums">
                {footerBody != null ? fmt(footerBody, 0) : "—"}
              </div>
            </div>

            <div className="min-w-0 text-right">
              <div className="text-[11px] text-neutral-400">Shots to kill</div>
              <div className="text-base font-semibold text-white tabular-nums">
                {footerSTK != null ? String(footerSTK) : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Extra padding so mobile content doesn't hide behind sticky footer */}
      <div className="lg:hidden h-20" />
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-900 bg-black/30 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-3 divide-y divide-neutral-900 rounded-xl border border-neutral-900 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 bg-black/25">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-sm font-medium text-white tabular-nums">{value}</div>
    </div>
  );
}

function LabelInput({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-900 bg-black/30 p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      {children}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl px-3 py-2 text-sm font-semibold transition",
        active
          ? "bg-white/10 border border-neutral-700 text-white"
          : "bg-black/20 border border-neutral-900 text-neutral-300 hover:border-neutral-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
