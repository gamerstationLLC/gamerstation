// app/tools/dota/heroes/[slug]/HeroImage.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

export default function HeroImage({
  steamSrc,
  fallbackSrc,
  alt = "",
  className = "",
}: {
  steamSrc: string;
  fallbackSrc: string;
  alt?: string;
  className?: string;
}) {
  const initial = useMemo(() => steamSrc || fallbackSrc || "", [steamSrc, fallbackSrc]);
  const [src, setSrc] = useState<string>(initial);
  const [failed, setFailed] = useState(false);

  // ✅ IMPORTANT: when props change (new hero), reset src + failure state
  useEffect(() => {
    setSrc(initial);
    setFailed(false);
  }, [initial]);

  const hasAny = Boolean(steamSrc || fallbackSrc);

  return (
    <div
      className={[
        // square container prevents “morphed” stretching
        "relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-neutral-800 bg-black/40 sm:h-24 sm:w-24",
        className,
      ].join(" ")}
    >
      {hasAny && !failed ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => {
            // 1) Try fallback if we aren't already on it
            if (fallbackSrc && src !== fallbackSrc) {
              setSrc(fallbackSrc);
              return;
            }
            // 2) Otherwise mark as failed (shows subtle placeholder)
            setFailed(true);
          }}
        />
      ) : (
        // ✅ subtle placeholder so it never looks broken
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-10 w-10 rounded-xl border border-neutral-800 bg-black/40 shadow-[0_0_25px_rgba(0,255,255,0.10)]" />
        </div>
      )}
    </div>
  );
}
