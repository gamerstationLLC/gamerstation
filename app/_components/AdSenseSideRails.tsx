"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

function isDesktopLike() {
  if (typeof window === "undefined") return false;

  // True desktop signal: wide viewport + mouse/trackpad style input.
  // iPads/tablets typically have pointer: coarse and hover: none (even in desktop mode).
  return window.matchMedia(
    "(min-width: 1280px) and (pointer: fine) and (hover: hover)"
  ).matches;
}

export default function AdSenseSideRails() {
  const [enabled, setEnabled] = useState(false);

  const leftRef = useRef<HTMLModElement | null>(null);
  const rightRef = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    const update = () => setEnabled(isDesktopLike());
    update();

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    try {
      if (leftRef.current) (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}

    try {
      if (rightRef.current) (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="pointer-events-none" aria-hidden="true">
      {/* Left rail */}
      <div className="fixed left-0 top-0 z-40 h-screen w-[160px]">
        <div className="pointer-events-auto h-full px-2 pt-24">
          <ins
            ref={leftRef}
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client="ca-pub-9530220531970117"
            data-ad-slot="7793784284"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>

      {/* Right rail */}
      <div className="fixed right-0 top-0 z-40 h-screen w-[160px]">
        <div className="pointer-events-auto h-full px-2 pt-24">
          <ins
            ref={rightRef}
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client="ca-pub-9530220531970117"
            data-ad-slot="7793784284"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>
    </div>
  );
}
