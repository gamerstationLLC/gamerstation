"use client";

import { useEffect, useRef } from "react";

export default function AdSenseSideRails() {
  const leftRef = useRef<HTMLModElement | null>(null);
  const rightRef = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    try {
      if (leftRef.current) (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
    try {
      if (rightRef.current) (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, []);

  return (
    <div className="hidden lg:block pointer-events-none" aria-hidden="true">
      {/* Left rail */}
      <div className="fixed left-0 top-0 z-40 h-screen w-[160px]">
        <div className="pointer-events-auto h-full px-2 pt-24">
          <ins
            ref={leftRef}
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client="ca-pub-9530220531970117"
            data-ad-slot="7793784284"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>

      {/* Right rail */}
      <div className="fixed right-0 top-0 z-40 h-screen w-[160px]">
        <div className="pointer-events-auto h-full px-2 pt-24">
          <ins
            ref={rightRef}
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client="ca-pub-9530220531970117"
            data-ad-slot="7793784284"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>
    </div>
  );
}
