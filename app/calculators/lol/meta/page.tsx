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
  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent text-white">
      {/* background */}
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

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-8">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90">
            <img
              src="/gs-logo-v2.png"
              alt="GamerStation"
              className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_30px_rgba(0,255,255,0.12)]"
            />
            <span className="text-lg font-black tracking-tight">
              GamerStation<span className="align-super text-[0.6em]">TM</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/tools" className={navBtn}>
              Tools
            </Link>
          </div>
        </header>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Current LoL Meta</h1>
        <p className="mt-2 text-sm text-white/65">
          Best League of Legends builds, items, and meta champions for the current patch â€” ranked by real match data.
        </p>

        <div className="mt-6">
          <MetaClient />
        </div>
      </div>
    </main>
  );
}
