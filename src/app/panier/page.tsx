import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CartRow } from "@/components/features/cart/cart-row";
import { CartSummaryForm } from "@/components/features/cart/cart-summary-form";
import { CurrencyToggle } from "@/components/features/preferences/currency-toggle";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { readAffiliateCode } from "@/lib/affiliate";
import { getCurrentCurrency } from "@/lib/currency";
import { isCinetPayConfigured } from "@/lib/payments/cinetpay";
import { isStripeConfigured } from "@/lib/stripe";
import { computeCartLines, listCartItems } from "@/server/queries/cart";

export const metadata: Metadata = {
  title: "Panier",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ canceled?: string }>;
}

export default async function CartPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion?callbackUrl=/panier");
  }

  const items = await listCartItems(session.user.id);
  const currency = await getCurrentCurrency(session.user.preferredCurrency);
  const affiliateCode = await readAffiliateCode();

  const { lines, subtotalCents } = computeCartLines({
    items,
    currency,
    affiliateCode,
  });

  // Mappe pour passer aux composants
  const rows = items.map((item) => {
    const line = lines.find((l) => l.courseId === item.course.id);
    const instructorName =
      item.course.instructor.name ??
      item.course.instructor.firstName ??
      "Formateur Gandal";
    return {
      courseId: item.course.id,
      slug: item.course.slug,
      title: item.course.title,
      thumbnailUrl: item.course.thumbnailUrl ?? null,
      instructorName,
      priceEUR: Number(item.course.priceEUR),
      priceUSD: Number(item.course.priceUSD),
      discountPriceEUR:
        item.course.discountPriceEUR != null
          ? Number(item.course.discountPriceEUR)
          : null,
      discountPriceUSD:
        item.course.discountPriceUSD != null
          ? Number(item.course.discountPriceUSD)
          : null,
      badge: line?.isInstructorDriven ? "Affiliation 15%" : undefined,
    };
  });

  return (
    <>
      <SiteHeader />

      <main className="flex-1 bg-muted/20 py-8">
        <Container className="space-y-6">
          <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Panier" }]} />

          {params.canceled === "1" ? (
            <Alert variant="info">
              <AlertDescription>
                Paiement annulé. Votre panier est intact, vous pouvez réessayer
                quand vous voulez.
              </AlertDescription>
            </Alert>
          ) : null}

          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Mon panier
            </h1>
            <p className="text-sm text-muted-foreground">
              {items.length.toLocaleString("fr-FR")}{" "}
              {items.length > 1 ? "cours" : "cours"} dans votre panier.
            </p>
          </div>

          {items.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
                <p className="text-base font-medium text-foreground">
                  Votre panier est vide.
                </p>
                <Button asChild>
                  <Link href="/cours">Explorer le catalogue</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <Card>
                <CardHeader>
                  <CardTitle>Articles</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul>
                    {rows.map((row) => (
                      <CartRow key={row.courseId} {...row} currency={currency} />
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <aside className="lg:sticky lg:top-24 lg:self-start">
                <Card>
                  <CardHeader>
                    <CardTitle>Récapitulatif</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Devise de paiement
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Choisissez l&apos;euro ou le dollar
                        </p>
                      </div>
                      <CurrencyToggle current={currency} />
                    </div>
                    <CartSummaryForm
                      subtotalCents={subtotalCents}
                      currency={currency}
                      affiliateActive={Boolean(affiliateCode)}
                      stripeAvailable={isStripeConfigured()}
                      cinetpayAvailable={isCinetPayConfigured()}
                    />
                  </CardContent>
                </Card>
              </aside>
            </div>
          )}
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
