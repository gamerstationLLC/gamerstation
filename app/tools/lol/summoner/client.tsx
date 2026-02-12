"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Parsed = { gameName: string; tagLine: string } | null;

function parseRiotId(raw: string): Parsed {
  const s = (raw || "").trim();
  if (!s) return null;

  // Accept "Name#TAG" only (clean + unambiguous)
  const hash = s.lastIndexOf("#");
  if (hash <= 0 || hash >= s.length - 1) return null;

  const gameName = s.slice(0, hash).trim();
  let tagLine = s.slice(hash + 1).trim();

  // People sometimes paste "#NA1" into the tag box region-style
  tagLine = tagLine.replace(/^#+/, "");

  if (!gameName || !tagLine) return null;
  return { gameName, tagLine };
}

export default function SummonerLookupClient() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const parsed = useMemo(() => parseRiotId(input), [input]);

  function go() {
    setError("");

    if (!parsed) {
      setError("Enter a Riot ID in the format GameName#TAG.");
      return;
    }

    const url = `/tools/lol/summoner/${encodeURIComponent(parsed.gameName)}/${encodeURIComponent(
      parsed.tagLine
    )}`;
    router.push(url);
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-neutral-300">Riot ID</span>
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (error) setError("");
          }}
          placeholder="GameName#TAG"
          className="h-11 rounded-xl border border-neutral-800 bg-black px-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-neutral-600"
        />
      </label>

      <button
        type="submit"
        className="mt-6 h-11 rounded-xl border border-neutral-800 bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:border-neutral-600 hover:shadow-[0_0_25px_rgba(0,255,255,0.25)]"
      >
        View Stats →
      </button>

      {error ? (
        <div className="sm:col-span-2 rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="sm:col-span-2 text-xs text-neutral-500">
        Note: the “#” is only for input parsing. It cannot live in the URL path (browser treats it as a
        fragment).
      </div>
    </form>
  );
}
