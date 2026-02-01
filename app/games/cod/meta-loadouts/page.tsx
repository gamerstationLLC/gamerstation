import type { Metadata } from "next";
import Link from "next/link";
import path from "path";
import { promises as fs } from "fs";

import MetaLoadoutsClient, { type MetaLoadout } from "./client";

export const metadata: Metadata = {
  title: "CoD Meta Loadouts (Warzone & Multiplayer) | GamerStation",
  description:
    "Browse the current Call of Duty meta loadouts with attachments. Filter by mode and range and copy builds instantly.",
};

const JSON_PATH = path.join(process.cwd(), "public", "data", "cod", "meta-loadouts.json");

async function loadMetaLoadouts(): Promise<MetaLoadout[]> {
  try {
    const raw = await fs.readFile(JSON_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as MetaLoadout[];
  } catch (err) {
    console.error("Failed to load meta-loadouts.json", err);
    return [];
  }
}

export default async function CodMetaLoadoutsPage() {
  const loadouts = await loadMetaLoadouts();

  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* ✅ Match your GS background system */}
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
          {/* ✅ Standard header: brand left, Tools top-right */}
          <header className="mb-8 flex items-center gap-3">
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

            <div className="ml-auto flex items-center gap-2">
              <Link href="/tools" className={navBtn}>
                Tools
              </Link>
            </div>
          </header>

          <h1 className="text-4xl font-bold">CoD Meta Loadouts</h1>
          <p className="mt-3 max-w-2xl text-neutral-300">
            The current best Call of Duty builds. Updated regularly as the meta shifts.
          </p>

         
          <div className="mt-10">
            <MetaLoadoutsClient initialLoadouts={loadouts} />
          </div>

          <p className="mt-10 text-xs text-neutral-500">
            Not affiliated with Activision. All trademarks belong to their respective owners.
          </p>
        </div>
      </div>
    </main>
  );
}
