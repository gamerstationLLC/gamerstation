// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://gamerstation.gg"),
  title: "GamerStation",
  description: "Multi-game calculators, stats tools, and competitive gaming utilities.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}
        style={{
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          textRendering: "geometricPrecision",
        }}
      >
        {/* Global background (ALWAYS behind everything) */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
          {/* Spotlight / glow */}
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: "#07070a",
              backgroundImage: `
                radial-gradient(circle at 22% 18%, rgba(255,255,255,0.34), transparent 54%),
                radial-gradient(circle at 70% 22%, rgba(255,255,255,0.20), transparent 58%),
                radial-gradient(circle at 55% 70%, rgba(255,255,255,0.12), transparent 62%),
                linear-gradient(to bottom, rgba(255,255,255,0.12), rgba(255,255,255,0.03))
              `,
            }}
          />

          {/* Vignette */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                radial-gradient(
                  ellipse at center,
                  rgba(0,0,0,0) 0%,
                  rgba(0,0,0,0.32) 72%,
                  rgba(0,0,0,0.55) 100%
                )
              `,
            }}
          />
        </div>

        {/* 
          App surface: force transparency so page bg doesn't “fight” the global bg.
          Isolation keeps text rendering stable.
        */}
        <div className="relative z-10 min-h-screen bg-transparent [isolation:isolate] [transform:translateZ(0)]">
          {children}
        </div>

        <Analytics />
      </body>
    </html>
  );
}
