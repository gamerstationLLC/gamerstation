"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type FooterAdProps = {
  client: string;

  // Desktop footer (728x90)
  desktopSlot: string;

  // Mobile footer (320x50)
  mobileSlot: string;

  // optional breakpoint (default: 768)
  mobileMaxWidth?: number;
};

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
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  // Avoid double push in StrictMode / hot reload
  const pushedRef = useRef(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < mobileMaxWidth);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [mobileMaxWidth]);

  // If we don't know yet (SSR -> hydration), render nothing to avoid wrong-size flash
  if (isMobile === null) return null;

  const width = isMobile ? 320 : 728;
  const height = isMobile ? 50 : 90;
  const slot = isMobile ? mobileSlot : desktopSlot;

  // Force a fresh <ins> per route + mode so AdSense re-initializes
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
    }, 120);

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
