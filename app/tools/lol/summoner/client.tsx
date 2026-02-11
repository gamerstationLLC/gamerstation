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
  | "jp1"
  | "ph2"
  | "sg2"
  | "th2"
  | "tw2"
  | "vn2";

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
  { key: "ph2", label: "Philippines (ph2)" },
  { key: "sg2", label: "Singapore (sg2)" },
  { key: "th2", label: "Thailand (th2)" },
  { key: "tw2", label: "Taiwan (tw2)" },
  { key: "vn2", label: "Vietnam (vn2)" },
];

function looksLikeTag(tag: string) {
  // Riot tagline is typically 2–5 chars, letters/numbers only.
  // (There are edge cases, but this catches 99% without misclassifying normal names.)
  const t = (tag || "").trim();
  if (t.length < 2 || t.length > 6) return false;
  if (!/^[0-9a-zA-Z]+$/.test(t)) return false;
  return true;
}

type Parsed =
  | { kind: "riotid"; gameName: string; tagLine: string }
  | { kind: "name"; name: string };

function normalizeInput(raw: string): Parsed | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;

  // If user pasted "GameName#TAG"
  const hashIdx = trimmed.lastIndexOf("#");
  if (hashIdx > 0 && hashIdx < trimmed.length - 1) {
    const gameName = trimmed.slice(0, hashIdx).trim();
    const tagLine = trimmed.slice(hashIdx + 1).trim();
    if (gameName && tagLine) return { kind: "riotid", gameName, tagLine };
  }

  // If user pasted "GameName/TAG"
  if (trimmed.includes("/")) {
    const parts = trimmed
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 2 && parts[0] && parts[1] && looksLikeTag(parts[1])) {
      return { kind: "riotid", gameName: parts[0], tagLine: parts[1] };
    }
  }

  // If user typed "GameName TAG" (last token looks like a tag)
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const last = tokens[tokens.length - 1];
    const before = tokens.slice(0, -1).join(" ").trim();
    if (before && looksLikeTag(last)) {
      return { kind: "riotid", gameName: before, tagLine: last };
    }
  }

  // If user typed "GameName-TAG" (only treat as riotid if TAG looks like a tag)
  // Note: we only split on the LAST dash to avoid breaking names with dashes.
  const dashIdx = trimmed.lastIndexOf("-");
  if (dashIdx > 0 && dashIdx < trimmed.length - 1) {
    const maybeName = trimmed.slice(0, dashIdx).trim();
    const maybeTag = trimmed.slice(dashIdx + 1).trim();
    if (maybeName && looksLikeTag(maybeTag)) {
      return { kind: "riotid", gameName: maybeName, tagLine: maybeTag };
    }
  }

  // Otherwise treat as summoner name
  return { kind: "name", name: trimmed };
}

export default function SummonerLookupClient() {
  const router = useRouter();
  const [region, setRegion] = useState<PlatformRegion>("na1");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const parsed = useMemo(() => normalizeInput(input), [input]);

  function go() {
    setError("");

    if (!parsed) {
      setError("Enter a Riot ID (GameName#TAG) or a Summoner Name.");
      return;
    }

    if (parsed.kind === "riotid") {
      const url = `/tools/lol/summoner/${encodeURIComponent(region)}/${encodeURIComponent(
        parsed.gameName
      )}/${encodeURIComponent(parsed.tagLine)}`;
      router.push(url);
      return;
    }

    const url = `/tools/lol/summoner/${encodeURIComponent(region)}/by-name/${encodeURIComponent(
      parsed.name
    )}`;
    router.push(url);
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-[220px_1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault(); // ✅ stop full-page reload
        go(); // ✅ Enter submits
      }}
    >
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
          onChange={(e) => {
            setInput(e.target.value);
            if (error) setError(""); // optional: clear error as they type
          }}
          placeholder="GameName#TAG  (or SummonerName)"
          className="h-11 rounded-xl border border-neutral-800 bg-black px-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-neutral-600"
        />
      </label>

      <button
        type="submit" // ✅ Enter triggers this
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
        Accepted: <span className="text-neutral-200">GameName#TAG</span>,{" "}
        <span className="text-neutral-200">GameName TAG</span>,{" "}
        <span className="text-neutral-200">GameName/TAG</span>, or a Summoner Name.
      </div>
    </form>
  );
}
