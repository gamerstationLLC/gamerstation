import Link from "next/link";
import MythicPlusClient from "./MythicPlusClient";

export const metadata = {
  title: "WoW Mythic+ Scaling Calculator – Health & Damage by Key Level | GamerStation",
  description:
    "WoW Mythic+ scaling calculator showing enemy health and damage multipliers by key level. Plan pulls and cooldowns for higher keys.",
};


export default function MythicPlusPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Link
            href="/calculators/wow/pve"
            className="text-sm text-neutral-300 hover:text-white"
          >
            ← Back to WoW PvE
          </Link>
        </header>

        <h1 className="mt-8 text-4xl font-bold">Mythic+ Scaling</h1>
        <p className="mt-3 text-neutral-300">
          See how enemy health and damage scale by keystone level.
        </p>

        <div className="mt-10">
          <MythicPlusClient />
        </div>
      </div>
    </main>
  );
}
