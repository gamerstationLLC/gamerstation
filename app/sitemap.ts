import type { MetadataRoute } from "next";

const SITE_URL = "https://gamerstation.gg";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/calculators",
    "/calculators/lol",
    "/calculators/ttk/cod",
    "/calculators/ttk/fortnite",
    "/calculators/dps/osrs",
    "/terms",
    "/privacy",
    "/contact",
    "/disclaimer",
  ];

  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
