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

export default async function CodTtkPage() {
  const [sheetWeaponsRaw, sheetAttachmentsRaw] = await Promise.all([
    getCodWeapons(),
    getCodAttachments(),
  ]);

  // ✅ keep only fields the client uses (NEW: dmg10/dmg25/dmg50)
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

  // ✅ getCodAttachments() now already filters to barrels (if you used my updated file)
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
      />
    </Suspense>
  );
}
