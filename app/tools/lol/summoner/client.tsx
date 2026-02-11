"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PlatformRegion =
  | "na1"
  | "br1"
  | "la1"
  | "la2"
  | "oc1"
  | "euw1"
  | "eun1"
  | "tr1"
  | "ru"
  | "kr"
  | "jp1";

const REGIONS: Array<{ key: PlatformRegion; label: string }> = [
  { key: "na1", label: "NA (na1)" },
  { key: "euw1", label: "EUW (euw1)" },
  { key: "eun1", label: "EUNE (eun1)" },
  { key: "kr", label: "Korea (kr)" },
  { key: "jp1", label: "Japan (jp1)" },
  { key: "br1", label: "Brazil (br1)" },
  { key: "la1", label: "LAN (la1)" },
  { key: "la2", label: "LAS (la2)" },
  { key: "oc1", label: "OCE (oc1)" },
  { key: "tr1", label: "Turkey (tr1)" },
  { key: "ru", label: "Russia (ru)" },
];

function parseRiotId(input: string): { gameName: string; tagLine: string } | null {
  const trimmed = (input || "").trim();
  const hashIdx = trimmed.lastIndexOf("#");
  if (hashIdx > 0 && hashIdx < trimmed.length - 1) {
    return {
      gameName: trimmed.slice(0, hashIdx).trim(),
      tagLine: trimmed.slice(hashIdx + 1).trim(),
    };
  }
  return null;
}

export default function SummonerLookupClient() {
  const router = useRouter();
  const [region, setRegion] = useState<PlatformRegion>("na1");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const parsedRiot = useMemo(() => parseRiotId(input), [input]);
  const trimmed = input.trim();

  function go() {
    setError("");

    if (!trimmed) {
      setError("Enter a Riot ID (GameName#TAG) or a Summoner Name.");
      return;
    }

    // ✅ Riot ID route (Account-V1)
    if (parsedRiot) {
      const url = `/tools/lol/summoner/${encodeURIComponent(region)}/${encodeURIComponent(
        parsedRiot.gameName
      )}/${encodeURIComponent(parsedRiot.tagLine)}`;
      router.push(url);
      return;
    }

    // ✅ Summoner Name route (Summoner-V4 by-name)
    const url = `/tools/lol/summoner/${encodeURIComponent(region)}/by-name/${encodeURIComponent(
      trimmed
    )}`;
    router.push(url);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[220px_1fr_auto]">
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-neutral-300">Server</span>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value as PlatformRegion)}
          className="h-11 rounded-xl border border-neutral-800 bg-black px-3 text-sm text-white outline-none focus:border-neutral-600"
        >
          {REGIONS.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-semibold text-neutral-300">Riot ID or Summoner</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="GameName#TAG  (or SummonerName)"
          className="h-11 rounded-xl border border-neutral-800 bg-black px-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-neutral-600"
          onKeyDown={(e) => {
            if (e.key === "Enter") go();
          }}
        />
      </label>

      <button
        onClick={go}
        className="mt-6 h-11 rounded-xl border border-neutral-800 bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:border-neutral-600 hover:shadow-[0_0_25px_rgba(0,255,255,0.25)]"
      >
        View Stats →
      </button>

      {error ? (
        <div className="sm:col-span-3 rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="sm:col-span-3 text-xs text-neutral-500">
        Tip: Riot ID is <span className="text-neutral-200">GameName#TAG</span> (tag is not the
        server). If you don’t know the tag, just use Summoner Name.
      </div>
    </div>
  );
}
