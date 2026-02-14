"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  client?: string;
  slot: string; // your bottom bar slot (e.g. 8696313160 or 8372879537)
  storageKey?: string; // per-site dismissal key
  zIndex?: number; // make it win over sticky footers
};

export default function AdSenseDismissibleDock({
  client = "ca-pub-9530220531970117",
  slot,
  storageKey = "gs_dismiss_ad_dock_v1",
  zIndex = 99999,
}: Props) {
  const insRef = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);

  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  // show on all pages unless dismissed
  const shouldShow = useMemo(() => true, []);

  useEffect(() => {
    setMounted(true);
    try {
      const v = localStorage.getItem(storageKey);
      setDismissed(v === "1");
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!mounted || dismissed || !shouldShow) return;
    if (!insRef.current) return;
    if (pushedRef.current) return;

    const runPush = () => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushedRef.current = true;
      } catch {
        // ignore
      }
    };

    // Avoid blocking: push on idle / shortly after mount
    if (typeof window.requestIdleCallback === "function") {
      // @ts-ignore
      window.requestIdleCallback(runPush, { timeout: 1500 });
    } else {
      setTimeout(runPush, 250);
    }
  }, [mounted, dismissed, shouldShow]);

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
  };

  if (!mounted || dismissed || !shouldShow) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0"
      style={{ zIndex }}
      aria-label="Advertisement"
    >
      {/* safe-area padding for iOS */}
      <div className="mx-auto w-full max-w-[1200px] px-2 pb-[max(env(safe-area-inset-bottom),0px)]">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/70 shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur">
          {/* Close button */}
          <button
            type="button"
            onClick={close}
            aria-label="Close ad"
            className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white/80 hover:text-white border border-white/10"
          >
            ×
          </button>

          {/* Ad container: keep it slim-ish on mobile */}
          <div className="px-2 py-2">
            <ins
              ref={insRef}
              className="adsbygoogle block w-full"
              style={{
                display: "block",
                // helps prevent “full screen white box” vibes on mobile
                minHeight: 60,
              }}
              data-ad-client={client}
              data-ad-slot={slot}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
