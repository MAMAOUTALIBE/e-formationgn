import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";

import { AffiliateTracker } from "@/components/features/affiliate/affiliate-tracker";
import { ImpersonationBanner } from "@/components/features/admin/impersonation-banner";
import { PageViewTracker } from "@/components/features/analytics/page-view-tracker";
import { CookieBanner } from "@/components/features/cookie-consent/cookie-banner";
import { SitewideBanner } from "@/components/features/marketing/sitewide-banner";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://e-formationgn.com"),
  title: {
    default: "E-FormationGN — Plateforme de formation en ligne",
    template: "%s · E-FormationGN",
  },
  description:
    "E-FormationGN est la marketplace francophone de formations en ligne. Apprenez à votre rythme avec des formateurs experts, ou partagez votre savoir.",
  applicationName: "E-FormationGN",
  authors: [{ name: "E-FormationGN" }],
  keywords: [
    "formation en ligne",
    "e-learning",
    "cours en ligne",
    "francophone",
    "marketplace formation",
  ],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://e-formationgn.com",
    siteName: "E-FormationGN",
    title: "E-FormationGN — Plateforme de formation en ligne",
    description:
      "Apprenez à votre rythme avec des formateurs experts ou partagez votre savoir sur E-FormationGN.",
    images: [{ url: "/logo.svg", width: 512, height: 512, alt: "E-FormationGN" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "E-FormationGN — Plateforme de formation en ligne",
    description:
      "Apprenez à votre rythme avec des formateurs experts ou partagez votre savoir sur E-FormationGN.",
  },
  icons: {
    icon: "/favicon.ico",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground flex flex-col">
        <Suspense fallback={null}>
          <ImpersonationBanner />
        </Suspense>
        <Suspense fallback={null}>
          <SitewideBanner />
        </Suspense>
        <Suspense fallback={null}>
          <AffiliateTracker />
        </Suspense>
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
