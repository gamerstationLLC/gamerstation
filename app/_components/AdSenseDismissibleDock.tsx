// app/_components/AdSenseDismissibleDock.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  client: string; // "ca-pub-..."
  slot: string;   // "8145648829"
  /**
   * If you ever want the user's X to persist across route changes,
   * flip this to true and it will store state in sessionStorage.
   * For now, you said you want it to reload on each page => false.
   */
  persistDismiss?: boolean;
};

export default function AdSenseDismissibleDock({
  client,
  slot,
  persistDismiss = false,
}: Props) {
  const [dismissed, setDismissed] = useState(false);

  // used to avoid double-push in StrictMode / remounts
  const pushedRef = useRef(false);

  // scale logic (728 -> fit container)
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [hostW, setHostW] = useState(0);

  const baseW = 728;
  const baseH = 90;

  const scale = useMemo(() => {
    if (!hostW) return 1;
    return Math.min(1, hostW / baseW);
  }, [hostW]);

  const scaledH = Math.round(baseH * scale);

  // optional persistence (OFF by default since you want reload-per-page)
  useEffect(() => {
    if (!persistDismiss) return;
    try {
      const v = sessionStorage.getItem("gs_ads_dock_dismissed");
      if (v === "1") setDismissed(true);
    } catch {}
  }, [persistDismiss]);

  useEffect(() => {
    if (!persistDismiss) return;
    try {
      sessionStorage.setItem("gs_ads_dock_dismissed", dismissed ? "1" : "0");
    } catch {}
  }, [dismissed, persistDismiss]);

  // observe width so we can scale down on mobile
  useEffect(() => {
    if (!hostRef.current) return;

    const el = hostRef.current;
    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      setHostW(Math.floor(w));
    });

    ro.observe(el);
    // initial
    setHostW(Math.floor(el.getBoundingClientRect().width));

    return () => ro.disconnect();
  }, []);

  // push ad after mount (and after the script is available)
  useEffect(() => {
    if (dismissed) return;
    if (pushedRef.current) return;

    const run = () => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushedRef.current = true;
      } catch {
        // ignore
      }
    };

    // give Next hydration + ads script a moment
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 400);
    }
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <div
      className="fixed left-0 right-0 bottom-0 z-[9999]"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Centered dock container */}
      <div
        ref={hostRef}
        className="
          relative mx-auto
          w-[min(100vw,900px)]
          px-3
        "
      >
        {/* Background bar */}
        <div
          className="
            relative overflow-hidden rounded-2xl
            border border-white/10
            bg-black/80 backdrop-blur
            shadow-[0_10px_35px_rgba(0,0,0,0.55)]
          "
          style={{
            // keep the bar slim and predictable on mobile
            height: scaledH + 14, // + padding room
          }}
        >
          {/* Close button */}
          <button
            type="button"
            aria-label="Close ad"
            onClick={() => setDismissed(true)}
            className="
              absolute right-2 top-1/2 -translate-y-1/2
              h-9 w-9 rounded-full
              bg-white/10 hover:bg-white/15
              border border-white/10
              text-white/90
              grid place-items-center
              z-10
            "
          >
            ✕
          </button>

          {/* Ad area (scaled) */}
          <div
            className="absolute left-2 top-1/2 -translate-y-1/2"
            style={{
              width: `calc(100% - 56px)`, // leave room for X
              height: scaledH,
            }}
          >
            <div
              style={{
                width: baseW,
                height: baseH,
                transform: `scale(${scale})`,
                transformOrigin: "left center",
              }}
            >
              <ins
                className="adsbygoogle"
                style={{ display: "inline-block", width: baseW, height: baseH }}
                data-ad-client={client}
                data-ad-slot={slot}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
