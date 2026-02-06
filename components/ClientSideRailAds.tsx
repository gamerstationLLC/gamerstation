// app/components/ClientSideRailAds.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

function isFilled(ins: HTMLModElement | null) {
  if (!ins) return false;

  const hasIframe = !!ins.querySelector("iframe");
  const statusDone = ins.getAttribute("data-adsbygoogle-status") === "done";
  const rect = ins.getBoundingClientRect();
  const hasSize = rect.height > 20;

  return hasIframe || statusDone || hasSize;
}

export default function ClientSideRailAds() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const shouldShowOnRoute = useMemo(() => !isHome, [isHome]);

  const leftRef = useRef<HTMLModElement | null>(null);
  const rightRef = useRef<HTMLModElement | null>(null);

  const initializedForPath = useRef<string | null>(null);
  const [showRails, setShowRails] = useState(false);

  useEffect(() => {
    setShowRails(false);

    if (!shouldShowOnRoute) return;

    if (initializedForPath.current === pathname) return;
    initializedForPath.current = pathname;

    let cancelled = false;

    const run = async () => {
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        window.adsbygoogle.push({});
      } catch {
        return; // blocked
      }

      await new Promise((r) => setTimeout(r, 1200));
      if (cancelled) return;

      const leftOk = isFilled(leftRef.current);
      const rightOk = isFilled(rightRef.current);

      if (leftOk || rightOk) setShowRails(true);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [pathname, shouldShowOnRoute]);

  if (!shouldShowOnRoute) return null;

  // No bars/dots/boxes while waiting: render invisibly
  if (!showRails) {
    return (
      <div className="sr-only" aria-hidden="true">
        <ins
          ref={(el) => {
            leftRef.current = el;
          }}
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client="ca-pub-9530220531970117"
          data-ad-slot="7793784284"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
        <ins
          ref={(el) => {
            rightRef.current = el;
          }}
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client="ca-pub-9530220531970117"
          data-ad-slot="2685432413"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  return (
    <>
      {/* LEFT RAIL */}
      <div className="hidden 2xl:block fixed top-24 left-4 w-[160px] min-h-[600px] z-40">
        <div className="w-full h-full bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-2">
          <ins
            ref={(el) => {
              leftRef.current = el;
            }}
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client="ca-pub-9530220531970117"
            data-ad-slot="7793784284"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>

      {/* RIGHT RAIL */}
      <div className="hidden 2xl:block fixed top-24 right-4 w-[160px] min-h-[600px] z-40">
        <div className="w-full h-full bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-2">
          <ins
            ref={(el) => {
              rightRef.current = el;
            }}
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client="ca-pub-9530220531970117"
            data-ad-slot="2685432413"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>
    </>
  );
}
