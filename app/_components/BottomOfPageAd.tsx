"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";

type Props = {
  client: string;
  slot: string; // 3946559101
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

export default function BottomOfPageAd({ client, slot }: Props) {
  const pathname = usePathname();
  const pushedRef = useRef(false);

  const insKey = useMemo(() => `bop:${pathname}:${slot}`, [pathname, slot]);

  useEffect(() => {
    pushedRef.current = false;

    const t = window.setTimeout(() => {
      if (pushedRef.current) return;
      safePush();
      pushedRef.current = true;
    }, 250);

    return () => window.clearTimeout(t);
  }, [pathname, slot]);

  return (
    <div className="w-full py-8 flex justify-center">
      {/* HARD CLAMP: layout can NEVER expand beyond 300×100 */}
      <div style={{ width: 300, height: 100, overflow: "hidden" }}>
        <ins
          key={insKey}
          className="adsbygoogle"
          style={{ display: "inline-block", width: 300, height: 100 }}
          data-ad-client={client}
          data-ad-slot={slot}
        />
      </div>
    </div>
  );
}
