"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function AdUnit({ side }: { side: "left" | "right" }) {
  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, []);

  const pos = side === "left" ? "left-4 2xl:left-6" : "right-4 2xl:right-6";

  return (
    <div className={`hidden 2xl:block fixed top-24 ${pos} w-[160px] z-40`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-9530220531970117"
        data-ad-slot="7793784284"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

export default function SideRailAds() {
  const pathname = usePathname();

  // Hide on homepage
  if (pathname === "/") return null;

  return (
    <>
      <AdUnit side="left" />
      <AdUnit side="right" />
    </>
  );
}
