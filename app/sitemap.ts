import type { MetadataRoute } from "next";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * ✅ Fully automatic sitemap for GamerStation
 *
 * Includes:
 * - ALL static App Router pages (page.tsx / page.ts)
 * - ALL LoL champion pages expanded from:
 *     public/data/lol/champions_full.json
 *
 * Skips:
 * - app/api/**
 * - route groups (folders like (group))
 * - private folders (_ or .)
 * - dynamic segments like [slug] (except LoL champions, which we expand manually)
 */

const SITE_URL = "https://gamerstation.gg";

type ChangeFreq = "daily" | "weekly" | "monthly";

function isRouteGroup(name: string) {
  return name.startsWith("(") && name.endsWith(")");
}

function isDynamic(name: string) {
  return name.startsWith("[") && name.endsWith("]");
}

async function hasPage(dir: string) {
  try {
    await fs.access(path.join(dir, "page.tsx"));
    return true;
  } catch {}
  try {
    await fs.access(path.join(dir, "page.ts"));
    return true;
  } catch {}
  return false;
}

async function walkApp(dir: string, urlParts: string[], out: string[]) {
  const base = path.basename(dir);

  if (base.startsWith(".") || base.startsWith("_")) return;
  if (urlParts[0] === "api") return;
  if (isDynamic(base)) return;

  if (await hasPage(dir)) {
    out.push(urlParts.length ? "/" + urlParts.join("/") : "");
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name === "node_modules") continue;
    if (e.name.startsWith(".") || e.name.startsWith("_")) continue;

    const nextParts = isRouteGroup(e.name) ? urlParts : [...urlParts, e.name];
    await walkApp(path.join(dir, e.name), nextParts, out);
  }
}

function rulesFor(pathname: string) {
  if (pathname === "") return { priority: 1.0, changeFrequency: "daily" as ChangeFreq };
  if (pathname === "/calculators") return { priority: 0.95, changeFrequency: "weekly" as ChangeFreq };

  if (pathname.startsWith("/calculators/lol/champions/"))
    return { priority: 0.82, changeFrequency: "weekly" as ChangeFreq };

  if (pathname.startsWith("/calculators"))
    return { priority: 0.85, changeFrequency: "weekly" as ChangeFreq };

  if (pathname.startsWith("/games"))
    return { priority: 0.8, changeFrequency: "monthly" as ChangeFreq };

  return { priority: 0.7, changeFrequency: "weekly" as ChangeFreq };
}

async function getLolChampionPaths(): Promise<string[]> {
  try {
    const p = path.join(process.cwd(), "public", "data", "lol", "champions_full.json");
    const raw = await fs.readFile(p, "utf-8");
    const json = JSON.parse(raw) as { champions?: { id?: string }[] };

    const champs = json.champions ?? [];
    return champs
      .map((c) => c.id)
      .filter(Boolean)
      .map((id) => `/calculators/lol/champions/${String(id).toLowerCase()}`);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appDir = path.join(process.cwd(), "app");
  const paths: string[] = [];

  await walkApp(appDir, [], paths);

  const lolChampionPaths = await getLolChampionPaths();

  const all = Array.from(new Set([...paths, ...lolChampionPaths])).sort();
  const now = new Date();

  return all.map((p) => {
    const r = rulesFor(p);
    return {
      url: SITE_URL + p,
      lastModified: now,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    };
  });
}
