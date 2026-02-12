"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const POPULAR_RIOT_IDS: string[] = [
  "Faker#KR1",
  "Hide on bush#KR1",
  "Ruler#KR1",
  "Caps#EUW",
  "Doublelift#NA1",
  // add/remove whatever you want
];

export default function SummonerLookupClient() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  // dropdown state
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const rootRef = useRef<HTMLFormElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => parseRiotId(input), [input]);

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return [];

    // Filter popular list by substring match; cap to 5
    const filtered = POPULAR_RIOT_IDS.filter((s) => s.toLowerCase().includes(q)).slice(0, 5);

    // If nothing matches, you can either show nothing (current)
    // or show the top 5 defaults. Keep it strict for now.
    return filtered;
  }, [input]);

  const showDropdown = open && suggestions.length > 0;

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

  function pickSuggestion(value: string) {
    setInput(value);
    setOpen(false);
    setActiveIndex(-1);
    if (error) setError("");
    // keep focus so user can just hit Enter
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <form
      ref={rootRef}
      className="grid gap-3 sm:grid-cols-[1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        // If dropdown is open and a suggestion is highlighted, pick it first
        if (showDropdown && activeIndex >= 0 && activeIndex < suggestions.length) {
          pickSuggestion(suggestions[activeIndex]);
          return;
        }
        go();
      }}
    >
      <label className="grid gap-1 relative">
        <span className="text-xs font-semibold text-neutral-300">Riot ID</span>

        <input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (error) setError("");
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!suggestions.length) return;

            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActiveIndex((prev) => {
                const next = prev + 1;
                return next >= suggestions.length ? 0 : next;
              });
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActiveIndex((prev) => {
                const next = prev - 1;
                return next < 0 ? suggestions.length - 1 : next;
              });
            } else if (e.key === "Escape") {
              setOpen(false);
              setActiveIndex(-1);
            } else if (e.key === "Enter") {
              // handled by onSubmit; keep this so mobile/IME doesn’t double-trigger
              if (showDropdown && activeIndex >= 0) {
                e.preventDefault();
                pickSuggestion(suggestions[activeIndex]);
              }
            }
          }}
          placeholder="GameName#TAG"
          className="h-11 rounded-xl border border-neutral-800 bg-black px-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-neutral-600"
        />

        {/* Dropdown */}
        {showDropdown ? (
          <div
            className="
              absolute left-0 right-0 top-[66px]
              z-20 overflow-hidden rounded-xl
              border border-neutral-800
              bg-neutral-950/95
              shadow-[0_0_40px_rgba(0,255,255,0.10)]
              backdrop-blur
            "
            role="listbox"
          >
            {suggestions.map((s, idx) => {
              const active = idx === activeIndex;
              return (
                <button
                  key={s}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={(e) => {
                    // prevent input blur before click
                    e.preventDefault();
                  }}
                  onClick={() => pickSuggestion(s)}
                  className={[
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm",
                    "transition",
                    active
                      ? "bg-white/10 text-white"
                      : "bg-transparent text-neutral-200 hover:bg-white/5 hover:text-white",
                  ].join(" ")}
                >
                  <span className="font-semibold">{s}</span>
                  <span className="text-xs text-neutral-500">popular</span>
                </button>
              );
            })}
          </div>
        ) : null}
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
