import Link from "next/link";

export const metadata = {
  title: "Tools | GamerStation",
  description: "Stats tools, leaderboards, and utilities across games.",
};

type ToolItem = {
  title: string;
  desc: string;
  href: string;
};

type GameGroup = {
  key: string;
  name: string;
  subtitle?: string;
  items: ToolItem[];
};

function GroupAccordion({
  group,
  defaultOpen = false,
}: {
  group: GameGroup;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="
        group rounded-2xl border border-neutral-800 bg-black/50
        transition hover:border-neutral-600
      "
      open={defaultOpen}
    >
      <summary
        className="
          cursor-pointer list-none select-none
          px-6 py-4
          flex items-center gap-3
        "
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white/90">{group.name}</div>
          {group.subtitle ? (
            <div className="mt-1 text-xs text-neutral-400">{group.subtitle}</div>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs text-neutral-400">
          <span>{group.items.length} tools</span>
          <span
            className="
              transition-transform duration-200
              group-open:rotate-180
            "
            aria-hidden
          >
            ▾
          </span>
        </div>
      </summary>

      <div className="px-6 pb-5 pt-1">
        <div className="grid gap-4 sm:grid-cols-2">
          {group.items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="
                rounded-2xl border border-neutral-800 bg-black/60 p-6
                transition hover:border-neutral-600 hover:bg-black/75
              "
            >
              <div className="text-sm font-semibold">{it.title}</div>
              <div className="mt-2 text-sm text-neutral-400">{it.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </details>
  );
}

export default function ToolsPage() {
  const groups: GameGroup[] = [
    {
      key: "lol",
      name: "League of Legends",
      subtitle: "Summoners, leaderboards, tiers, and meta tools.",
      items: [
        {
          title: "LoL Summoner Stats",
          desc: "Look up your Riot ID and get a clean, real-time breakdown of your ranked stats, match history, and performance.",
          href: "/tools/lol/summoner",
        },
        {
          title: "LoL Leaderboards",
          desc: "Filter top players by region/role.",
          href: "/tools/lol/leaderboard",
        },
        {
          title: "LoL Champion Tier List",
          desc: "Filter champions by winrate, pickrate, etc.",
          href: "/tools/lol/champion-tiers",
        },
        {
          title: "LoL Champion Index",
          desc: "Base stats + ability numbers.",
          href: "/calculators/lol/champions",
        },
        {
          title: "LoL Meta",
          desc: "Role-based boots + core items from real ranked matches.",
          href: "/calculators/lol/meta",
        },
      ],
    },
    {
      key: "dota",
      name: "Dota 2",
      subtitle: "Meta pages and hero browsing.",
      items: [
        {
          title: "Dota 2 Meta",
          desc: "Winrate, MMR estimate, and pickrate (OpenDota).",
          href: "/tools/dota/meta",
        },
        {
          title: "Dota 2 Hero Index",
          desc: "Current heros and stats.",
          href: "/tools/dota/heroes",
        },
      ],
    },
    {
      key: "cod",
      name: "Call of Duty",
      subtitle: "Loadouts and patch watch.",
      items: [
        {
          title: "COD Meta Loadouts",
          desc: "Current best weapon builds for Warzone and Multiplayer.",
          href: "/games/cod/meta-loadouts",
        },
        {
          title: "COD Weapon Buffs / Nerfs",
          desc: "Patch watch: expected buffs, nerfs, rebalances, and meta shifts.",
          href: "/games/cod/buffs-nerfs",
        },
      ],
    },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent text-white">
      {/* Ambient background */}
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
          {/* Header */}
          <header className="mb-8 flex items-center">
            {/* Left: Logo */}
            <Link href="/" className="flex items-center gap-2 hover:opacity-90">
              <img
                src="/gs-logo-v2.png"
                alt="GamerStation"
                className="h-10 w-10 rounded-xl bg-black p-1 shadow-[0_0_30px_rgba(0,255,255,0.12)]"
              />
              <span className="text-lg font-black tracking-tight">
                GamerStation<span className="align-super text-[0.6em]">™</span>
              </span>
            </Link>

            {/* Right: Calculators button */}
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

          <h1 className="mt-2 text-4xl font-bold tracking-tight">Tools</h1>
          <p className="mt-3 text-neutral-300">
            This is the hub for non-calculator utilities (leaderboards, meta
            pages, indexes).
          </p>

          <div className="mt-10 grid gap-4">
  {groups.map((g) => (
    <GroupAccordion key={g.key} group={g} />
  ))}
</div>

        </div>
      </div>
    </main>
  );
}
