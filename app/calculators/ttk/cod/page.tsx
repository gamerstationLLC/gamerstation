import { getCodWeapons } from "@/lib/codweapons";
import { getCodAttachments } from "@/lib/codattachments";
import CodTtkClient from "./CodTtkClient";

export default async function CodTtkPage() {
  const sheetWeapons = await getCodWeapons();
  const sheetAttachments = await getCodAttachments();

  return (
    <CodTtkClient
      sheetWeapons={sheetWeapons}
      sheetAttachments={sheetAttachments}
    />
  );
}
