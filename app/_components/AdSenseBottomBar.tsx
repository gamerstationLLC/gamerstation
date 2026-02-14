"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  client: string; // "ca-pub-9530..."
  slot: string;   // your ad slot
  storageKey?: string; // allow override
};

export default function AdSenseBottomBar({
  client,
  slot,
  storageKey = "gs_adsense_bottombar_closed_v1",
}: Props) {
  const pushedRef = useRef(false);
  const [closed, setClosed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const v = localStorage.getItem(storageKey);
      if (v === "1") setClosed(true);
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    if (!mounted || closed) return;
    if (pushedRef.current) return;

    const run = () => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushedRef.current = true;
      } catch {
        // ignore (blocked / not ready)
      }
    };

    // push after initial render without blocking interaction
    if (typeof (window as any).requestIdleCallback === "function") {
      (window as any).requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 350);
    }
  }, [mounted, closed]);

  const onClose = () => {
    setClosed(true);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {}
  };

  const ariaHidden = useMemo(() => (closed ? true : undefined), [closed]);

  // Don’t render server-side (prevents hydration weirdness)
  if (!mounted || closed) return null;

  return (
    <div
      aria-hidden={ariaHidden}
      className="
        fixed inset-x-0 bottom-0 z-[9999]
        pointer-events-none
        px-2
        pb-[max(8px,env(safe-area-inset-bottom))]
      "
    >
      <div className="mx-auto w-full max-w-[820px] pointer-events-auto">
        <div
          className="
            relative
            overflow-hidden
            rounded-2xl
            border border-white/10
            bg-black/70
            backdrop-blur
            shadow-[0_8px_40px_rgba(0,0,0,0.55)]
          "
        >
          {/* X button */}
          <button
            type="button"
            onClick={onClose}
            className="
              absolute right-2 top-2 z-10
              grid h-7 w-7 place-items-center
              rounded-full
              bg-white/10 hover:bg-white/20
              text-white/80 hover:text-white
            "
            aria-label="Close ad"
          >
            ✕
          </button>

          {/* Hard clamp height so it never becomes a giant white box */}
          <div className="h-[60px] sm:h-[70px] flex items-center justify-center px-2">
            <ins
              className="adsbygoogle"
              style={{
                display: "block",
                width: "100%",
                height: "50px", // slim mobile banner height
              }}
              data-ad-client={client}
              data-ad-slot={slot}
              data-ad-format="horizontal"
              data-full-width-responsive="true"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
