import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const routes = [
    "",
    "/calculators",
    "/calculators/ttk/cod",
    "/calculators/ttk/fortnite",
    "/calculators/dps/osrs",
    "/terms",
    "/privacy",
    "/contact",
    "/disclaimer",
  ];

  return routes.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
