// app/tools/dota/meta/page.tsx
import Link from "next/link";
import DotaMetaClient, { type HeroStatsRow } from "./client";

export const metadata = {
  title: "Dota 2 Meta | GamerStation",
  description:
    "Dota 2 hero meta by rank: pick rate, win rate, and pro trends (powered by OpenDota).",
};

async function getHeroStats(): Promise<HeroStatsRow[]> {
  // OpenDota heroStats endpoint returns per-hero pub (rank bracket) + pro counts.
  // We cache via Next.js revalidate to avoid rate-limit pain and keep UX fast.
  const res = await fetch("https://api.opendota.com/api/heroStats", {
    next: { revalidate: 300 }, // 5 minutes
  });

  if (!res.ok) {
    throw new Error(`OpenDota heroStats failed: ${res.status}`);
  }

  return (await res.json()) as HeroStatsRow[];
}

export default async function Page() {
  const data = await getHeroStats();

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Ambient background (keeps your Tools vibe) */}
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

      <div className="relative px-6 py-16">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <header className="mb-8 flex items-center">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90">
              <img
                src="/gs-logo-v2.png"
                alt="GamerStation"
                className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_30px_rgba(0,255,255,0.12)]"
              />
              <span className="text-lg font-black tracking-tight">
                GamerStation<span className="align-super text-[0.6em]">™</span>
              </span>
            </Link>

            <a
              href="/tools"
              className="
                ml-auto rounded-xl border border-neutral-800
                bg-black px-4 py-2 text-sm text-neutral-200
                transition
                hover:border-grey-400
                hover:text-white
                hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]
              "
            >
              Tools
            </a>
          </header>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">Dota 2 Meta</h1>
          <p className="mt-3 text-neutral-300">
            Highest pick rate + best win rate by rank bracket, plus pro trends. Data from OpenDota.{" "}
            <span className="text-neutral-500">(Cached ~5 minutes)</span>
          </p>

          <div className="mt-10">
            <DotaMetaClient initialRows={data} />
          </div>

          <div className="mt-10 rounded-2xl border border-neutral-800 bg-black/60 p-4 text-xs text-neutral-400">
            Some heroes can look “OP” with small samples. Use the filters + minimum games slider to keep it honest.
          </div>
        </div>
      </div>
    </main>
  );
}
