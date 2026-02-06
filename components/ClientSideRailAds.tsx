// app/components/ClientSideRailAds.tsx
"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

export default function ClientSideRailAds() {
  const pathname = usePathname();
  const initialized = useRef(false);

  // Hide on homepage
  if (pathname === "/") return null;

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      window.adsbygoogle.push({});
    } catch {
      // If blocked, do nothing
    }
  }, []);

  return (
    <>
      {/* LEFT RAIL */}
      <div className="hidden 2xl:block fixed top-24 left-4 w-[160px] min-h-[600px] z-40">
        <div className="w-full h-full bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-2">
          <ins
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
