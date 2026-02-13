"use client";

import { useEffect, useMemo, useState } from "react";

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

type Props = {
  adClient: string; // "ca-pub-9530..."
  adSlot: string;   // your slot id
  rememberHours?: number; // remember "X" close
  className?: string;
};

export default function AdSenseDismissibleDock({
  adClient,
  adSlot,
  rememberHours = 12,
  className = "",
}: Props) {
  const storageKey = useMemo(() => `gs_dock_ad_closed_${adSlot}`, [adSlot]);
  const [closed, setClosed] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [pushed, setPushed] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Restore close state
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setClosed(false);
        return;
      }
      const { t } = JSON.parse(raw);
      if (!t) {
        setClosed(false);
        return;
      }
      const ageMs = Date.now() - Number(t);
      const maxMs = rememberHours * 60 * 60 * 1000;
      setClosed(ageMs < maxMs);
    } catch {
      setClosed(false);
    }
  }, [storageKey, rememberHours]);

  useEffect(() => {
    if (!mounted) return;
    if (closed) return;
    if (pushed) return;

    // Push once after visible
    const t = setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        setPushed(true);
      } catch {
        // ignore
      }
    }, 250);

    return () => clearTimeout(t);
  }, [mounted, closed, pushed]);

  function close() {
    setClosed(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ t: Date.now() }));
    } catch {
      // ignore
    }
  }

  // Avoid SSR mismatch flash
  if (!mounted) return null;
  if (closed) return null;

  return (
    <div
      className={[
        // ✅ sits ABOVE any sticky footer (make your sticky footer z-50 or similar)
        "fixed inset-x-0 bottom-0 z-[1000]",
        "pointer-events-none", // container ignores clicks except inner
        "px-2 pb-[max(8px,env(safe-area-inset-bottom))]",
        className,
      ].join(" ")}
    >
      <div
        className={[
          "pointer-events-auto",
          "mx-auto w-full max-w-[900px]",
          "rounded-2xl border border-white/10 bg-black/85 backdrop-blur",
          "shadow-2xl",
          "relative",
          "p-2",
        ].join(" ")}
      >
        {/* X button */}
        <button
          type="button"
          onClick={close}
          aria-label="Close ad"
          className="absolute right-2 top-2 z-10 rounded-full bg-white/10 px-2 py-1 text-xs text-white/90 hover:bg-white/20"
        >
          ✕
        </button>

        {/* Ad slot */}
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={adClient}
          data-ad-slot={adSlot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}
