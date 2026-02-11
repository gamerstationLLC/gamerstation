import type { Metadata } from "next";
import { Suspense } from "react";

import { getCodWeapons } from "@/lib/codweapons";
import { getCodAttachments } from "@/lib/codattachments";
import CodTtkClient from "./CodTtkClient";

export const metadata: Metadata = {
  title: "Call of Duty TTK Calculator – Warzone & Multiplayer | GamerStation",
  description:
    "Calculate time-to-kill (TTK) in Call of Duty for Warzone and Multiplayer. Compare weapons, accuracy, headshots, armor plates, and ranges instantly.",
};

/**
 * IMPORTANT:
 * This must NEVER break the page. COD site can block/slow SSR fetches.
 * So we:
 * - timeout fast
 * - swallow all errors
 * - fallback to "latest"
 */
async function fetchTextWithTimeout(
  url: string,
  ms: number,
  revalidateSeconds: number
): Promise<string | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // cache a bit so we don't slam COD site or slow every request
      next: { revalidate: revalidateSeconds },
      // keep headers minimal; some CDNs dislike custom UAs
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function extractFirstPatchHref(indexHtml: string): string | null {
  // Prefer a patchnotes article link. COD page structure changes, so keep it flexible.
  // Try a few patterns and take the first match.
  const patterns = [
    /href="(\/patchnotes\/\d{4}\/\d{2}\/[^"]+)"/i,
    /href="(\/patchnotes\/[^"]+)"/i,
  ];

  for (const p of patterns) {
    const m = indexHtml.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

function extractDateLabel(patchHtml: string): string | null {
  const m = patchHtml.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/
  );
  return m?.[0]?.trim() ?? null;
}

function extractH1Title(patchHtml: string): string | null {
  const m = patchHtml.match(/<h1[^>]*>([^<]{3,120})<\/h1>/i);
  if (!m?.[1]) return null;
  const title = m[1].replace(/\s+/g, " ").trim();
  return title.length ? title : null;
}

async function getCodPatchLabel(): Promise<string> {
  const FALLBACK = "latest";

  // 1) Fetch patchnotes index (fast timeout)
  const indexHtml = await fetchTextWithTimeout(
    "https://www.callofduty.com/patchnotes",
    1800, // 1.8s timeout
    3600 // revalidate 1 hour
  );

  if (!indexHtml) return FALLBACK;

  const href = extractFirstPatchHref(indexHtml);
  if (!href) return FALLBACK;

  const patchUrl = href.startsWith("http")
    ? href
    : `https://www.callofduty.com${href}`;

  // 2) Fetch the latest patch page (fast timeout)
  const patchHtml = await fetchTextWithTimeout(
    patchUrl,
    1800, // 1.8s timeout
    3600
  );

  if (!patchHtml) return FALLBACK;

  // 3) Prefer a clean date for the pill
  const date = extractDateLabel(patchHtml);
  if (date) return date;

  // 4) If no date, use title (kept short)
  const title = extractH1Title(patchHtml);
  if (title) return title;

  return FALLBACK;
}

export default async function CodTtkPage() {
  const [sheetWeaponsRaw, sheetAttachmentsRaw, patchLabel] = await Promise.all([
    getCodWeapons(),
    getCodAttachments(),
    getCodPatchLabel(),
  ]);

  const sheetWeapons = sheetWeaponsRaw.map((w: any) => ({
    weapon_id: w.weapon_id,
    weapon_name: w.weapon_name,
    weapon_type: w.weapon_type,
    rpm: w.rpm,
    headshot_mult: w.headshot_mult,
    fire_mode: w.fire_mode,
    dmg10: w.dmg10,
    dmg25: w.dmg25,
    dmg50: w.dmg50,
  }));

  const sheetAttachments = sheetAttachmentsRaw.map((a: any) => ({
    attachment_id: a.attachment_id,
    attachment_name: a.attachment_name,
    slot: a.slot,
    applies_to: a.applies_to,
    dmg10_add: a.dmg10_add,
    dmg25_add: a.dmg25_add,
    dmg50_add: a.dmg50_add,
  }));

  return (
    <Suspense fallback={null}>
      <CodTtkClient
        sheetWeapons={sheetWeapons}
        sheetAttachments={sheetAttachments}
        patchLabel={patchLabel}
      />
    </Suspense>
  );
}
