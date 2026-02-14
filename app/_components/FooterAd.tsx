"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type FooterAdProps = {
  client: string;
  desktopSlot: string; // intended 728x90 (we'll use this for desktop)
  mobileSlot: string; // mobile responsive slot
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

  // ✅ Desktop should use the fixed 728x90 unit you pasted (slot 5642784153)
  // If you want to hard-force that slot regardless of prop, do:
  // const desktopFixedSlot = "5642784153";
  // But since you're passing it from layout, we just use desktopSlot.
  const slot = isMobile ? mobileSlot : desktopSlot;

  const insKey = useMemo(
    () => `footer:${pathname}:${slot}:${isMobile ? "m" : "d"}`,
    [pathname, slot, isMobile]
  );

  useEffect(() => {
    pushedRef.current = false;

    const t = window.setTimeout(() => {
      if (pushedRef.current) return;
      safePushAds();
      pushedRef.current = true;
    }, 120);

    return () => window.clearTimeout(t);
  }, [pathname, slot, isMobile]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-3 pb-6 pt-10">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-center">
          {isMobile ? (
            // ✅ Mobile: keep exactly the same responsive behavior
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
            // ✅ Desktop: fixed 728x90 (matches the snippet you pasted)
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
