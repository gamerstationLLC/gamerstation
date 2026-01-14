import Link from "next/link";

export const metadata = {
  title: "Disclaimer | GamerStation",
  description: "Important disclaimers about calculator accuracy and game updates.",
};

export default function DisclaimerPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
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

      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight">Disclaimer</h1>

  {/* ✅ Universal Game Disclaimer, Attribution, & Policy Compliance */}
<p className="mt-8 text-neutral-200 leading-relaxed">
  <strong>Game Disclaimer & Attribution:</strong> GamerStation is an independent,
  fan-created website and is <strong>not affiliated with, endorsed by, sponsored by,
  or associated with</strong> Roblox Corporation, Jagex Ltd., Riot Games, Epic Games,
  Activision, Blizzard Entertainment, Valve, Microsoft, Sony, or any other game
  publishers, developers, or trademark holders.
</p>

<p className="mt-6 text-neutral-200 leading-relaxed">
  All trademarks, game names, logos, and related intellectual property belong to their
  respective owners. GamerStation does not claim ownership of any proprietary game
  content and provides informational tools only.
</p>

<p className="mt-6 text-neutral-200 leading-relaxed">
  Portions of numerical, statistical, or descriptive data used in certain calculators
  are adapted from <strong>community-maintained wikis</strong>, including but not
  limited to <em>Arsenal Wiki</em> and <em>Blox Fruits Wiki</em> on Fandom, as well as
  other publicly available reference sources. Community wiki text content is used
  in accordance with applicable{" "}
  <a
    href="https://www.fandom.com/licensing"
    target="_blank"
    rel="noopener noreferrer"
    className="underline hover:text-white"
  >
    Creative Commons Attribution-ShareAlike (CC BY-SA)
  </a>
  licenses. Such data has been reformatted, normalized, and adapted for calculator use.
</p>

<p className="mt-6 text-neutral-200 leading-relaxed">
  GamerStation does <strong>not</strong> use proprietary, private, leaked, or restricted
  data sources; does not access internal game files; does not reverse engineer client
  software; and does not scrape protected services or APIs. All data is derived from
  publicly accessible information in a manner consistent with community wiki licenses
  and fan-content policies.
</p>

<p className="mt-6 text-neutral-200 leading-relaxed">
  All calculators provide estimates only and may not reflect real-time game updates,
  balance changes, or live server behavior. GamerStation complies with applicable
  fan-content guidelines and terms of service by operating as a non-intrusive,
  informational companion site.
</p>

      </div>
    </main>
  );
}
