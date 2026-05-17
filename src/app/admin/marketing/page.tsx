import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgePercent,
  Link as LinkIcon,
  Mail,
  Megaphone,
  Search,
  TrendingUp,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Marketing" };

export const dynamic = "force-dynamic";

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 3600 * 1000);
}

export default async function AdminMarketingHubPage() {
  const [
    activePromos,
    activeBanners,
    affiliateClicks30d,
    affiliateClicksPrev30d,
    draftCampaigns,
    sentCampaigns30d,
    promoConversions30d,
    newsletterSubsCount,
  ] = await Promise.all([
    prisma.promoCode.count({ where: { isActive: true } }),
    prisma.sitewideBanner.count({ where: { isActive: true } }),
    prisma.affiliateClick.count({
      where: { createdAt: { gte: daysAgo(30) } },
    }),
    prisma.affiliateClick.count({
      where: {
        createdAt: { gte: daysAgo(60), lt: daysAgo(30) },
      },
    }),
    prisma.emailCampaign.count({ where: { status: "DRAFT" } }),
    prisma.emailCampaign.count({
      where: { status: "SENT", sentAt: { gte: daysAgo(30) } },
    }),
    prisma.order.count({
      where: {
        status: "PAID",
        paidAt: { gte: daysAgo(30) },
        promoCodeId: { not: null },
      },
    }),
    prisma.newsletterSubscription
      .count({ where: { unsubscribedAt: null } })
      .catch(() => 0),
  ]);

  const affiliateDelta =
    affiliateClicksPrev30d > 0
      ? ((affiliateClicks30d - affiliateClicksPrev30d) / affiliateClicksPrev30d) * 100
      : affiliateClicks30d > 0
        ? 100
        : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Megaphone
            className="h-6 w-6 text-[color:var(--brand-primary)]"
            aria-hidden
          />
          Marketing
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acquisition, rétention, conversions des campagnes.
        </p>
      </header>

      {/* KPIs Marketing — 30 derniers jours */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Clics affiliation 30j"
          value={affiliateClicks30d}
          delta={affiliateDelta}
          icon={<LinkIcon className="h-4 w-4" />}
          hint="vs 30j précédents"
          href="/admin/marketing/affiliation"
        />
        <KpiCard
          label="Conversions promo 30j"
          value={promoConversions30d}
          icon={<BadgePercent className="h-4 w-4" />}
          hint="Orders avec code promo"
          href="/admin/marketing/codes-promo"
        />
        <KpiCard
          label="Campagnes envoyées 30j"
          value={sentCampaigns30d}
          icon={<Mail className="h-4 w-4" />}
          hint={`${draftCampaigns} brouillon${draftCampaigns > 1 ? "s" : ""}`}
          href="/admin/marketing/campagnes-email"
        />
        <KpiCard
          label="Abonnés newsletter"
          value={newsletterSubsCount}
          icon={<TrendingUp className="h-4 w-4" />}
          hint="Optin actifs (RGPD)"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acquisition</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Canaux pour ramener du trafic et convertir en élèves.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <Tile
              href="/admin/marketing/affiliation"
              icon={<LinkIcon className="h-4 w-4" />}
              label="Programme d'affiliation"
              description={`${affiliateClicks30d} clics les 30 derniers jours · commission 15%`}
            />
            <Tile
              href="/admin/marketing/seo"
              icon={<Search className="h-4 w-4" />}
              label="SEO"
              description="Suivi positions Google par cours, sitemap, balises meta."
            />
            <Tile
              href="/admin/marketing/promotions"
              icon={<Megaphone className="h-4 w-4" />}
              label={`Bannières sitewide (${activeBanners} active${activeBanners > 1 ? "s" : ""})`}
              description="Annonces programmables visibles en haut du site."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversion &amp; rétention</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Outils pour transformer le trafic en achats récurrents.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <Tile
              href="/admin/marketing/codes-promo"
              icon={<BadgePercent className="h-4 w-4" />}
              label={`Codes promo (${activePromos} actifs)`}
              description="Codes plateforme + codes formateur, conditions et stats."
            />
            <Tile
              href="/admin/marketing/campagnes-email"
              icon={<Mail className="h-4 w-4" />}
              label="Campagnes email"
              description={`${sentCampaigns30d} envoyées ces 30j · ${draftCampaigns} en préparation`}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Tile({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-md border border-border p-3 text-sm transition-colors hover:border-[color:var(--brand-secondary)] hover:bg-muted/50"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
