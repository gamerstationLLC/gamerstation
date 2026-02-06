"use client";

import { useEffect } from "react";

export default function DesktopSidebarAd() {
  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {}
  }, []);

  return (
    <div className="hidden lg:block">
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
