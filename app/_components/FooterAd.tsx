"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type FooterAdProps = {
  client: string;
  desktopSlot: string; // fixed 728x90
  mobileSlot: string;  // responsive or fixed 320x50
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
}: FooterAdProps) {
  const pathname = usePathname();
  const pushedRef = useRef(false);

  const [isMobile, setIsMobile] = useState(false);

  // ✅ Match Tailwind lg breakpoint (1024px)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const slot = isMobile ? mobileSlot : desktopSlot;

  const insKey = useMemo(
    () => `footer:${pathname}:${slot}`,
    [pathname, slot]
  );

  // ✅ Enable footer reserve while mounted
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.footerAd = "1";
    return () => {
      if (root.dataset.footerAd === "1") {
        delete root.dataset.footerAd;
      }
    };
  }, []);

  // Push ad
  useEffect(() => {
    pushedRef.current = false;

    const t = window.setTimeout(() => {
      if (pushedRef.current) return;
      safePushAds();
      pushedRef.current = true;
    }, 120);

    return () => window.clearTimeout(t);
  }, [pathname, slot]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-3 pb-6 pt-10">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-center">
          {isMobile ? (
            // ✅ Mobile responsive
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
            // ✅ Desktop fixed 728x90
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
