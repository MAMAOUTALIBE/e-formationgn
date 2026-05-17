import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Compass, Lock, ShieldCheck, ShoppingCart } from "lucide-react";

import { auth } from "@/auth";
import { CartRow } from "@/components/features/cart/cart-row";
import { CartSummaryForm } from "@/components/features/cart/cart-summary-form";
import { CourseCard } from "@/components/features/courses/course-card";
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
import { listCartCrossSell } from "@/server/queries/courses";
import { listCategories } from "@/server/queries/categories";

export const metadata: Metadata = {
  title: "Panier",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ canceled?: string; msg?: string }>;
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

  // Cross-sell : courses similaires aux items en panier (mêmes catégories,
  // exclusion des items + déjà inscrits). Vide si panier vide → empty state
  // affichera plutôt des catégories populaires.
  const cartCategoryIds = Array.from(
    new Set(items.map((it) => it.course.categoryId).filter(Boolean)),
  );
  const cartCourseIds = items.map((it) => it.course.id);
  const [crossSell, allCategories] = await Promise.all([
    items.length > 0
      ? listCartCrossSell({
          userId: session.user.id,
          excludeCourseIds: cartCourseIds,
          fromCategoryIds: cartCategoryIds,
          limit: 4,
        })
      : Promise.resolve([]),
    listCategories(),
  ]);

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

          {params.msg ? (
            <Alert variant="destructive">
              <AlertDescription>{params.msg}</AlertDescription>
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
            <div className="space-y-6">
              <Card>
                <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
                  <div className="rounded-full bg-muted p-4">
                    <ShoppingCart
                      className="h-8 w-8 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">
                      Votre panier est vide
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Découvrez le catalogue, ou retrouvez vos cours sauvegardés
                      dans la wishlist.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button asChild>
                      <Link href="/cours">Explorer le catalogue</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/wishlist">Voir ma wishlist</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {allCategories.length > 0 ? (
                <section
                  aria-labelledby="categories-suggested"
                  className="rounded-lg border border-dashed border-border bg-card p-5 text-center"
                >
                  <p
                    id="categories-suggested"
                    className="flex items-center justify-center gap-1.5 text-sm font-semibold text-foreground"
                  >
                    <Compass
                      className="h-4 w-4 text-[color:var(--brand-secondary)]"
                      aria-hidden
                    />
                    Catégories populaires
                  </p>
                  <ul className="mt-3 flex flex-wrap justify-center gap-2">
                    {allCategories.slice(0, 8).map((cat) => (
                      <li key={cat.slug}>
                        <Link
                          href={`/categories/${cat.slug}`}
                          className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:border-[color:var(--brand-secondary)] hover:bg-[color:var(--brand-secondary)]/5"
                        >
                          {cat.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
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

                    {/* Trust signals — pattern Udemy : rassure juste avant le clic
                        final. SSL + garantie remboursement = baisse drop-off. */}
                    <ul className="space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <ShieldCheck
                          className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-success)]"
                          aria-hidden
                        />
                        <span>
                          <strong className="text-foreground">
                            Garantie satisfait ou remboursé 30 jours
                          </strong>{" "}
                          — sans poser de question.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Lock
                          className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-secondary)]"
                          aria-hidden
                        />
                        <span>
                          <strong className="text-foreground">Paiement sécurisé SSL</strong>{" "}
                          — Stripe + CinetPay (PCI-DSS), aucune carte stockée chez Gandal.
                        </span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </aside>
            </div>
          )}

          {/* Cross-sell : "Vous pourriez aimer aussi" — affiché uniquement
              quand le panier n'est pas vide ET qu'on a au moins 1 reco. */}
          {items.length > 0 && crossSell.length > 0 ? (
            <section aria-labelledby="cross-sell" className="pt-4">
              <h2
                id="cross-sell"
                className="text-xl font-semibold tracking-tight text-foreground"
              >
                Vous pourriez aimer aussi
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                D&apos;autres cours dans les mêmes thématiques que votre panier.
              </p>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {crossSell.map((course, idx) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    currency={currency}
                    hideFlyout
                    flyoutSide={idx % 4 === 3 ? "left" : "right"}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
