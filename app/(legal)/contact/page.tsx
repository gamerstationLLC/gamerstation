import Link from "next/link";

<Link
  href="/"
  className="mb-6 inline-block text-sm text-neutral-400 hover:text-white"
>
  ← Back to Home
</Link>

export const metadata = {
  title: "Contact | GamerStation",
  description: "Contact GamerStation for support, feedback, or business inquiries.",
};

export default function ContactPage() {
  const email = "support@gamerstation.gg"; // <-- change this

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
        <h1 className="text-4xl font-semibold tracking-tight">Contact</h1>
        <p className="mt-3 text-neutral-300">
          For support, feedback, or business inquiries:
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-neutral-200">
            Email:{" "}
            <a className="text-white underline underline-offset-4" href={`mailto:${email}`}>
              {email}
            </a>
          </p>
          <p className="mt-3 text-sm text-neutral-400">
            We usually respond within 1–3 business days.
          </p>
        </div>
      </div>
    </main>
  );
}
