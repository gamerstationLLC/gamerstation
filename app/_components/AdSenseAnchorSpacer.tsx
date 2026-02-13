"use client";

import { useEffect } from "react";

export default function AdSenseAnchorSpacer() {
  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const isMobile = window.matchMedia("(max-width: 1024px)").matches; // matches your lg:hidden intent
      root.style.setProperty("--adsense-anchor-pad", isMobile ? "90px" : "0px");
    };

    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  return null;
}
