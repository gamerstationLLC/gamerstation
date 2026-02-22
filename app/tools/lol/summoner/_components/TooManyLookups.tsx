// app/tools/lol/summoner/_components/TooManyLookups.tsx
import Link from "next/link";

export default function TooManyLookups() {
  return (
    <main className="min-h-screen px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/tools/lol/summoner" className="text-sm text-neutral-300 hover:text-white">
          ← Summoner lookup
        </Link>

        <div className="mt-6 rounded-3xl border border-neutral-800 bg-black/45 p-6">
          <div className="text-2xl font-black">Too many new lookups</div>
          <div className="mt-2 text-neutral-300">
            Please wait a few minutes and try again.
          </div>

          <div className="mt-4 text-xs text-neutral-500">
            (We limit repeated cache misses to prevent abusive traffic.)
          </div>
        </div>
      </div>
    </main>
  );
}