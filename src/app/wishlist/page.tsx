import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CourseCard } from "@/components/features/courses/course-card";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { getCurrentCurrency } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { serializeCourseListItem } from "@/server/queries/courses";

export const metadata: Metadata = {
  title: "Liste de souhaits",
};

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/wishlist");

  const items = await prisma.wishlistItem.findMany({
    where: { userId: session.user.id },
    include: {
      course: {
        include: {
          instructor: {
            select: { id: true, name: true, firstName: true, lastName: true, headline: true, image: true },
          },
          category: { select: { id: true, slug: true, name: true } },
        },
      },
    },
    orderBy: { addedAt: "desc" },
  });

  const currency = await getCurrentCurrency(session.user.preferredCurrency);

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-muted/20 py-8">
        <Container className="space-y-6">
          <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Liste de souhaits" }]} />

          <header>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Liste de souhaits
            </h1>
            <p className="text-sm text-muted-foreground">
              {items.length.toLocaleString("fr-FR")} cours
            </p>
          </header>

          {items.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <p className="text-base font-medium text-foreground">
                  Votre liste de souhaits est vide.
                </p>
                <Button asChild>
                  <Link href="/cours">Explorer le catalogue</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <CourseCard
                  key={item.id}
                  course={serializeCourseListItem(item.course)}
                  currency={currency}
                />
              ))}
            </div>
          )}
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
