// app/_components/GlobalAds.tsx
"use client";

import { usePathname } from "next/navigation";
import AdSenseSideRails from "./AdSenseSideRails";
import AdSenseDismissibleDock from "./AdSenseDismissibleDock";

export default function GlobalAds() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop-only side rails (keep your existing component) */}
      <AdSenseSideRails />

      {/* Remount per route => pushes a fresh request per page */}
      <AdSenseDismissibleDock
        key={pathname}
        client="ca-pub-9530220531970117"
        slot="8145648829"
      />
    </>
  );
}
