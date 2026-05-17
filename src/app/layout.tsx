import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";

import { AffiliateTracker } from "@/components/features/affiliate/affiliate-tracker";
import { ImpersonationBanner } from "@/components/features/admin/impersonation-banner";
import { TestModeBanner } from "@/components/features/payments/test-mode-banner";
import { PageViewTracker } from "@/components/features/analytics/page-view-tracker";
import { CookieBanner } from "@/components/features/cookie-consent/cookie-banner";
import { SitewideBanner } from "@/components/features/marketing/sitewide-banner";
import { ServiceWorkerRegister } from "@/components/features/pwa/sw-register";
import { ThemeProvider } from "@/components/features/theme/theme-provider";
import { Toaster } from "@/components/ui/toaster";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://gandal.gn"),
  title: {
    default: "Gandal — Plateforme de formation en ligne",
    template: "%s · Gandal",
  },
  description:
    "Gandal est la marketplace francophone de formations en ligne. Apprenez à votre rythme avec des formateurs experts, ou partagez votre savoir.",
  applicationName: "Gandal",
  authors: [{ name: "Gandal" }],
  keywords: [
    "formation en ligne",
    "e-learning",
    "cours en ligne",
    "francophone",
    "marketplace formation",
  ],
  // Hreflang multi-pays francophones : indique à Google que la même URL est
  // pertinente pour chaque marché (pas de version traduite pour l'instant —
  // x-default + fr-* pointent tous vers la même langue). Quand un domaine
  // local sera lancé (gandal.fr, gandal.ci, …), on remplacera ces valeurs.
  alternates: {
    canonical: "/",
    languages: {
      "fr-FR": "/",
      "fr-BE": "/",
      "fr-CA": "/",
      "fr-CI": "/",
      "fr-SN": "/",
      "fr-GN": "/",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    alternateLocale: ["fr_BE", "fr_CA", "fr_CI", "fr_SN"],
    url: "https://gandal.gn",
    siteName: "Gandal",
    title: "Gandal — Plateforme de formation en ligne",
    description:
      "Apprenez à votre rythme avec des formateurs experts ou partagez votre savoir sur Gandal.",
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "Gandal" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gandal — Plateforme de formation en ligne",
    description:
      "Apprenez à votre rythme avec des formateurs experts ou partagez votre savoir sur Gandal.",
    images: ["/api/og"],
  },
  icons: {
    icon: "/favicon.ico",
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
  },
};

// Toutes les pages dépendent de la session (auth) ou de Prisma → on force le
// rendu dynamique. Évite l'échec du prerender de /_not-found au build Docker
// (qui n'a pas accès à Postgres avec l'URL placeholder).
export const dynamic = "force-dynamic";

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
        <ThemeProvider>
          <TestModeBanner />
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
          <ServiceWorkerRegister />
          {children}
          <Toaster />
          <CookieBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
