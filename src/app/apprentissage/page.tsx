import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  EnrollmentCard,
  WishlistCard,
} from "@/components/features/learning/enrollment-card";
import {
  LearningFilterTabs,
  type LearningFilter,
} from "@/components/features/learning/learning-filter-tabs";
import { AccountShell } from "@/components/features/workspace/account-shell";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { pluralize } from "@/lib/format/labels";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Mon apprentissage",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

const VALID_FILTERS = new Set<LearningFilter>([
  "all",
  "in-progress",
  "completed",
  "wishlist",
]);

function parseFilter(value: string | undefined): LearningFilter {
  if (value && (VALID_FILTERS as Set<string>).has(value)) {
    return value as LearningFilter;
  }
  return "all";
}

export default async function LearningPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion?callbackUrl=/apprentissage");
  }

  const params = await searchParams;
  const activeFilter = parseFilter(params.filter);
  const userId = session.user.id;

  // Toutes les données en parallèle. Les enrollments servent aussi à
  // calculer les compteurs des tabs (Tous / En cours / Terminés).
  const [enrollments, wishlistItems] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            slug: true,
            title: true,
            thumbnailUrl: true,
            sections: {
              orderBy: { displayOrder: "asc" },
              select: {
                lessons: {
                  orderBy: { displayOrder: "asc" },
                  select: { id: true },
                },
              },
            },
            instructor: {
              select: { name: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: [{ lastAccessedAt: "desc" }, { enrolledAt: "desc" }],
    }),
    prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            slug: true,
            title: true,
            thumbnailUrl: true,
            instructor: {
              select: { name: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { addedAt: "desc" },
    }),
  ]);

  // Pour le bouton « Reprendre », on charge la dernière LessonProgress
  // actualisée par enrollment (la leçon où l'élève s'est arrêté).
  const lastProgressBySlug = new Map<string, string>();
  if (enrollments.length > 0) {
    const lastProgress = await prisma.lessonProgress.findMany({
      where: {
        userId,
        lesson: {
          section: { courseId: { in: enrollments.map((e) => e.courseId) } },
        },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        lessonId: true,
        lesson: {
          select: { section: { select: { course: { select: { slug: true } } } } },
        },
      },
      take: enrollments.length * 5, // marge — on garde la 1re par cours
    });
    for (const p of lastProgress) {
      const slug = p.lesson.section.course.slug;
      if (!lastProgressBySlug.has(slug)) {
        lastProgressBySlug.set(slug, p.lessonId);
      }
    }
  }

  // Buckets pour les filtres + compteurs.
  const inProgress = enrollments.filter(
    (e) => e.progressPercent > 0 && e.progressPercent < 100 && e.completedAt === null,
  );
  const completed = enrollments.filter(
    (e) => e.completedAt !== null || e.progressPercent >= 100,
  );
  const counts: Record<LearningFilter, number> = {
    all: enrollments.length,
    "in-progress": inProgress.length,
    completed: completed.length,
    wishlist: wishlistItems.length,
  };

  const visibleEnrollments =
    activeFilter === "all"
      ? enrollments
      : activeFilter === "in-progress"
        ? inProgress
        : activeFilter === "completed"
          ? completed
          : []; // wishlist gérée séparément

  // Coquille appliquée ICI et non par un layout : un layout couvrirait
  // aussi le lecteur de leçon, qui est immersif et porte déjà sa propre
  // colonne programme.
  return (
    <AccountShell callbackUrl="/apprentissage">
      <Container className="space-y-6">
          <Breadcrumbs
            items={[{ label: "Accueil", href: "/" }, { label: "Mon apprentissage" }]}
          />

          <header>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Mon apprentissage
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {counts.all.toLocaleString("fr-FR")}{" "}
              {pluralize(counts.all, "formation suivie", "formations suivies")}
              {counts["in-progress"] > 0 ? ` · ${counts["in-progress"]} en cours` : ""}
              {counts.completed > 0
                ? ` · ${counts.completed} terminé${counts.completed > 1 ? "s" : ""}`
                : ""}
            </p>
          </header>

          <LearningFilterTabs active={activeFilter} counts={counts} />

          {/* Cours (Tous / En cours / Terminés) */}
          {activeFilter !== "wishlist" ? (
            visibleEnrollments.length === 0 ? (
              <EmptyState
                title={
                  activeFilter === "in-progress"
                    ? "Aucune formation en cours."
                    : activeFilter === "completed"
                      ? "Vous n'avez encore terminé aucune formation."
                      : "Vous n'avez pas encore acheté de formation."
                }
                description={
                  activeFilter === "in-progress"
                    ? "Reprenez une formation dans « Toutes mes formations » ou démarrez-en une nouvelle."
                    : activeFilter === "completed"
                      ? "Terminez les leçons d'une formation en cours pour la voir apparaître ici."
                      : "Parcourez le catalogue et achetez une formation pour la retrouver ici."
                }
                action={
                  <Button asChild>
                    <Link href="/cours">Explorer le catalogue</Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {visibleEnrollments.map((enrollment) => {
                  const slug = enrollment.course.slug;
                  const lastLessonId = lastProgressBySlug.get(slug);
                  const firstLessonId =
                    enrollment.course.sections[0]?.lessons[0]?.id;
                  const resumeHref = lastLessonId
                    ? `/apprentissage/${slug}/lecons/${lastLessonId}`
                    : firstLessonId
                      ? `/apprentissage/${slug}/lecons/${firstLessonId}`
                      : `/apprentissage/${slug}`;
                  return (
                    <EnrollmentCard
                      key={enrollment.id}
                      enrollment={{
                        id: enrollment.id,
                        enrolledAt: enrollment.enrolledAt,
                        progressPercent: enrollment.progressPercent,
                        completedAt: enrollment.completedAt,
                        course: enrollment.course,
                      }}
                      resumeHref={resumeHref}
                    />
                  );
                })}
              </div>
            )
          ) : null}

          {/* Wishlist */}
          {activeFilter === "wishlist" ? (
            wishlistItems.length === 0 ? (
              <EmptyState
                title="Votre liste d'envies est vide."
                description="Ajoutez des formations via le bouton ♥ sur leur page pour les retrouver ici."
                action={
                  <Button asChild>
                    <Link href="/cours">Explorer le catalogue</Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {wishlistItems.map((item) => (
                  <WishlistCard
                    key={item.id}
                    course={item.course}
                    addedAt={item.addedAt}
                  />
                ))}
              </div>
            )
          ) : null}

          {/* Encart « Continuer à explorer » : visible uniquement quand
              l'élève a déjà au moins 1 cours, pour le pousser à compléter
              son apprentissage avec le catalogue. */}
          {counts.all > 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Vous cherchez une nouvelle formation ?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Le catalogue est mis à jour chaque semaine avec de nouvelles formations.
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href="/cours">Parcourir le catalogue →</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
      </Container>
    </AccountShell>
  );
}
