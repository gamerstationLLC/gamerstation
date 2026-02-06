"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

export default function ClientSideRailAds() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    if (isHome) return;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      window.adsbygoogle.push({});
    } catch {
      // ignore (adblock / not ready yet)
    }
  }, [pathname, isHome]);

  if (isHome) return null;

  return (
    <>
      {/* LEFT RAIL */}
      <div className="hidden xl:block fixed top-24 left-4 w-[160px] z-40">
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client="ca-pub-9530220531970117"
          data-ad-slot="7793784284"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>

      {/* RIGHT RAIL */}
      <div className="hidden xl:block fixed top-24 right-4 w-[160px] z-40">
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client="ca-pub-9530220531970117"
          data-ad-slot="2685432413"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </>
  );
}
