"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Parsed = { gameName: string; tagLine: string } | null;

function parseRiotId(raw: string): Parsed {
  const s = (raw || "").trim();
  if (!s) return null;

  const hash = s.lastIndexOf("#");
  if (hash <= 0 || hash >= s.length - 1) return null;

  const gameName = s.slice(0, hash).trim();
  let tagLine = s.slice(hash + 1).trim();

  tagLine = tagLine.replace(/^#+/, "");
  if (!gameName || !tagLine) return null;

  return { gameName, tagLine };
}

type SuggestApiResult = {
  riotId: string;
  gameName: string;
  tagLine: string;
  platform: string;
  cluster: string;
  seen: number;
  lastSeen: number;
};

type ResolveResult = {
  puuid: string;
  platform: string; // na1, euw1, kr, etc
  cluster: string;  // americas, europe, asia, sea
  gameName?: string;
  tagLine?: string;
};

export default function SummonerLookupClient() {
  const router = useRouter();

  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const [remote, setRemote] = useState<SuggestApiResult[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const rootRef = useRef<HTMLFormElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => parseRiotId(input), [input]);

  /* -------------------------
     Fetch suggestions (READ)
  -------------------------- */
  useEffect(() => {
    const q = input.trim();
    if (!open) return;

    if (q.length < 2) {
      setRemote([]);
      setActiveIndex(-1);
      return;
    }

    const ac = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        setSuggestLoading(true);

        const qs = new URLSearchParams({ q, limit: "5" });
        const res = await fetch(`/api/tools/lol/summoner/suggest?${qs.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: ac.signal,
        });

        if (!res.ok) {
          if (!cancelled) setRemote([]);
          return;
        }

        const json = await res.json();
        const results = Array.isArray(json?.results) ? json.results : [];

        if (!cancelled) {
          setRemote(results);
          setActiveIndex(-1);
        }
      } catch {
        if (!cancelled) setRemote([]);
      } finally {
        if (!cancelled) setSuggestLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [input, open]);

  const suggestions = useMemo(
    () => remote.map((r) => r.riotId).slice(0, 5),
    [remote]
  );

  const showDropdown = open && (suggestions.length > 0 || suggestLoading);

  /* -------------------------
     Submit (RESOLVE + LOG + NAV)
  -------------------------- */
  async function preflightAndGo() {
    setError("");
    if (isLoading) return;

    if (!parsed) {
      setError("Enter a Riot ID in the format GameName#TAG.");
      return;
    }

    setIsLoading(true);

    try {
      const qs = new URLSearchParams({
        gameName: parsed.gameName,
        tagLine: parsed.tagLine,
      });

      const res = await fetch(`/api/lol/resolve-riot-id?${qs.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (res.status === 404) {
        setError("Summoner can’t be found.");
        return;
      }

      if (!res.ok) {
        setError("Lookup failed. Try again in a moment.");
        return;
      }

      // ✅ We assume your resolver returns puuid/platform/cluster
      const resolved = (await res.json()) as ResolveResult;

      // ✅ LOG to Blob index (WRITE) — fire-and-forget, never blocks navigation
      if (resolved?.puuid && resolved?.platform && resolved?.cluster) {
        fetch("/api/tools/lol/summoner/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            puuid: resolved.puuid,
            gameName: parsed.gameName,
            tagLine: parsed.tagLine,
            platform: resolved.platform,
            cluster: resolved.cluster,
          }),
        }).catch(() => {
          // ignore
        });
      }

      router.push(
        `/tools/lol/summoner/${encodeURIComponent(
          parsed.gameName
        )}/${encodeURIComponent(parsed.tagLine)}`
      );
    } catch {
      setError("Lookup failed. Try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }

  function pickSuggestion(value: string) {
    setInput(value);
    setOpen(false);
    setActiveIndex(-1);
    if (error) setError("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  /* -------------------------
     Keyboard navigation
  -------------------------- */
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) {
      if (e.key === "Enter") {
        e.preventDefault();
        preflightAndGo();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1 >= suggestions.length ? 0 : i + 1));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 < 0 ? suggestions.length - 1 : i - 1));
      return;
    }

    if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        pickSuggestion(suggestions[activeIndex]);
      } else {
        preflightAndGo();
      }
    }
  }

  /* -------------------------
     Outside click close
  -------------------------- */
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

  /* -------------------------
     UI
  -------------------------- */
  return (
    <form
      ref={rootRef}
      onSubmit={(e) => {
        e.preventDefault();
        preflightAndGo();
      }}
      className="relative w-full"
    >
      <div className="flex gap-2">
        <div className="relative w-full">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError("");
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search Riot ID (GameName#TAG)"
            className="h-10 w-full rounded-2xl border border-neutral-800 bg-black/60 px-4 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-neutral-600"
            autoComplete="off"
            spellCheck={false}
          />

          {showDropdown && (
            <div className="absolute left-0 right-0 top-[44px] z-50 overflow-hidden rounded-2xl border border-neutral-800 bg-black/95 shadow-[0_0_30px_rgba(0,255,255,0.08)]">
              {suggestLoading && (
                <div className="px-4 py-3 text-xs text-neutral-400">Searching…</div>
              )}

              {!suggestLoading &&
                suggestions.map((s, idx) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => pickSuggestion(s)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full px-4 py-2 text-left text-sm transition ${
                      idx === activeIndex
                        ? "bg-white/10 text-white"
                        : "text-neutral-200 hover:bg-white/10"
                    }`}
                  >
                    {s}
                  </button>
                ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="h-10 rounded-2xl bg-white px-5 text-sm font-black text-black transition hover:opacity-90 disabled:opacity-60"
        >
          {isLoading ? "Loading…" : "Search"}
        </button>
      </div>

      {error && (
        <div className="mt-2 rounded-2xl border border-rose-900/40 bg-rose-950/25 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}
    </form>
  );
}
