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
  const hasSize = rect.width > 20 && rect.height > 20;
  return hasIframe || statusDone || hasSize;
}

type FillState = "checking" | "filled" | "empty";

export default function ClientSideRailAds() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const shouldRunOnRoute = useMemo(() => !isHome, [isHome]);

  const warmLeftRef = useRef<HTMLModElement | null>(null);
  const warmRightRef = useRef<HTMLModElement | null>(null);

  const [fillState, setFillState] = useState<FillState>("checking");
  const checkedForPath = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldRunOnRoute) {
      setFillState("empty");
      return;
    }

    // reset per-route
    if (checkedForPath.current !== pathname) {
      checkedForPath.current = pathname;
      setFillState("checking");
    } else {
      // already checked this path
      return;
    }

    let cancelled = false;

    const run = async () => {
      // Wait a tick so refs exist
      await new Promise((r) => setTimeout(r, 0));
      if (cancelled) return;

      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        window.adsbygoogle.push({});
      } catch {
        setFillState("empty");
        return;
      }

      // Try a few times (AdSense can be slow)
      const delays = [800, 2500, 6000, 12000];

      for (const ms of delays) {
        await new Promise((r) => setTimeout(r, ms));
        if (cancelled) return;

        const leftOk = isFilled(warmLeftRef.current);
        const rightOk = isFilled(warmRightRef.current);

        if (leftOk || rightOk) {
          setFillState("filled");
          return;
        }
      }

      setFillState("empty");
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [pathname, shouldRunOnRoute]);

  // Homepage: nothing
  if (!shouldRunOnRoute) return null;

  // If not filled, render NOTHING visible (no shells, no dots, no bars)
  // But while "checking", we render off-screen warmup slots at real size.
  if (fillState !== "filled") {
    return (
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          left: "-10000px",
          top: "0",
          width: "160px",
          minHeight: "600px",
          overflow: "hidden",
          pointerEvents: "none",
          opacity: 0,
        }}
      >
        {/* Warmup LEFT */}
        <ins
          ref={(el) => {
            warmLeftRef.current = el;
          }}
          className="adsbygoogle"
          style={{ display: "block", width: "160px", minHeight: "600px" }}
          data-ad-client="ca-pub-9530220531970117"
          data-ad-slot="7793784284"
          data-ad-format="auto"
          data-full-width-responsive="false"
        />

        {/* Warmup RIGHT */}
        <ins
          ref={(el) => {
            warmRightRef.current = el;
          }}
          className="adsbygoogle"
          style={{ display: "block", width: "160px", minHeight: "600px" }}
          data-ad-client="ca-pub-9530220531970117"
          data-ad-slot="2685432413"
          data-ad-format="auto"
          data-full-width-responsive="false"
        />
      </div>
    );
  }

  // Only once we KNOW there's fill do we mount the real rails.
  // And we do NOT add any “tab/background” wrappers.
  return (
    <>
      {/* LEFT RAIL (no shell) */}
      <div className="hidden 2xl:block fixed top-24 left-4 w-[160px] min-h-[600px] z-40">
        <ins
          className="adsbygoogle"
          style={{ display: "block", width: "160px", minHeight: "600px" }}
          data-ad-client="ca-pub-9530220531970117"
          data-ad-slot="7793784284"
          data-ad-format="auto"
          data-full-width-responsive="false"
        />
      </div>

      {/* RIGHT RAIL (no shell) */}
      <div className="hidden 2xl:block fixed top-24 right-4 w-[160px] min-h-[600px] z-40">
        <ins
          className="adsbygoogle"
          style={{ display: "block", width: "160px", minHeight: "600px" }}
          data-ad-client="ca-pub-9530220531970117"
          data-ad-slot="2685432413"
          data-ad-format="auto"
          data-full-width-responsive="false"
        />
      </div>
    </>
  );
}
