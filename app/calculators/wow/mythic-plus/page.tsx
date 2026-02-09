import Link from "next/link";
import MythicPlusClient from "./MythicPlusClient";

export const metadata = {
  title:
    "WoW Mythic+ Scaling Calculator – Health & Damage by Key Level | GamerStation",
  description:
    "WoW Mythic+ scaling calculator showing enemy health and damage multipliers by key level. Plan pulls and cooldowns for higher keys.",
};

export default function MythicPlusPage() {
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

        {/* Back link */}
        

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
