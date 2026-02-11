// app/tools/lol/summoner/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import SummonerLookupClient from "./client";

export const metadata: Metadata = {
  title: "LoL Summoner Lookup (Riot ID) | GamerStation",
  description:
    "Search a League of Legends player by Riot ID (GameName#TAG) and view match history + aggregated stats.",
};

export default function LolSummonerLookupPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent text-white">
      {/* Ambient background */}
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
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <header className="mb-8 flex items-center">
            {/* Left: Logo */}
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

            {/* Right: Calculators button */}
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

          <h1 className="mt-2 text-4xl font-bold tracking-tight">Summoner Lookup</h1>
          <p className="mt-3 text-neutral-300">
            Enter a Riot ID like{" "}
            <span className="font-semibold text-white">Faker#KR1</span>, choose the playerâ€™s
            server, and weâ€™ll take you to their match stats page.
          </p>

          <div className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-6 shadow-[0_0_40px_rgba(0,255,255,0.10)]">
            <SummonerLookupClient />
            <div className="mt-6 text-xs text-neutral-500">
              Uses Riot Account-V1 + Match-V5 (regional routing) and Summoner-V4 (platform
              routing).
            </div>
          </div>

          
        </div>
      </div>
    </main>
  );
}
