import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { pluralize } from "@/lib/format/labels";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Mon apprentissage",
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function LearningPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion?callbackUrl=/apprentissage");
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id },
    include: {
      course: {
        select: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          thumbnailUrl: true,
          durationSeconds: true,
          instructor: {
            select: { id: true, name: true, firstName: true, lastName: true },
          },
        },
      },
    },
    orderBy: [{ enrolledAt: "desc" }],
  });

  return (
    <>
      <SiteHeader />

      <main className="flex-1 bg-muted/20 py-8">
        <Container className="space-y-6">
          <Breadcrumbs
            items={[{ label: "Accueil", href: "/" }, { label: "Mon apprentissage" }]}
          />

          <header>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Mon apprentissage
            </h1>
            <p className="text-sm text-muted-foreground">
              {enrollments.length.toLocaleString("fr-FR")}{" "}
              {pluralize(enrollments.length, "cours suivi", "cours suivis")}
            </p>
          </header>

          {enrollments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <p className="text-base font-medium text-foreground">
                  Vous n&apos;avez pas encore acheté de cours.
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Parcourez le catalogue, ajoutez des cours à votre panier et
                  retrouvez-les ici dès votre paiement validé.
                </p>
                <Button asChild>
                  <Link href="/cours">Explorer le catalogue</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {enrollments.map((enrollment) => {
                const course = enrollment.course;
                const instructorName =
                  course.instructor.name ??
                  ([course.instructor.firstName, course.instructor.lastName]
                    .filter(Boolean)
                    .join(" ") ||
                    "Formateur");
                return (
                  <Card key={enrollment.id} className="overflow-hidden">
                    <Link
                      href={`/cours/${course.slug}`}
                      className="block aspect-video overflow-hidden bg-muted"
                    >
                      {course.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={course.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </Link>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="success">Inscrit</Badge>
                        <span>
                          le {dateFormatter.format(enrollment.enrolledAt)}
                        </span>
                      </div>
                      <Link
                        href={`/cours/${course.slug}`}
                        className="line-clamp-2 text-sm font-semibold text-foreground hover:underline"
                      >
                        {course.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">Par {instructorName}</p>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Progression</span>
                          <span className="font-medium text-foreground">
                            {Math.round(enrollment.progressPercent)}%
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-[color:var(--brand-secondary)] transition-all"
                            style={{ width: `${Math.min(100, enrollment.progressPercent)}%` }}
                          />
                        </div>
                      </div>
                      <Button asChild className="w-full" variant="outline">
                        <Link href={`/apprentissage/${course.slug}`}>
                          {enrollment.progressPercent > 0 ? "Reprendre" : "Commencer"}
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
