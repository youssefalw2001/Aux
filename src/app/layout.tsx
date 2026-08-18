import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * metadataBase must be an absolute origin or Next emits relative og:image URLs
 * (and warns at build). Crawlers — Instagram's included — will not resolve a
 * relative image, so the link unfurls as a bare URL and the funnel dies. Set
 * NEXT_PUBLIC_SITE_URL per environment.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "aux — the voice note party game",
  description:
    "Drop a prompt. Everyone records. The group votes. Play it in your group chat.",
  openGraph: {
    title: "aux — the voice note party game",
    description: "Drop a prompt. Everyone records. The group votes.",
    type: "website",
    siteName: "aux",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#08090d",
  // Prevent the double-tap zoom that makes fast tapping feel broken in the
  // Instagram in-app browser. `maximumScale` alone is ignored by iOS 10+, so
  // we also set interactiveWidget for keyboard handling.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="grain flex min-h-full flex-col">{children}</body>
    </html>
  );
}
