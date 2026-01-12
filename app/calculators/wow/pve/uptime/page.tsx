import Link from "next/link";
import UptimeClient from "./UptimeClient";

export const metadata = {
  title: "WoW Uptime & Mistake DPS Loss Calculator | GamerStation",
  description:
    "Estimate DPS loss in WoW PvE from downtime, missed globals, and delayed cooldowns. A fast tool to understand mistake impact in raids and Mythic+.",
};


export default function UptimePage() {
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

        <h1 className="mt-8 text-4xl font-bold">Uptime / Mistake Impact</h1>
        <p className="mt-3 text-neutral-300">
          Estimate DPS loss from downtime and missed cooldown usage.
        </p>

        <div className="mt-10">
          <UptimeClient />
        </div>
      </div>
    </main>
  );
}
