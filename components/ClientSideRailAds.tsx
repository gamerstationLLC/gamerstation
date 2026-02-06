// app/components/ClientSideRailAds.tsx
"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

export default function ClientSideRailAds() {
  const pathname = usePathname();

  // Hide on homepage
  if (pathname === "/") return null;

  return (
    <>
      {/* LEFT RAIL */}
      <div className="hidden 2xl:block fixed top-24 left-4 w-[160px] min-h-[600px] z-40">
        <div className="w-full h-full bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(0,255,255,0.04)] p-2">
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
        <div className="w-full h-full bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(0,255,255,0.04)] p-2">
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

      {/* Push both ads */}
      <Script id="adsbygoogle-init" strategy="afterInteractive">
        {`
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        `}
      </Script>
    </>
  );
}
