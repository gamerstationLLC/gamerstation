import Link from "next/link";

export const metadata = {
  title: "Disclaimer | GamerStation",
  description: "Important disclaimers about calculator accuracy and game updates.",
};

export default function DisclaimerPage() {
  return (
    <main className="min-h-screen bg-transparent text-white px-6 py-16">
      <div className="mx-auto w-full max-w-3xl">
        {/* âœ… Center logo (replaces header) */}
        <div className="flex justify-center">
          <Link href="/" className="group inline-flex items-center">
            <span className="relative transition-all duration-300">
              {/* ambient halo */}
              <span
                aria-hidden
                className="
                  absolute -inset-3 -z-10 rounded-3xl
                  bg-cyan-400/20 blur-lg
                  transition-all duration-300
                  group-hover:bg-cyan-400/45
                  group-hover:blur-2xl
                "
              />

              <img
                src="/gs-logo-v2.png"
                alt="GamerStation"
                className="
                  h-14 w-auto rounded-2xl
                  bg-black p-1
                  shadow-[0_0_40px_rgba(0,255,255,0.25)]
                  transition-all duration-300
                  group-hover:shadow-[0_0_80px_rgba(0,255,255,0.55)]
                  group-hover:scale-[1.05]
                "
              />
            </span>
          </Link>
        </div>

        {/* âœ… Disclaimer content */}
        <p className="mt-8 leading-relaxed text-neutral-200">
          <strong>Game Disclaimer & Attribution:</strong> GamerStation is an independent, fan-created
          website and is{" "}
          <strong>
            not affiliated with, endorsed by, sponsored by, or associated with
          </strong>{" "}
          Roblox Corporation, Jagex Ltd., Riot Games, Epic Games, Activision, Blizzard Entertainment,
          Valve, Microsoft, Sony, or any other game publishers, developers, or trademark holders.
        </p>

        <p className="mt-6 leading-relaxed text-neutral-200">
          All trademarks, game names, logos, and related intellectual property belong to their
          respective owners. GamerStation does not claim ownership of any proprietary game content
          and provides informational tools only.
        </p>

        <p className="mt-6 leading-relaxed text-neutral-200">
          Portions of numerical, statistical, or descriptive data used in certain calculators are
          adapted from <strong>community-maintained wikis</strong>, including but not limited to{" "}
          <em>Arsenal Wiki</em> and <em>Blox Fruits Wiki</em> on Fandom, as well as other publicly
          available reference sources. Community wiki text content is used in accordance with
          applicable{" "}
          <a
            href="https://www.fandom.com/licensing"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-white"
          >
            Creative Commons Attribution-ShareAlike (CC BY-SA)
          </a>{" "}
          licenses. Such data has been reformatted, normalized, and adapted for calculator use.
        </p>

        <p className="mt-6 leading-relaxed text-neutral-200">
          GamerStation does <strong>not</strong> use proprietary, private, leaked, or restricted
          data sources; does not access internal game files; does not reverse engineer client
          software; and does not scrape protected services or APIs. All data is derived from
          publicly accessible information in a manner consistent with community wiki licenses and
          fan-content policies.
        </p>

        <p className="mt-6 leading-relaxed text-neutral-200">
          All calculators provide estimates only and may not reflect real-time game updates, balance
          changes, or live server behavior. GamerStation complies with applicable fan-content
          guidelines and terms of service by operating as a non-intrusive, informational companion
          site.
        </p>
      </div>
    </main>
  );
}
