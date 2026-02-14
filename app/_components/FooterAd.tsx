// app/_components/FooterAd.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type FooterAdProps = {
  client: string;
  slot: string;
};

function safePushAds() {
  try {
    
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch {
    // ignore
  }
}

export default function FooterAd({ client, slot }: FooterAdProps) {
  const pathname = usePathname();
  const [vw, setVw] = useState<number | null>(null);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Scale down 728x90 to fit mobile nicely (never fullscreen)
  const scale = useMemo(() => {
    if (!vw) return 1;
    const max = Math.min(1, (vw - 24) / 728); // 12px padding each side
    return Math.max(0.42, max);
  }, [vw]);

  // Force a fresh <ins> per route so AdSense re-initializes
  const insKey = useMemo(() => `footer:${pathname}:${slot}`, [pathname, slot]);

  useEffect(() => {
    const t = window.setTimeout(() => safePushAds(), 60);
    return () => window.clearTimeout(t);
  }, [pathname, slot]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-3 pb-6 pt-10">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-center">
          <div
            style={{
              width: 728,
              height: 90,
              transform: `scale(${scale})`,
              transformOrigin: "center",
            }}
          >
            <ins
              key={insKey}
              className="adsbygoogle"
              style={{ display: "inline-block", width: 728, height: 90 }}
              data-ad-client={client}
              data-ad-slot={slot}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
