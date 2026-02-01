import fetch from "node-fetch";
import { load } from "cheerio";
import fs from "fs";

const START_URL = "https://gamerstation.gg"; // change if needed
const MAX_PAGES = 3000; // safety limit

const visited = new Set();
const broken = [];
const queue = [START_URL];

function normalize(href) {
  if (!href) return null;

  if (
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("javascript:")
  ) return null;

  let url = href;

  if (url.startsWith("//")) url = "https:" + url;
  if (url.startsWith("/")) url = START_URL + url;
  if (!url.startsWith("http")) return null;
  if (!url.startsWith(START_URL)) return null;

  try {
    const u = new URL(url);

    // ✅ drop query + hash so ?tab= doesn't create duplicates
    const clean = `${u.origin}${u.pathname}`.replace(/\/$/, "");

    return clean;
  } catch {
    return null;
  }
}


async function check(url) {
  try {
    const res = await fetch(url, { redirect: "follow" });
    return res.status;
  } catch {
    return 0; // network error / timeout
  }
}

async function crawl() {
  while (queue.length && visited.size < MAX_PAGES) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    console.log("Crawling:", url);

    let res;
    try {
      res = await fetch(url, { redirect: "follow" });
    } catch {
      broken.push({ url, status: 0 });
      continue;
    }

    // track 404s while crawling
    if (res.status === 404) {
      broken.push({ url, status: 404 });
      continue;
    }

    // only parse HTML pages
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html")) continue;

    const html = await res.text();
    const $ = load(html); // ✅ FIXED

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      const link = normalize(href);
      if (link && !visited.has(link)) queue.push(link);
    });
  }

  // Re-check visited URLs (optional but nice for correctness)
  const checked = [];
  for (const url of visited) {
    const status = await check(url);
    if (status === 404) broken.push({ url, status: 404 });
    checked.push({ url, status });
  }

  // de-dupe broken list
  const dedup = new Map();
  for (const b of broken) dedup.set(b.url, b.status);

  const lines =
    dedup.size === 0
      ? ["No 404s found"]
      : Array.from(dedup.entries())
          .sort((a, b) => (a[1] - b[1]) || a[0].localeCompare(b[0]))
          .map(([url, status]) => `${status}\t${url}`);

  fs.writeFileSync("404-report.txt", lines.join("\n"), "utf-8");

  console.log("\nDONE");
  console.log("Pages crawled:", visited.size);
  console.log("Unique 404s found:", Array.from(dedup.values()).filter((s) => s === 404).length);
  console.log("Saved to 404-report.txt");
}

crawl();
