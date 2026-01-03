import Link from "next/link";

const PATCH_NOTES = [
  {
    weapon: "MCW (AR)",
    change: "Nerf",
    details: "Headshot multiplier reduced. 4-shot kill range slightly shortened.",
  },
  {
    weapon: "Rival-9 (SMG)",
    change: "Buff",
    details: "Improved close-range damage. Better sprint-to-fire time.",
  },
  {
    weapon: "Holger 556 (AR)",
    change: "Nerf",
    details: "Recoil increased during sustained fire.",
  },
  {
    weapon: "KATT-AMR (Sniper)",
    change: "Buff",
    details: "ADS speed increased. One-shot kill zones expanded.",
  },
];

export default function CodBuffsNerfsPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link
            href="/games/cod"
            className="text-sm text-neutral-300 hover:text-white"
          >
            ← Back to Call of Duty
          </Link>

          <Link href="/" className="text-sm text-neutral-300 hover:text-white">
            Home
          </Link>
        </header>

        {/* Title */}
        <h1 className="mt-8 text-4xl font-bold">Weapon Buffs & Nerfs</h1>
        <p className="mt-3 max-w-2xl text-neutral-300">
          Patch watch for Call of Duty — expected buffs, nerfs, balance changes,
          and meta shifts.
        </p>

        {/* Notes */}
        <div className="mt-10 space-y-4">
          {PATCH_NOTES.map((note, i) => (
            <div
              key={i}
              className="rounded-xl border border-neutral-800 bg-neutral-950 p-5"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{note.weapon}</div>
                <span
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${
                    note.change === "Buff"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {note.change}
                </span>
              </div>

              <p className="mt-2 text-sm text-neutral-400">{note.details}</p>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <p className="mt-10 text-xs text-neutral-500">
          Changes based on official patches, early reports, and community testing.
          Final values may differ in-game.
        </p>
      </div>
    </main>
  );
}
