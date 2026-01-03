
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <section>
    {/* headline, description, badges */}
  </section>

  <section>
    {/* COD TTK + OSRS DPS cards */}
  </section>
</div>

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GamerStation",
  description: "Multi-game calculators, stats tools, and competitive gaming utilities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <footer className="border-t border-white/10 bg-black text-neutral-400">
  <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <p className="text-sm">© {new Date().getFullYear()} GamerStation. Built for gamers.</p>
    <div className="flex gap-4 text-sm">
      <a className="hover:text-white" href="/privacy">Privacy</a>
      <a className="hover:text-white" href="/terms">Terms</a>
      <a className="hover:text-white" href="/contact">Contact</a>
      {/* optional */}
      <a className="hover:text-white" href="/disclaimer">Disclaimer</a>
    </div>
  </div>
</footer>

      </body>
    </html>
  );
}
