// app/tools/dota/heroes/[slug]/HeroImage.tsx
"use client";

import { useState } from "react";

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
  const [src, setSrc] = useState<string>(steamSrc || fallbackSrc);

  const hasAny = Boolean(steamSrc || fallbackSrc);

  return (
    <div
      className={[
        // square container prevents “morphed” stretching
        "h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-neutral-800 bg-black/40 sm:h-24 sm:w-24",
        className,
      ].join(" ")}
    >
      {hasAny ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            if (fallbackSrc && src !== fallbackSrc) setSrc(fallbackSrc);
          }}
        />
      ) : null}
    </div>
  );
}
