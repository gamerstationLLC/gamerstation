"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type FooterAdProps = {
  client: string;
  desktopSlot: string; // intended 728x90
  mobileSlot: string; // responsive mobile slot
  mobileMaxWidth?: number; // default 780
};

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

function safePushAds() {
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch {
    // ignore
  }
}

export default function FooterAd({
  client,
  desktopSlot,
  mobileSlot,
  mobileMaxWidth = 780,
}: FooterAdProps) {
  const pathname = usePathname();
  const pushedRef = useRef(false);

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < mobileMaxWidth;
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < mobileMaxWidth);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [mobileMaxWidth]);

  const slot = isMobile ? mobileSlot : desktopSlot;

  const insKey = useMemo(() => `footer:${pathname}:${slot}:${isMobile ? "m" : "d"}`, [
    pathname,
    slot,
    isMobile,
  ]);

  useEffect(() => {
    pushedRef.current = false;

    const t = window.setTimeout(() => {
      if (pushedRef.current) return;
      safePushAds();
      pushedRef.current = true;
    }, 80);

    return () => window.clearTimeout(t);
  }, [pathname, slot, isMobile]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-3 pb-6 pt-10">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-center">
          {isMobile ? (
            // ✅ Mobile: responsive. Do NOT force width/height.
            <ins
              key={insKey}
              className="adsbygoogle"
              style={{ display: "block", width: "100%" }}
              data-ad-client={client}
              data-ad-slot={mobileSlot}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          ) : (
            // ✅ Desktop: fixed leaderboard (728x90)
            <ins
              key={insKey}
              className="adsbygoogle"
              style={{ display: "inline-block", width: 728, height: 90 }}
              data-ad-client={client}
              data-ad-slot={desktopSlot}
            />
          )}
        </div>
      </div>
    </div>
  );
}
