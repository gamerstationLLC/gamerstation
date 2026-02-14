import Link from "next/link";

type PatchChange = "Buff" | "Nerf" | "New";

const PATCH_NOTES: { weapon: string; change: PatchChange; details: string }[] = [
  {
    weapon: "Sturmwolf 45 (SMG)",
    change: "New",
    details:
      "New full-auto SMG (Event Reward). Low recoil and solid range; prestige mag converts to .40 Cal for higher damage/range with slower fire rate and lower ammo.",
  },
  {
    weapon: "Hawker HX (Sniper)",
    change: "New",
    details:
      "New bolt-action sniper (Event Reward, in-season). One-shot headshot within a limited range by default; alternate barrel enables infinite-range one-shot headshot style.",
  },

  {
    weapon: 'AK-27 (17" Bystro Speed Barrel)',
    change: "Buff",
    details:
      "Mid-Range Barrel update: now grants ~7% ADS movement speed; Medium Damage Range 1 benefit improved (25% â†’ 35%).",
  },
  {
    weapon: "AK-27 Battle-Scar Conversion",
    change: "Nerf",
    details:
      "Damage reduced across ranges (70â†’56 max, 56â†’47 mid, 47â†’42 min) to slow TTK (generally +1 bullet to kill per range).",
  },

  {
    weapon: 'DS20 Mirage (18.9" Westerlies Barrel)',
    change: "Buff",
    details:
      "Mid-Range Barrel update: now grants ~7% ADS movement speed; Medium Damage Range 1 benefit improved (25% - 35%).",
  },

  {
    weapon: "M15 MOD 0",
    change: "Buff",
    details:
      "Max damage 32-33 and max range extended (0-38m - 0-45m). Min damage 22-24; breakpoints pushed out. Bullet velocity 880-900.",
  },
  {
    weapon: "Maddox RFB",
    change: "Buff",
    details:
      "Mid damage 28-29 and mid range extends (37-48m â†’ 37-60m). Bullet velocity 650â†’870; vertical recoil reduced ~5%.",
  },
  {
    weapon: "MXR-17",
    change: "Nerf",
    details: "Long-range (minimum) damage reduced 36â†’34 (slightly weaker at long range).",
  },
  {
    weapon: "Peacekeeper Mk1",
    change: "Buff",
    details: "Long-range (minimum) damage increased 20â†’21 (slightly better at long range).",
  },
  {
    weapon: "X9 Maverick",
    change: "Buff",
    details:
      "Max damage 48â†’50 and max range extended (0-45m â†’ 0-50m). Min damage 36â†’37; range breakpoints adjusted.",
  },

  {
    weapon: "BO7 SMGs (Mid-Range Barrels)",
    change: "Buff",
    details:
      "Mid-Range Barrel update across SMGs: increased bullet velocity, improved mid-range benefits, reduced penalties.",
  },
  {
    weapon: "Dravec 45",
    change: "Buff",
    details:
      "Min damage 30â†’34. Lower torso/leg multipliers 0.85xâ†’0.9x. ADS 210msâ†’195ms; sprint-to-fire 170msâ†’140ms.",
  },
  {
    weapon: "RK-9",
    change: "Buff",
    details:
      "Burst cooldown 0.09s â†’ 0.082s. Bullet velocity 570â†’620. ADS 195msâ†’185ms.",
  },

  {
    weapon: "MK.78 (LMG)",
    change: "Buff",
    details: "Max range extended (0-42m â†’ 0-52m). Min damage 28â†’30.",
  },
];

function badgeClasses(change: PatchChange) {
  if (change === "Buff") return "bg-green-500/10 text-green-400";
  if (change === "Nerf") return "bg-red-500/10 text-red-400";
  return "bg-sky-500/10 text-sky-300"; // New
}

export default function CodBuffsNerfsPage() {
  const navBtn =
    "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white hover:shadow-[0_0_25px_rgba(0,255,255,0.35)]";

  const backLink =
    "inline-flex w-fit items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 hover:underline underline-offset-4";

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent text-white">
      {/* âœ… GS background system */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-1/3 -left-32 h-[420px] w-[420px] rounded-full bg-white/8 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-[520px] w-[520px] rounded-full bg-white/8 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black" />
      </div>

      <div className="relative px-6 py-16">
        <div className="mx-auto max-w-5xl">
          {/* âœ… Standard header: brand left, Tools top-right */}
          <header className="mb-8 flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90">
              <img
                src="/gs-logo-v2.png"
                alt="GamerStation"
                className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_30px_rgba(0,255,255,0.12)]"
              />
              <span className="text-lg font-black tracking-tight">
                GamerStation<span className="align-super text-[0.6em]">TM</span>
              </span>
            </Link>

            <div className="ml-auto flex items-center gap-2">
              <Link href="/tools" className={navBtn}>
                Tools
              </Link>
            </div>
          </header>

          {/* Title */}
          <h1 className="mt-2 text-4xl font-bold">Weapon Buffs &amp; Nerfs</h1>
          <p className="mt-3 max-w-2xl text-neutral-300">
            Patch watch for Call of Duty - expected buffs, nerfs, balance changes, and meta shifts.
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
      </div>
    </main>
  );
}
