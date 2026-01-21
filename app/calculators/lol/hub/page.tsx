// app/calculators/lol/hub/page.tsx
import type { Metadata } from "next";
import HubClient from "./client";

export const metadata: Metadata = {
  title: "LoL Calculators | GamerStation",
  description:
    "Pick a League of Legends calculator: burst damage or AP/AD stat impact. Clarity-first tools, no full sims.",
  alternates: { canonical: "/calculators/lol/hub" },
};

export default function Page() {
  return <HubClient />;
}
