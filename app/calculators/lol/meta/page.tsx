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
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8">
        <div className="flex items-center justify-between gap-3">
          <Link href="/calculators/lol/hub" className="text-sm text-white/70 hover:text-white">
            ← Back to LoL Hub
          </Link>
          <Link href="/" className="text-sm text-white/70 hover:text-white">
            Home
          </Link>
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Current LoL Meta</h1>
        <p className="mt-2 text-sm text-white/65">
          Best League of Legends builds, items, and meta champions for the current patch — ranked by real match data.
        </p>

        <div className="mt-6">
          <MetaClient />
        </div>
      </div>
    </div>
  );
}
