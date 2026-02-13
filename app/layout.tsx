// app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import AdSenseAnchorSpacer from "./_components/AdSenseAnchorSpacer";
import AdSenseSideRails from "./_components/AdSenseSideRails";
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
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

        {/* Warm up ad network connections */}
        <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossOrigin="" />
        <link rel="preconnect" href="https://googleads.g.doubleclick.net" crossOrigin="" />
        <link rel="preconnect" href="https://tpc.googlesyndication.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
        <link rel="dns-prefetch" href="https://googleads.g.doubleclick.net" />
        <link rel="dns-prefetch" href="https://tpc.googlesyndication.com" />

        {/* AdSense loader (global) */}
        <Script
          id="adsense-script"
          async
          strategy="afterInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9530220531970117"
          crossOrigin="anonymous"
        />
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}
        style={{
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          textRendering: "geometricPrecision",
        }}
      >
        {/* Optional: keeps your own fixed UI above AdSense anchor */}
        <AdSenseAnchorSpacer />

        {/* ✅ Desktop-only side rails */}
        <AdSenseSideRails />

        {/* Global background (ALWAYS behind everything) */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
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

        {/* IMPORTANT: no transforms here; transforms can break position:fixed descendants */}
        <div className="relative z-10 min-h-[100dvh] bg-transparent [isolation:isolate]">
          {children}
        </div>

        <Analytics />
      </body>
    </html>
  );
}
