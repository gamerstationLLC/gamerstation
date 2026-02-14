"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";

type FooterAdProps = {
  client: string;
  slot: string; // use your "mobile" slot everywhere
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

export default function FooterAd({ client, slot }: FooterAdProps) {
  const pathname = usePathname();
  const pushedRef = useRef(false);

  const insKey = useMemo(() => `footer:${pathname}:${slot}`, [pathname, slot]);

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
          <ins
            key={insKey}
            className="adsbygoogle"
            style={{ display: "block", width: "100%" }}
            data-ad-client={client}
            data-ad-slot={slot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>
    </div>
  );
}
