// app/_components/SiteSearch.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Entry = {
  href: string; // path only
  label: string; // fallback label (path-derived)
  display?: string; // resolved H1/title (cached)
};

function titleCaseSegment(seg: string) {
  const s = decodeURIComponent(seg || "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!s) return "";
  // keep acronyms like "ttk" -> "TTK"
  if (s.length <= 4 && /^[a-z0-9 ]+$/.test(s)) return s.toUpperCase();
  return s
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalizePathFromUrl(url: string) {
  try {
    const u = new URL(url);
    return u.pathname || "/";
  } catch {
    if (!url.startsWith("/")) return `/${url}`;
    return url;
  }
}

function toLabelFromPath(path: string) {
  const clean = path.split("?")[0].split("#")[0];
  const parts = clean.split("/").filter(Boolean).map(titleCaseSegment);
  if (parts.length === 0) return "Home";
  return parts.join(" / ");
}

function dedupePaths(paths: string[]) {
  const set = new Set<string>();
  for (const p of paths) {
    const clean = p.split("?")[0].split("#")[0];
    const normalized = clean !== "/" ? clean.replace(/\/+$/, "") : "/";
    set.add(normalized);
  }
  return Array.from(set);
}

async function fetchSitemapPaths(): Promise<string[]> {
  const candidates = ["/sitemap.xml", "/sitemap-index.xml"];

  for (const c of candidates) {
    try {
      const res = await fetch(c, { cache: "no-store" });
      if (!res.ok) continue;
      const xmlText = await res.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, "application/xml");

      // Sitemap index → fetch children
      const sitemapLocs = Array.from(
        doc.querySelectorAll("sitemapindex sitemap loc"),
      )
        .map((n) => n.textContent?.trim())
        .filter(Boolean) as string[];

      if (sitemapLocs.length > 0) {
        const childPaths: string[] = [];
        for (const loc of sitemapLocs) {
          try {
            const childRes = await fetch(loc, { cache: "no-store" });
            if (!childRes.ok) continue;
            const childXml = await childRes.text();
            const childDoc = parser.parseFromString(childXml, "application/xml");
            const urls = Array.from(childDoc.querySelectorAll("urlset url loc"))
              .map((n) => n.textContent?.trim())
              .filter(Boolean) as string[];
            for (const u of urls) childPaths.push(normalizePathFromUrl(u));
          } catch {
            // ignore one child failure
          }
        }
        if (childPaths.length > 0) return dedupePaths(childPaths);
      }

      // Normal urlset sitemap
      const urlLocs = Array.from(doc.querySelectorAll("urlset url loc"))
        .map((n) => n.textContent?.trim())
        .filter(Boolean) as string[];

      if (urlLocs.length > 0) {
        return dedupePaths(urlLocs.map(normalizePathFromUrl));
      }
    } catch {
      // try next candidate
    }
  }

  return [];
}

// ✅ Turn <title> "Something | GamerStation" into "Something"
function cleanTitle(t: string) {
  const s = (t || "").trim();
  if (!s) return "";
  return s.replace(/\s*\|\s*GamerStation.*$/i, "").trim();
}

// ✅ Fetch H1 (preferred) or Title from same-origin HTML
async function fetchDisplayForPath(path: string): Promise<string> {
  if (!path || path.startsWith("/api")) return "";

  const res = await fetch(path, {
    cache: "force-cache",
    credentials: "same-origin",
  });
  if (!res.ok) return "";

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  const h1 = doc.querySelector("h1")?.textContent?.trim() || "";
  if (h1) return h1;

  const title = doc.querySelector("title")?.textContent?.trim() || "";
  return cleanTitle(title);
}

/**
 * ✅ The key: immediate, stable display title derived from href.
 * This prevents the breadcrumb flash / switching.
 */
function immediateTitleFromHref(href: string, fallbackLabel: string) {
  const clean = (href || "/").split("?")[0].split("#")[0];
  if (clean === "/" || clean === "") return "Home";

  const parts = clean.split("/").filter(Boolean);

  // Special-case: LoL Champion index page
  if (clean === "/calculators/lol/champions") return "LoL Champion Index";

  // Special-case: Champion detail pages → last segment is champ id/name
  if (parts.length >= 4 && parts[0] === "calculators" && parts[1] === "lol" && parts[2] === "champions") {
    const champ = titleCaseSegment(parts[3] || "");
    if (champ) return champ;
  }

  // Generic: last segment (nice-looking)
  const last = titleCaseSegment(parts[parts.length - 1] || "");
  if (last && !/^\d+$/.test(last)) return last;

  // Worst case fallback
  return fallbackLabel || toLabelFromPath(clean);
}

/**
 * Optional context line. For your case this makes champs feel clean:
 * Title: "Akali"
 * Context: "LoL Champions"
 */
function contextFromHref(href: string) {
  const clean = (href || "/").split("?")[0].split("#")[0];
  const parts = clean.split("/").filter(Boolean);

  if (clean === "/calculators/lol/champions") return "Calculators";
  if (parts[0] === "calculators" && parts[1] === "lol" && parts[2] === "champions") return "LoL Champions";
  if (parts[0] === "calculators" && parts[1] === "lol") return "LoL Calculators";
  if (parts[0] === "tools" && parts[1] === "lol") return "LoL Tools";
  if (parts[0] === "tools" && parts[1] === "dota") return "Dota Tools";

  // A light generic context: parent path (without showing slashes to users)
  if (parts.length >= 2) {
    const parent = titleCaseSegment(parts[parts.length - 2]);
    return parent || "";
  }

  return "";
}

const FALLBACK: Entry[] = [
  { href: "/", label: "Home" },
  { href: "/calculators", label: "Calculators" },
  { href: "/tools", label: "Tools" },

  { href: "/calculators/ttk/cod", label: "COD TTK Calculator" },
  { href: "/calculators/lol/champions", label: "LoL Champion Index" },
  { href: "/tools/lol", label: "LoL Tools" },
  { href: "/tools/dota", label: "Dota Tools" },

  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
  { href: "/disclaimer", label: "Disclaimer" },
];

export default function SiteSearch() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<Entry[]>(FALLBACK);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // href -> display cache (memory)
  const displayCacheRef = useRef<Map<string, string>>(new Map());
  // in-flight fetches (avoid duplicate)
  const inflightRef = useRef<Map<string, Promise<string>>>(new Map());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const paths = await fetchSitemapPaths();
      if (cancelled) return;

      if (paths.length > 0) {
        const built: Entry[] = paths
          .filter((p) => !p.startsWith("/api"))
          .map((href) => ({ href, label: toLabelFromPath(href) }))
          .sort((a, b) => a.label.localeCompare(b.label));

        setEntries(built);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries.slice(0, 10);

    const maybePath = q.includes("gamerstation.gg")
      ? normalizePathFromUrl(q)
      : q.startsWith("/")
        ? q
        : "";

    const scored = entries
      .map((e) => {
        const immediate = immediateTitleFromHref(e.href, e.label);
        const display = e.display || immediate;

        // ✅ Search uses display + label + href, but UI won’t show href.
        const hay = `${display} ${e.label} ${e.href}`.toLowerCase();

        let score = 0;
        if (maybePath && e.href.toLowerCase() === maybePath) score += 1000;
        if (e.href.toLowerCase() === q) score += 800;
        if (hay.includes(q)) score += 200;

        const tokens = q.split(/\s+/).filter(Boolean);
        for (const t of tokens) {
          if (hay.includes(t)) score += 25;
        }

        if (display.toLowerCase().startsWith(q)) score += 80;
        if (e.label.toLowerCase().startsWith(q)) score += 40;

        return { e, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((x) => x.e);

    return scored.length > 0 ? scored : entries.slice(0, 10);
  }, [entries, query]);

  // ✅ Resolve titles for visible results, but only "upgrade" if better than immediate title
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const keyPrefix = "gs:searchDisplay:";

    async function ensureDisplay(href: string) {
      const mem = displayCacheRef.current.get(href);
      if (mem) return mem;

      try {
        const ss = sessionStorage.getItem(keyPrefix + href);
        if (ss) {
          displayCacheRef.current.set(href, ss);
          return ss;
        }
      } catch {}

      const inflight = inflightRef.current.get(href);
      if (inflight) return inflight;

      const p = (async () => {
        try {
          const display = await fetchDisplayForPath(href);
          const finalDisplay = (display || "").trim();
          if (finalDisplay) {
            displayCacheRef.current.set(href, finalDisplay);
            try {
              sessionStorage.setItem(keyPrefix + href, finalDisplay);
            } catch {}
          }
          return finalDisplay;
        } catch {
          return "";
        } finally {
          inflightRef.current.delete(href);
        }
      })();

      inflightRef.current.set(href, p);
      return p;
    }

    (async () => {
      const visible = results.slice(0, 10);
      const updates: Array<{ href: string; display: string }> = [];

      for (const r of visible) {
        const fetched = await ensureDisplay(r.href);
        if (cancelled) return;
        if (!fetched) continue;

        // ✅ only apply if it improves on what we already show
        const immediate = immediateTitleFromHref(r.href, r.label);
        const isBetter =
          fetched.trim().length > 0 &&
          fetched.trim().toLowerCase() !== immediate.trim().toLowerCase();

        // If fetched is same as immediate, we can skip updating to avoid any rerender “switch”
        if (isBetter) updates.push({ href: r.href, display: fetched.trim() });
      }

      if (cancelled || updates.length === 0) return;

      setEntries((prev) => {
        const map = new Map(updates.map((u) => [u.href, u.display]));
        let changed = false;
        const next = prev.map((e) => {
          const d = map.get(e.href);
          if (d && e.display !== d) {
            changed = true;
            return { ...e, display: d };
          }
          return e;
        });
        return changed ? next : prev;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [open, results]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  function goTo(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      (e.currentTarget as HTMLInputElement).blur();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.max(a - 1, 0));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();

      const q = query.trim();
      if (!q) return;

      if (q.startsWith("/")) {
        goTo(q);
        return;
      }

      if (q.includes("http://") || q.includes("https://") || q.includes("gamerstation.gg")) {
        goTo(normalizePathFromUrl(q));
        return;
      }

      const pick = results[active] ?? results[0];
      if (pick) goTo(pick.href);
    }
  }

  return (
    <div ref={rootRef} className="relative w-full sm:w-auto">
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search pages…"
          className="
            w-full sm:w-[260px]
            rounded-xl border border-neutral-800
            bg-black px-3 py-2 text-sm text-neutral-200
            outline-none transition
            placeholder:text-neutral-500
            focus:border-neutral-500
            focus:shadow-[0_0_25px_rgba(0,255,255,0.20)]
          "
          aria-label="Search GamerStation pages"
        />
      </div>

      {open && results.length > 0 && (
        <div
          className="
            absolute mt-2
            left-0 right-0 w-full
            sm:left-auto sm:right-0 sm:w-[420px]
            rounded-2xl border border-white/10 bg-black/90
            shadow-[0_20px_60px_rgba(0,0,0,0.6)]
            backdrop-blur
            overflow-hidden
            z-50
          "
          role="listbox"
          aria-label="Search results"
        >
          <div className="max-h-[260px] sm:max-h-[320px] overflow-auto p-2">
            {results.map((r, idx) => {
              const isActive = idx === active;

              // ✅ immediate = stable (no breadcrumb flash)
              const immediate = immediateTitleFromHref(r.href, r.label);
              const display = (r.display || immediate).trim() || immediate;

              const ctx = contextFromHref(r.href);

              return (
                <button
                  key={r.href}
                  type="button"
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => goTo(r.href)}
                  className={`
                    w-full text-left rounded-xl px-3 py-2 transition
                    ${isActive ? "bg-white/10" : "hover:bg-white/5"}
                  `}
                >
                  <div className="text-sm font-semibold text-white/90 truncate">
                    {display}
                  </div>

                  {/* ✅ optional context line (no slashes) */}
                  {ctx ? (
                    <div className="mt-0.5 text-xs text-neutral-400 truncate">
                      {ctx}
                    </div>
                  ) : null}

                  {/* keep href for accessibility/search/debug but never show it */}
                  <span className="sr-only">{r.href}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-[11px] text-neutral-500">
            <span className="truncate">↑↓ • Enter to open • Esc to close</span>
            <span className="shrink-0 text-neutral-600">
              {entries === FALLBACK ? "fallback" : "sitemap"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
