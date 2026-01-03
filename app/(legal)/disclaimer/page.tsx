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
      </div>
    </main>
  </main>
  );
}
