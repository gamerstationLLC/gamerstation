"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type FooterAdProps = {
  client: string;
  // Desktop slot (728x90)
  slot: string;
  // Mobile slot (320x50)
  mobileSlot?: string;
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
  slot,
  mobileSlot = "3438350693",
}: FooterAdProps) {
  const pathname = usePathname();

  const [isMobile, setIsMobile] = useState(false);
  const pushedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const { w, h, activeSlot } = useMemo(() => {
    if (isMobile) return { w: 320, h: 50, activeSlot: mobileSlot };
    return { w: 728, h: 90, activeSlot: slot };
  }, [isMobile, mobileSlot, slot]);

  // Force a fresh <ins> per route so AdSense re-initializes
  const insKey = useMemo(
    () => `footer:${pathname}:${activeSlot}`,
    [pathname, activeSlot]
  );

  // allow push again whenever route or slot changes
  useEffect(() => {
    pushedRef.current = false;
  }, [pathname, activeSlot]);

  useEffect(() => {
    if (pushedRef.current) return;

    const run = () => {
      safePushAds();
      pushedRef.current = true;
    };

    // small delay so the <ins> exists in DOM and script is ready
    const t = window.setTimeout(run, 80);
    return () => window.clearTimeout(t);
  }, [pathname, activeSlot]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-3 pb-6 pt-10">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-center">
          <ins
            key={insKey}
            className="adsbygoogle"
            style={{ display: "inline-block", width: w, height: h }}
            data-ad-client={client}
            data-ad-slot={activeSlot}
          />
        </div>
      </div>
    </div>
  );
}
