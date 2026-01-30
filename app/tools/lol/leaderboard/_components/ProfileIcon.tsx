// app/tools/lol/leaderboard/_components/ProfileIcon.tsx
"use client";

import Image from "next/image";
import { useState } from "react";

export default function ProfileIcon({
  profileIconId,
  ddVersion,
  alt = "Profile icon",
  size = 28,
}: {
  profileIconId: number | null | undefined;
  ddVersion: string;
  alt?: string;
  size?: number;
}) {
  const [error, setError] = useState(false);

  if (!profileIconId || error) {
    return (
      <div
        className="rounded-full bg-neutral-800 border border-neutral-700"
        style={{ width: size, height: size }}
        aria-label={alt}
      />
    );
  }

  // FIX: use the actual prop name (profileIconId), not iconId, and no stray newline.
  const src = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${profileIconId}.png`;

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="rounded-full border border-neutral-700"
      onError={() => setError(true)}
      unoptimized
    />
  );
}
