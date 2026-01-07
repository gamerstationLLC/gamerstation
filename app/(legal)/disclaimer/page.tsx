import Link from "next/link";

<Link
  href="/"
  className="mb-6 inline-block text-sm text-neutral-400 hover:text-white"
>
  ← Back to Home
</Link>

export const metadata = {
  title: "Disclaimer | GamerStation",
  description: "Important disclaimers about calculator accuracy and game updates.",
};

export default function DisclaimerPage() {
  return (<main className="min-h-screen bg-black text-white px-6 py-16">
      
      {/* Back to home */}
     <div className="mb-8 flex">
  <div className="mx-25 w-full max-w-3xl">
    <Link
      href="/"
      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-400 transition hover:border-white/20 hover:text-white"
    >
      <span className="text-sm">←</span>
      Back to Home
    </Link>
  </div>
</div>
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight">Disclaimer</h1>
        <p className="mt-8 text-neutral-200 leading-relaxed">
          GamerStation calculators provide baseline estimates. Real in-game outcomes vary due to patches,
          balance changes, attachments, range, accuracy, recoil, player movement, latency, bloom/RNG,
          and other factors. Use results as a guide—not a guarantee.
        </p>
        <p className="mt-8 text-neutral-200 leading-relaxed">
  GamerStation is not affiliated with, endorsed by, or associated with Jagex Ltd., OSRSX, the Old School RuneScape Wiki, or any third-party RuneScape services.
Old School RuneScape and RuneScape are trademarks of Jagex Ltd.
All trademarks, game content, and data belong to their respective owners.
</p>
<p className="mt-8 text-neutral-200 leading-relaxed">
  All calculations are based on publicly available game mechanics and independently compiled data.
No proprietary, private, or restricted data sources are used.
This site does not scrape, mirror, or redistribute content from OSRSX or any other third-party service.
</p>
      </div>
    </main>
  </main>
  );
}
