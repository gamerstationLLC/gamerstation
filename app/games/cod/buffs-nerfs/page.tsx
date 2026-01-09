
import Link from "next/link";

type PatchChange = "Buff" | "Nerf" | "New";

const PATCH_NOTES: { weapon: string; change: PatchChange; details: string }[] = [
  { weapon: "Sturmwolf 45 (SMG)", change: "New", details: "New full-auto SMG (Event Reward). Low recoil and solid range; prestige mag converts to .40 Cal for higher damage/range with slower fire rate and lower ammo." },
  { weapon: "Hawker HX (Sniper)", change: "New", details: "New bolt-action sniper (Event Reward, in-season). One-shot headshot within a limited range by default; alternate barrel enables infinite-range one-shot headshot style." },

  { weapon: "AK-27 (17\" Bystro Speed Barrel)", change: "Buff", details: "Mid-Range Barrel update: now grants ~7% ADS movement speed; Medium Damage Range 1 benefit improved (25% → 35%)." },
  { weapon: "AK-27 Battle-Scar Conversion", change: "Nerf", details: "Damage reduced across ranges (70→56 max, 56→47 mid, 47→42 min) to slow TTK (generally +1 bullet to kill per range)." },

  { weapon: "DS20 Mirage (18.9\" Westerlies Barrel)", change: "Buff", details: "Mid-Range Barrel update: now grants ~7% ADS movement speed; Medium Damage Range 1 benefit improved (25% → 35%)." },

  { weapon: "M15 MOD 0", change: "Buff", details: "Max damage 32→33 and max range extended (0–38m → 0–45m). Min damage 22→24; breakpoints pushed out. Bullet velocity 880→900." },
  { weapon: "Maddox RFB", change: "Buff", details: "Mid damage 28→29 and mid range extends (37–48m → 37–60m). Bullet velocity 650→870; vertical recoil reduced ~5%." },
  { weapon: "MXR-17", change: "Nerf", details: "Long-range (minimum) damage reduced 36→34 (slightly weaker at long range)." },
  { weapon: "Peacekeeper Mk1", change: "Buff", details: "Long-range (minimum) damage increased 20→21 (slightly better at long range)." },
  { weapon: "X9 Maverick", change: "Buff", details: "Max damage 48→50 and max range extended (0–45m → 0–50m). Min damage 36→37; range breakpoints adjusted." },

  { weapon: "BO7 SMGs (Mid-Range Barrels)", change: "Buff", details: "Mid-Range Barrel update across SMGs: increased bullet velocity, improved mid-range benefits, reduced penalties." },
  { weapon: "Dravec 45", change: "Buff", details: "Min damage 30→34. Lower torso/leg multipliers 0.85x→0.9x. ADS 210ms→195ms; sprint-to-fire 170ms→140ms." },
  { weapon: "RK-9", change: "Buff", details: "Burst cooldown 0.09s → 0.082s. Bullet velocity 570→620. ADS 195ms→185ms." },

  { weapon: "MK.78 (LMG)", change: "Buff", details: "Max range extended (0–42m → 0–52m). Min damage 28→30." },
];

function badgeClasses(change: PatchChange) {
  if (change === "Buff") return "bg-green-500/10 text-green-400";
  if (change === "Nerf") return "bg-red-500/10 text-red-400";
  return "bg-sky-500/10 text-sky-300"; // New
}

export default function CodBuffsNerfsPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link href="/games/cod" className="text-sm text-neutral-300 hover:text-white">
            ← Back to Call of Duty
          </Link>
          <Link href="/" className="text-sm text-neutral-300 hover:text-white">
            Home
          </Link>
        </header>

        {/* Title */}
        <h1 className="mt-8 text-4xl font-bold">Weapon Buffs &amp; Nerfs</h1>
        <p className="mt-3 max-w-2xl text-neutral-300">
          Patch watch for Call of Duty — expected buffs, nerfs, balance changes, and meta shifts.
        </p>

        {/* Notes */}
        <div className="mt-10 space-y-4">
          {PATCH_NOTES.map((note, i) => (
            <div key={i} className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">{note.weapon}</div>
                <span className={`rounded-md px-2 py-1 text-xs font-semibold ${badgeClasses(note.change)}`}>
                  {note.change}
                </span>
              </div>

              <p className="mt-2 text-sm text-neutral-400">{note.details}</p>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <p className="mt-10 text-xs text-neutral-500">
          Changes based on official patches, early reports, and community testing. Final values may differ in-game.
        </p>
      </div>
    </main>
  );
}
