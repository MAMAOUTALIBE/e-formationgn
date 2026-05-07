import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ExternalLink } from "lucide-react";

import { auth } from "@/auth";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { formatPriceFromCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Confirmation de commande",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session_id?: string }>;
}

export default async function OrderConfirmationPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          course: { select: { id: true, slug: true, title: true, thumbnailUrl: true } },
        },
      },
    },
  });

  if (!order || order.userId !== session.user.id) notFound();

  const isPaid = order.status === "PAID";
  const isPending = order.status === "PENDING" || order.status === "PROCESSING";

  return (
    <>
      <SiteHeader />

      <main className="flex-1 bg-muted/20 py-12">
        <Container className="max-w-3xl space-y-6">
          {isPaid ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
                <CheckCircle2
                  className="h-12 w-12 text-[color:var(--brand-success)]"
                  aria-hidden
                />
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Merci pour votre commande
                </h1>
                <p className="max-w-lg text-sm text-muted-foreground">
                  Votre paiement de{" "}
                  <strong className="text-foreground">
                    {formatPriceFromCents(order.totalCents, order.currency)}
                  </strong>{" "}
                  a bien été enregistré. Vous avez maintenant accès à vos cours
                  dans <em>Mon apprentissage</em>.
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  <Button asChild size="lg">
                    <Link href="/apprentissage">Accéder à mes cours</Link>
                  </Button>
                  {order.stripeReceiptUrl ? (
                    <Button asChild variant="outline">
                      <Link
                        href={order.stripeReceiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Reçu Stripe
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : isPending ? (
            <Alert variant="info">
              <AlertDescription>
                Votre paiement est en cours de validation. Cette page se mettra
                à jour automatiquement dans quelques instants ; vous pouvez
                aussi rafraîchir manuellement.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertDescription>
                Votre paiement n&apos;a pas pu être finalisé. Si vous pensez
                qu&apos;il s&apos;agit d&apos;une erreur, contactez le support.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Détail de la commande</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="divide-y divide-border">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-4 py-3">
                    <div className="aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                      {item.course.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.course.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/cours/${item.course.slug}`}
                        className="text-sm font-medium text-foreground hover:underline"
                      >
                        {item.course.title}
                      </Link>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {formatPriceFromCents(item.totalCents, item.currency)}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="border-t border-border pt-4 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Sous-total</span>
                  <span>{formatPriceFromCents(order.subtotalCents, order.currency)}</span>
                </div>
                {order.discountCents > 0 ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Remise</span>
                    <span>
                      − {formatPriceFromCents(order.discountCents, order.currency)}
                    </span>
                  </div>
                ) : null}
                <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold text-foreground">
                  <span>Total payé</span>
                  <span>{formatPriceFromCents(order.totalCents, order.currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
