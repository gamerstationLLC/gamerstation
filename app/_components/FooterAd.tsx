"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type FooterAdProps = {
  client: string;
  desktopSlot: string; // 728x90
  mobileSlot: string;  // 320x50
  mobileMaxWidth?: number; // default 768
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
  mobileMaxWidth = 768,
}: FooterAdProps) {
  const pathname = usePathname();
  const pushedRef = useRef(false);

  // ✅ initialize immediately on first client render (prevents hook count changes)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < mobileMaxWidth;
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < mobileMaxWidth);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [mobileMaxWidth]);

  const width = isMobile ? 320 : 728;
  const height = isMobile ? 50 : 90;
  const slot = isMobile ? mobileSlot : desktopSlot;

  // force fresh <ins> per route + size so AdSense re-inits correctly
  const insKey = useMemo(
    () => `footer:${pathname}:${slot}:${width}x${height}`,
    [pathname, slot, width, height]
  );

  useEffect(() => {
    pushedRef.current = false;

    const t = window.setTimeout(() => {
      if (pushedRef.current) return;
      safePushAds();
      pushedRef.current = true;
    }, 80);

    return () => window.clearTimeout(t);
  }, [pathname, slot, width, height]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-3 pb-6 pt-10">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-center">
          <ins
            key={insKey}
            className="adsbygoogle"
            style={{ display: "inline-block", width, height }}
            data-ad-client={client}
            data-ad-slot={slot}
          />
        </div>
      </div>
    </div>
  );
}
