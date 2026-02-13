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
        <AdSenseAnchorSpacer />
        <AdSenseSideRails />

        {/* Global background */}
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

        {/* Main app surface */}
        <div className="relative z-10 min-h-[100dvh] bg-transparent [isolation:isolate] pb-28">
          {children}

          {/* Global footer */}
          
        </div>

        <Analytics />
      </body>
    </html>
  );
}
