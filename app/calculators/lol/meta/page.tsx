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

function SeoBlock() {
  return (
    <section className="mt-10 border-t border-white/10 pt-8">
      {/* Collapsed by default, but still server-rendered content for crawlers */}
      <details className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6" open={false}>
        <summary className="cursor-pointer select-none list-none">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-white">About these LoL Meta Builds</h2>
              <p className="mt-1 text-xs text-white/65">
                Patch/role builds, ranked vs normals, core items, and popular skill orders. (Tap to
                expand)
              </p>
            </div>
            <span className="text-white/65" aria-hidden>
              ▸
            </span>
          </div>
        </summary>

        <div className="mt-4 space-y-5 text-sm text-white/80">
          <p>
            GamerStation’s <strong>League of Legends meta builds</strong> page helps you find the{" "}
            <strong>best builds</strong> for the current patch — including <strong>items</strong>,{" "}
            <strong>runes</strong>, and <strong>role-based builds</strong> for each champion. You can
            toggle between <strong>Ranked (Solo/Duo)</strong> and <strong>Casual (Normals)</strong>{" "}
            to see what’s working in different environments.
          </p>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">What you’ll find here</h3>
            <ul className="list-disc pl-5 text-sm text-white/80">
              <li>
                <strong>LoL meta builds by patch</strong> (current patch focus)
              </li>
              <li>
                <strong>Champion builds by role</strong> (Top/Jungle/Mid/ADC/Support)
              </li>
              <li>
                Common <strong>core item</strong> paths and build variations
              </li>
              <li>
                <strong>Runes</strong> selections that pair with those builds
              </li>
              <li>
                Quick “what’s strong right now?” browsing via compact champion cards
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">Related tools</h3>
            <ul className="list-disc pl-5">
              <li>
                <Link href="/calculators/lol" className="text-white hover:underline">
                  LoL Damage Calculator
                </Link>{" "}
                (test burst, DPS, and TTK with items)
              </li>
              <li>
                <Link href="/tools/lol/champion-tiers" className="text-white hover:underline">
                  Champion tiers
                </Link>{" "}
                (who’s strongest right now)
              </li>
              <li>
                <Link href="/calculators/lol/champions" className="text-white hover:underline">
                  Champion stats by level index
                </Link>{" "}
                (base stats + per-level scaling)
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">FAQ</h3>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold text-white">
                Are these “best builds” for ranked?
              </div>
              <p className="mt-1 text-sm text-white/80">
                Yes — you can view ranked builds (Solo/Duo) and compare them to normals to see what
                changes between competitive and casual play.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold text-white">
                Do builds change by role?
              </div>
              <p className="mt-1 text-sm text-white/80">
                Yes — champions often have different item/rune priorities depending on role, so the
                page is organized around role-based build patterns.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold text-white">
                Can I use this for ARAM?
              </div>
              <p className="mt-1 text-sm text-white/80">
                This page focuses on Summoner’s Rift environments (ranked/normals). ARAM-specific
                builds can be added later as a dedicated mode.
              </p>
            </div>
          </div>

          
        </div>
      </details>
    </section>
  );
}

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
          Best League of Legends builds, items, and meta champions for the current patch ranked by
          real match data.
        </p>

        <div className="mt-6">
          <MetaClient />
        </div>

        {/* ✅ Bottom-of-page SEO block (collapsed by default) */}
        <SeoBlock />
      </div>
    </main>
  );
}
