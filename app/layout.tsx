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
  title: "GamerStation",
  description: "Multi-game calculators, stats tools, and competitive gaming utilities.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/favicon-192x192.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-dvh flex flex-col">
          {/* Main scrollable content */}
          <main className="flex-1">
            {children}
          </main>

        <footer className="border-t border-white/10 bg-black text-neutral-400 pb-[calc(60px+env(safe-area-inset-bottom))] lg:pb-0">
  <div className="mx-auto max-w-6xl px-6 py-4 flex flex-col items-center gap-3 text-center">
<div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">

    <p className="text-sm">
      © {new Date().getFullYear()} GamerStation. Built for gamers.
    </p>
    <div className="flex gap-4 text-sm">
      <a className="hover:text-white" href="/privacy">Privacy</a>
      <a className="hover:text-white" href="/terms">Terms</a>
      <a className="hover:text-white" href="/contact">Contact</a>
      <a className="hover:text-white" href="/disclaimer">Disclaimer</a>
    </div>
  </div>
  </div>
</footer>



          <Analytics />
        </div>
      </body>
    </html>
  );
}
