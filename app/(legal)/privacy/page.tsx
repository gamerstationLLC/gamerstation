import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | GamerStation",
  description:
    "GamerStation Privacy Policy: what data we collect, how we use it, cookies, and your choices.",
};

export default function PrivacyPage() {
  const lastUpdated = "January 2, 2026";

  return (
    <main className="min-h-screen bg-transparent text-white px-6 py-16">
      <div className="mx-auto max-w-3xl">
        {/* Centered glowing logo (matches all legal pages) */}
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

        <h1 className="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-3 text-sm text-neutral-400">
          Last updated: {lastUpdated}
        </p>

        <section className="mt-10 space-y-4 text-neutral-200 leading-relaxed">
          <p>
            This Privacy Policy explains how{" "}
            <span className="font-semibold">GamerStation</span> handles information
            when you use our site.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-white">
            1) Information we collect
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <span className="font-semibold">Usage data:</span> basic analytics
              such as page views, device type, approximate location (city/region),
              and referrers (if analytics are enabled).
            </li>
            <li>
              <span className="font-semibold">Inputs you enter:</span> calculator
              inputs are processed to show results. Unless we explicitly add
              storage later, inputs are not tied to your identity.
            </li>
            <li>
              <span className="font-semibold">Cookies:</span> we may use cookies
              for analytics and/or advertising.
            </li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-white">
            2) How we use information
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To operate and improve calculators and site performance</li>
            <li>To understand which tools are most useful</li>
            <li>To show ads (if enabled) and measure performance</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-white">
            3) Advertising
          </h2>
          <p>
            If we run ads (e.g., Google AdSense), third parties may use cookies or
            similar technologies to personalize ads or measure ad performance.
            You can manage ad personalization in your Google Ad settings.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-white">
            4) Analytics
          </h2>
          <p>
            If analytics are enabled, they help us understand traffic and improve
            the site. Analytics providers may process IP addresses and device
            information per their policies.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-white">
            5) Your choices
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>You can block cookies in your browser settings</li>
            <li>
              You can use browser Do Not Track (note: it may not be honored by
              all services)
            </li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold text-white">
            6) Data retention
          </h2>
          <p>
            We retain analytics data only as long as needed for site improvement
            and reporting, depending on the provider settings.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-white">7) Changes</h2>
          <p>
            We may update this policy. Continued use of the site means you accept
            the updated policy.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-white">8) Contact</h2>
          <p>Questions? Contact us via the Contact page.</p>
        </section>
      </div>
    </main>
  );
}
