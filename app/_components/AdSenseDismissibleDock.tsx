// app/_components/AdSenseDismissibleDock.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type Props = {
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

export default function AdSenseDismissibleDock({ client, slot }: Props) {
  const pathname = usePathname();

  // You asked: reload on each page → do NOT persist dismissal.
  const [dismissed, setDismissed] = useState(false);
  const [vw, setVw] = useState<number | null>(null);

  useEffect(() => {
    setDismissed(false);
  }, [pathname]);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 728x90 scaled down on small screens (slim bar, never fullscreen)
  const scale = useMemo(() => {
    if (!vw) return 1;
    const max = Math.min(1, (vw - 24) / 728); // 12px padding each side
    return Math.max(0.42, max);
  }, [vw]);

  const insKey = useMemo(() => `${pathname}:${slot}`, [pathname, slot]);

  useEffect(() => {
    if (dismissed) return;
    const t = window.setTimeout(() => safePushAds(), 60);
    return () => window.clearTimeout(t);
  }, [dismissed, pathname]);

  if (dismissed) return null;

  const scaledHeight = Math.round(90 * scale);

  return (
    <div
      className="fixed inset-x-0 bottom-0"
      style={{
        zIndex: 99999, // sits above sticky footers (and can be X'd)
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="mx-auto w-full max-w-[980px] px-3 pb-3">
        <div
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/80 shadow-2xl backdrop-blur"
          style={{
            height: scaledHeight + 14, // slim container height
          }}
        >
          <button
            type="button"
            aria-label="Close ad"
            onClick={() => setDismissed(true)}
            className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/15"
          >
            ×
          </button>

          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ padding: 10 }}
          >
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
    </div>
  );
}
