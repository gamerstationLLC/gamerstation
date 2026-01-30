import Link from "next/link";

export const metadata = {
  title: "Terms of Service | GamerStation",
  description:
    "GamerStation Terms of Service: rules, disclaimers, and limitations of liability for calculators and content.",
};

export default function TermsPage() {
  const lastUpdated = "January 2, 2026";

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-3xl">
        {/* Centered glowing logo (matches Disclaimer + Contact) */}
        <div className="flex justify-center mb-10">
          <Link href="/" className="inline-flex items-center group">
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

        <h1 className="text-4xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="mt-3 text-sm text-neutral-400">
          Last updated: {lastUpdated}
        </p>

        <section className="mt-10 space-y-4 text-neutral-200 leading-relaxed">
          <p>
            Welcome to <span className="font-semibold">GamerStation</span>. By accessing or using this website,
            you agree to these Terms. If you do not agree, do not use the site.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-white">1) What GamerStation is</h2>
          <p>
            GamerStation provides calculators, tools, and informational content related to games (for example:
            time-to-kill (TTK), DPS estimates, and other gameplay math). Results are estimates and may not reflect
            in-game outcomes due to patches, RNG, latency, range, accuracy, attachments, perks, buffs, nerfs, and
            other variables.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-white">2) No warranties</h2>
          <p>
            The site is provided “as is” and “as available.” We make no warranties of any kind, express or implied,
            including accuracy, reliability, or fitness for a particular purpose.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-white">3) Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, GamerStation and its operators will not be liable for any
            indirect, incidental, consequential, special, or punitive damages, or any loss of data, revenue, or
            profits arising from your use of the site.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-white">4) User conduct</h2>
          <p>
            You agree not to misuse the site, attempt to disrupt it, scrape it excessively, reverse engineer it,
            or use it for unlawful purposes.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-white">5) Intellectual property</h2>
          <p>
            Site code, branding, and original content are owned by GamerStation or licensed to it. Game names and
            trademarks belong to their respective owners and are used for identification only.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-white">6) Third-party links and ads</h2>
          <p>
            The site may include third-party links or advertising. We are not responsible for third-party content,
            products, or services, and you use them at your own risk.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-white">7) Changes</h2>
          <p>
            We may update these Terms at any time. Continued use of the site means you accept the updated Terms.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-white">8) Contact</h2>
          <p>
            Questions? Contact us via the Contact page.
          </p>
        </section>
      </div>
    </main>
  );
}
