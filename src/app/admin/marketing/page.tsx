import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Marketing" };

export const dynamic = "force-dynamic";

function thirtyDaysAgo() {
  return new Date(Date.now() - 30 * 24 * 3600 * 1000);
}

export default async function AdminMarketingHubPage() {
  const [activePromos, activeBanners, recentAffiliateClicks, draftCampaigns] =
    await Promise.all([
      prisma.promoCode.count({ where: { isActive: true } }),
      prisma.sitewideBanner.count({ where: { isActive: true } }),
      prisma.affiliateClick.count({
        where: {
          createdAt: { gte: thirtyDaysAgo() },
        },
      }),
      prisma.emailCampaign.count({ where: { status: "DRAFT" } }),
    ]);

  const tiles: Array<{ href: string; label: string; description: string }> = [
    {
      href: "/admin/marketing/codes-promo",
      label: `Codes promo (${activePromos})`,
      description: "Codes plateforme et formateur, conditions et stats.",
    },
    {
      href: "/admin/marketing/affiliation",
      label: `Affiliation (${recentAffiliateClicks} clics 30 j)`,
      description: "Liens d'affiliation, conversions, taux préférentiels.",
    },
    {
      href: "/admin/marketing/campagnes-email",
      label: `Campagnes email (${draftCampaigns} brouillons)`,
      description: "Templates, segments dynamiques, envoi via Resend.",
    },
    {
      href: "/admin/marketing/promotions",
      label: `Bannières (${activeBanners} actives)`,
      description: "Bannières sitewide programmables.",
    },
    {
      href: "/admin/marketing/seo",
      label: "SEO",
      description: "Suivi positions Google par cours.",
    },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Marketing
        </h1>
        <p className="text-sm text-muted-foreground">
          Acquisition, rétention et campagnes.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modules</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {tiles.map((t) => (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className="block rounded-md border border-border p-3 text-sm hover:bg-muted/50"
                >
                  <p className="font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
