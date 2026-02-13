import Link from "next/link";

export const metadata = {
  title: "Contact | GamerStation",
  description: "Contact GamerStation for support, feedback, or business inquiries.",
};

export default function ContactPage() {
  const email = "support@gamerstation.gg";

  return (
    <main className="min-h-screen bg-transparent px-6 py-16 text-white">
      <div className="mx-auto w-full max-w-3xl">
        {/* Centered glow logo (clickable home) */}
        <div className="flex justify-center">
          <Link href="/" className="group inline-flex items-center">
            <span className="relative transition-all duration-300">
              {/* ambient halo */}
              <span
                aria-hidden
                className="
                  absolute -inset-3 -z-10 rounded-3xl
                  bg-cyan-400/15 blur-lg
                  transition-all duration-300
                  group-hover:bg-cyan-400/35
                  group-hover:blur-xl
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

        {/* Contact card */}
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-neutral-200">
            Email:{" "}
            <a
              className="text-white underline underline-offset-4 hover:text-cyan-300"
              href={`mailto:${email}`}
            >
              {email}
            </a>
          </p>

          <p className="mt-3 text-sm text-neutral-400">
            We usually respond within 1-3 business days.
          </p>
        </div>
      </div>
    </main>
  );
}
