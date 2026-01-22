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

  // ✅ IMPORTANT:
  // Do NOT set metadata.icons here if you're using the App Router icon pipeline.
  // Next will automatically serve:
  // - app/favicon.ico      -> /favicon.ico
  // - app/icon.png         -> /icon.png
  // - app/apple-icon.png   -> /apple-icon.png
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* ✅ No global footer here (prevents /privacy, /disclaimer, /contact from dominating internal links) */}
        {children}
        <Analytics />
      </body>
    </html>
  );
}
