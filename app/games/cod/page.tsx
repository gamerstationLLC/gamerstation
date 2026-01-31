import Link from "next/link";

export default function CodHubPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="mb-10 flex items-center justify-between">
          <a
  href="/calculators"
  className="
    ml-auto rounded-xl border border-neutral-800
    bg-black px-4 py-2 text-sm text-neutral-200
    transition
    hover:border-grey-400
   
    hover:text-white
    hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]
  "
>
  Calculators
</a>

          
        </header>

        {/* Title */}
        <h1 className="mt-8 text-4xl font-bold">Call of Duty</h1>
        <p className="mt-3 max-w-2xl text-neutral-300">
          TTK tools + weapon buffs, nerfs, and meta builds in one place.
        </p>

        {/* Cards */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {/* TTK Calculator */}
          <Link
            href="/calculators/ttk/cod"
            className="rounded-2xl border border-neutral-800 bg-black/60 p-6 transition hover:border-neutral-600 hover:bg-black/75"
>
            <div className="text-sm font-semibold">TTK Calculator</div>
            <div className="mt-2 text-sm text-neutral-400">
              Shots-to-kill + time-to-kill based on damage, RPM, and target HP.
            </div>
          </Link>

         
        </div>

        {/* Optional small footer */}
        <p className="mt-10 text-xs text-neutral-500"></p>
      </div>
    </main>
  );
}
