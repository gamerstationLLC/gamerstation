"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Props = {
  client: string;

  // Mobile fixed unit (300x100)
  mobileSlot: string; // 3946559101

  // Desktop fixed unit (728x90)
  desktopSlot: string; // 5642784153

  // Tailwind lg breakpoint = 1024px
  desktopMinWidthPx?: number; // default 1024
};

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

function safePush() {
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch {}
}

export default function BottomOfPageAd({
  client,
  mobileSlot,
  desktopSlot,
  desktopMinWidthPx = 1024,
}: Props) {
  const pathname = usePathname();
  const pushedRef = useRef(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Detect desktop (>= 1024px)
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${desktopMinWidthPx}px)`);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [desktopMinWidthPx]);

  // Decide which unit to render
  const { slot, w, h } = useMemo(() => {
    if (isDesktop) return { slot: desktopSlot, w: 728, h: 90 };
    return { slot: mobileSlot, w: 300, h: 100 };
  }, [isDesktop, desktopSlot, mobileSlot]);

  // Force fresh ins per route + slot + size
  const insKey = useMemo(
    () => `bop:${pathname}:${slot}:${w}x${h}`,
    [pathname, slot, w, h]
  );

  // Push when route/slot/size changes
  useEffect(() => {
    pushedRef.current = false;

    const t = window.setTimeout(() => {
      if (pushedRef.current) return;
      safePush();
      pushedRef.current = true;
    }, 250);

    return () => window.clearTimeout(t);
  }, [pathname, slot, w, h]);

  return (
    <div className="w-full py-8 flex justify-center">
      {/* HARD CLAMP: cannot become "massive" */}
      <div style={{ width: w, height: h, overflow: "hidden" }}>
        <ins
          key={insKey}
          className="adsbygoogle"
          style={{ display: "inline-block", width: w, height: h }}
          data-ad-client={client}
          data-ad-slot={slot}
        />
      </div>
    </div>
  );
}
