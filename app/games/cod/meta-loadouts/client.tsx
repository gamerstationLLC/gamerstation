"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type MetaLoadout = {
  id: string;
  weapon: string;
  weaponId?: string; // ✅ NEW
  category?: string;
  mode: "warzone" | "multiplayer";
  range: "close" | "mid" | "long";
  notes?: string;
  attachments: string[];
  updatedAt?: string;
};

type Props = {
  initialLoadouts: MetaLoadout[];
};

function labelMode(m: MetaLoadout["mode"]) {
  return m === "warzone" ? "Warzone" : "Multiplayer";
}
function labelRange(r: MetaLoadout["range"]) {
  return r === "close" ? "Close" : r === "mid" ? "Mid" : "Long";
}

export default function MetaLoadoutsClient({ initialLoadouts }: Props) {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"all" | MetaLoadout["mode"]>("all");
  const [range, setRange] = useState<"all" | MetaLoadout["range"]>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return initialLoadouts.filter((l) => {
      if (mode !== "all" && l.mode !== mode) return false;
      if (range !== "all" && l.range !== range) return false;

      if (!q) return true;

      return (
        l.weapon.toLowerCase().includes(q) ||
        (l.weaponId?.toLowerCase().includes(q) ?? false) ||
        (l.category?.toLowerCase().includes(q) ?? false) ||
        (l.notes?.toLowerCase().includes(q) ?? false) ||
        l.attachments.some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [initialLoadouts, search, mode, range]);

  const copy = async (l: MetaLoadout) => {
    const text = [
      `${l.weapon}${l.category ? ` (${l.category})` : ""}`,
      l.weaponId ? `Weapon ID: ${l.weaponId}` : "",
      `Mode: ${labelMode(l.mode)}`,
      `Range: ${labelRange(l.range)}`,
      l.updatedAt ? `Updated: ${l.updatedAt}` : "",
      "",
      "Attachments:",
      ...l.attachments.map((a) => `- ${a}`),
      l.notes ? `\nNotes: ${l.notes}` : "",
      "",
      "GamerStation",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      alert("Loadout copied!");
    } catch {
      alert("Copy failed (clipboard blocked).");
    }
  };

  return (
    <div>
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search weapon or attachment..."
          className="w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-neutral-600"
        />

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {(["all", "warzone", "multiplayer"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full border px-3 py-1 ${
                mode === m
                  ? "border-neutral-500 bg-neutral-800 text-white"
                  : "border-neutral-800 bg-black text-neutral-400 hover:text-white hover:border-neutral-600"
              }`}
              type="button"
            >
              {m === "all" ? "All Modes" : labelMode(m)}
            </button>
          ))}

          {(["all", "close", "mid", "long"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full border px-3 py-1 ${
                range === r
                  ? "border-neutral-500 bg-neutral-800 text-white"
                  : "border-neutral-800 bg-black text-neutral-400 hover:text-white hover:border-neutral-600"
              }`}
              type="button"
            >
              {r === "all" ? "All Ranges" : labelRange(r)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {filtered.map((l) => {
          const href = l.weaponId
            ? `/calculators/ttk/cod?weaponId=${encodeURIComponent(l.weaponId)}`
            : `/calculators/ttk/cod?weapon=${encodeURIComponent(l.weapon)}`;

          return (
            <div
              key={l.id}
              className="rounded-xl border border-neutral-800 bg-neutral-950 p-5"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">
                    {l.weapon}
                    {l.category && (
                      <span className="text-neutral-400"> · {l.category}</span>
                    )}
                  </div>

                  <div className="mt-1 text-xs text-neutral-400">
                    {labelMode(l.mode)} · {labelRange(l.range)} range
                    {l.updatedAt && (
                      <span className="text-neutral-500"> · {l.updatedAt}</span>
                    )}
                  </div>

                  {l.notes && (
                    <div className="mt-2 text-sm text-neutral-300">{l.notes}</div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Link
                    href={href}
                    className="h-fit rounded-lg border border-neutral-800 bg-black px-3 py-2 text-xs text-neutral-200 hover:border-neutral-600 hover:text-white"
                  >
                    TTK
                  </Link>

                  <button
                    onClick={() => copy(l)}
                    className="h-fit rounded-lg border border-neutral-800 bg-black px-3 py-2 text-xs text-neutral-200 hover:border-neutral-600 hover:text-white"
                    type="button"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <ul className="mt-4 space-y-1 text-sm text-neutral-400">
                {l.attachments.map((a, i) => (
                  <li key={`${l.id}-${i}`}>• {a}</li>
                ))}
              </ul>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border border-neutral-800 bg-neutral-950 p-6 text-sm text-neutral-400">
            No loadouts match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
