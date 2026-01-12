import type { Metadata } from "next";
import OsrsDpsClient from "./OsrsDpsClient";

export const metadata: Metadata = {
  title: "OSRS DPS Calculator",
  description:
    "Calculate DPS in Old School RuneScape with gear, prayers, potions, and combat stats. Compare setups instantly with a fast OSRS DPS calculator.",
};

export default function Page() {
  return <OsrsDpsClient />;
}
