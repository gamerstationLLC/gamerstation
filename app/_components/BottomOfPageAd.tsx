"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";

type Props = {
  client: string;
  slot: string;
};

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

export default function BottomOfPageAd({ client, slot }: Props) {
  const pathname = usePathname();
  const pushedRef = useRef(false);

  const insKey = useMemo(() => `bottom:${pathname}:${slot}`, [pathname, slot]);

  useEffect(() => {
    pushedRef.current = false;

    const t = setTimeout(() => {
      if (pushedRef.current) return;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushedRef.current = true;
      } catch {}
    }, 150);

    return () => clearTimeout(t);
  }, [pathname, slot]);

  return (
    <div className="w-full py-8 flex justify-center">
      <ins
        key={insKey}
        className="adsbygoogle"
        style={{ display: "block", width: "100%", maxWidth: 1200 }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
