// app/calculators/lol/meta/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import MetaClient from "./client";

export const metadata: Metadata = {
  title: "LoL Meta Builds (Ranked & Casual) | GamerStation",
  description:
    "League of Legends meta builds by patch and role. Toggle between Ranked (Solo/Duo) and Casual (Normals) builds, with compact expandable champion cards.",
  alternates: { canonical: "/calculators/lol/meta" },
  openGraph: {
    title: "LoL Meta Builds (Ranked & Casual) | GamerStation",
    description:
      "League of Legends meta builds by patch and role. Toggle between Ranked and Casual builds.",
    url: "/calculators/lol/meta",
    siteName: "GamerStation",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LoL Meta Builds (Ranked & Casual) | GamerStation",
    description:
      "League of Legends meta builds by patch and role. Toggle between Ranked and Casual builds.",
  },
};

export default function Page() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* ✅ GamerStation glow/grid background (visual only; no SEO impact) */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-1/3 -left-32 h-[420px] w-[420px] rounded-full bg-white/8 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-[520px] w-[520px] rounded-full bg-white/8 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black" />
      </div>

      {/* content */}
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-8">
        <div className="flex items-start justify-between gap-3">
  <div className="flex flex-col gap-2">
    {/* REAL GS LOGO (shared asset) */}
    <Link href="/" className="flex items-center gap-2">
      <img
        src="/icon.png"   // ← use the SAME path you already use
        alt="GamerStation"
        className="h-7 w-7 rounded-lg"
      />
      <span className="text-sm font-semibold tracking-wide text-white">
        GamerStation™
      </span>
    </Link>

    
  </div>
</div>


        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Current LoL Meta</h1>
        <p className="mt-2 text-sm text-white/65">
          Best League of Legends builds, items, and meta champions for the current patch — ranked by real match data.
        </p>

        <div className="mt-6">
          <MetaClient />
        </div>
      </div>
    </main>
  );
}
