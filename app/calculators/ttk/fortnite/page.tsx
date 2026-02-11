import type { Metadata } from "next";
import FortniteTTKClient from "./client";

export const metadata: Metadata = {
  title: "Fortnite TTK Calculator | GamerStation",
  description:
    "Choose a weapon class, weapon, and rarity, then calculate shots-to-kill and time-to-kill (TTK) in Fortnite.",
};

export const dynamic = "force-static";
export const revalidate = 600;

export default function FortniteTTKPage() {
  return <FortniteTTKClient />;
}
