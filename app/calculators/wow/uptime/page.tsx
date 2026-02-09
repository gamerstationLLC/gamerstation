import Link from "next/link";
import UptimeClient from "./UptimeClient";

export const metadata = {
  title: "WoW Uptime & Mistake DPS Loss Calculator | GamerStation",
  description:
    "Estimate DPS loss in WoW PvE from downtime, missed globals, and delayed cooldowns. A fast tool to understand mistake impact in raids and Mythic+.",
};


export default function UptimePage() {
 const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* ✅ Standard GS header */}
        <header className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90">
            <img
              src="/gs-logo-v2.png"
              alt="GamerStation"
              className="
                h-10 w-10 rounded-xl bg-black p-1
                shadow-[0_0_30px_rgba(0,255,255,0.35)]
              "
            />
            <span className="text-lg font-black tracking-tight">
              GamerStation<span className="align-super text-[0.6em]">™</span>
            </span>
          </Link>

          <div className="ml-auto">
            <Link href="/calculators/wow" className={navBtn}>
              WoW Hub
            </Link>
          </div>
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
