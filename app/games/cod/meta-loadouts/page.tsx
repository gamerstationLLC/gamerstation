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

// ✅ POINTS TO /public/data/cod/meta-loadouts.json
const JSON_PATH = path.join(
  process.cwd(),
  "public",
  "data",
  "cod",
  "meta-loadouts.json"
);

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

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex items-center justify-between">
          <Link
            href="/games/cod"
            className="text-sm text-neutral-300 hover:text-white"
          >
            ← Back to Call of Duty
          </Link>

          <Link href="/" className="text-sm text-neutral-300 hover:text-white">
            Home
          </Link>
        </header>

        <h1 className="text-4xl font-bold">Meta Loadouts</h1>
        <p className="mt-3 max-w-2xl text-neutral-300">
          The current best Call of Duty builds. Updated regularly as the meta
          shifts.
        </p>

        <div className="mt-10">
          <MetaLoadoutsClient initialLoadouts={loadouts} />
        </div>

        <p className="mt-10 text-xs text-neutral-500">
          Not affiliated with Activision. All trademarks belong to their
          respective owners.
        </p>
      </div>
    </main>
  );
}
