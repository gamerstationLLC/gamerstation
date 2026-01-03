import { getCodWeapons } from "@/lib/codweapons";
import CodTtkClient from "./CodTtkClient";

export default async function CodTtkPage() {
  const sheetWeapons = await getCodWeapons();
  return <CodTtkClient sheetWeapons={sheetWeapons} />;
}
