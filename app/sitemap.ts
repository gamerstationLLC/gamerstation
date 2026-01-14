import type { MetadataRoute } from "next";

const SITE_URL = "https://gamerstation.gg";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: Array<{
    path: string;
    priority: number;
  }> = [
    // Home & hubs
    { path: "", priority: 1.0 },
    { path: "/calculators", priority: 0.9 },

    // Core calculators
    { path: "/calculators/lol", priority: 0.85 },
    { path: "/calculators/ttk/cod", priority: 0.85 },
    { path: "/calculators/ttk/fortnite", priority: 0.85 },
    { path: "/calculators/dps/osrs", priority: 0.85 },

    // Roblox hub & calculators
    { path: "/calculators/roblox", priority: 0.85 },
    { path: "/calculators/roblox/arsenal", priority: 0.85 },
    { path: "/calculators/roblox/bloxfruits", priority: 0.8 },

    // WoW
    { path: "/calculators/wow", priority: 0.85 },
    { path: "/calculators/wow/pve", priority: 0.8 },

    // WoW PvE subtools
    { path: "/calculators/wow/pve/stat-impact", priority: 0.75 },
    { path: "/calculators/wow/pve/mythic-plus", priority: 0.75 },
    { path: "/calculators/wow/pve/uptime", priority: 0.75 },

    // Legal / misc
    { path: "/terms", priority: 0.3 },
    { path: "/privacy", priority: 0.3 },
    { path: "/contact", priority: 0.3 },
    { path: "/disclaimer", priority: 0.3 },
  ];

  return routes.map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority,
  }));
}
