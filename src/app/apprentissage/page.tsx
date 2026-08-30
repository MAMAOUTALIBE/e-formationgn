import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Award, BookOpen, CheckCircle2, CircleDashed, PlayCircle, Sparkles } from "lucide-react";

import { auth } from "@/auth";
import {
  EnrollmentCard,
  WishlistCard,
} from "@/components/features/learning/enrollment-card";
import {
  LearningFilterTabs,
  type LearningFilter,
} from "@/components/features/learning/learning-filter-tabs";
import { VirtualClassCard } from "@/components/features/virtual-classes/virtual-class-card";
import { AccountShell } from "@/components/features/workspace/account-shell";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { pluralize } from "@/lib/format/labels";
import { prisma } from "@/lib/prisma";
import { listStudentVirtualClasses } from "@/server/queries/virtual-classes";

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
  const [enrollments, wishlistItems, virtualClasses] = await Promise.all([
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
    listStudentVirtualClasses(userId),
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
  const notStartedCount = Math.max(0, counts.all - counts["in-progress"] - counts.completed);
  const firstName = (session.user.name ?? "").trim().split(" ")[0] || null;
  const nextVirtualClass = virtualClasses.find(
    (item) =>
      item.registrationStatus === "ACTIVE" &&
      ["SCHEDULED", "OPEN", "LIVE"].includes(item.status),
  );

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

          <header className="relative overflow-hidden rounded-2xl border border-[color:var(--brand-secondary)]/20 bg-gradient-to-br from-[color:var(--brand-primary)]/8 via-card to-[color:var(--brand-accent)]/10 p-5 shadow-sm sm:p-7">
            <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[.12em] text-[color:var(--brand-secondary)] dark:text-blue-300"><Sparkles className="h-3.5 w-3.5" aria-hidden /> Votre parcours</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {firstName ? `${firstName}, poursuivez votre progression` : "Mon apprentissage"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {counts.all.toLocaleString("fr-FR")}{" "}
              {pluralize(counts.all, "formation suivie", "formations suivies")}
              {counts["in-progress"] > 0 ? ` · ${counts["in-progress"]} en cours` : ""}
              {counts.completed > 0
                ? ` · ${counts.completed} terminé${counts.completed > 1 ? "s" : ""}`
                : ""}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" aria-label="Résumé de mon apprentissage">
              <LearningStat icon={<BookOpen />} label="Formations" value={counts.all} tone="primary" />
              <LearningStat icon={<CircleDashed />} label="À commencer" value={notStartedCount} tone="neutral" />
              <LearningStat icon={<PlayCircle />} label="En cours" value={counts["in-progress"]} tone="accent" />
              <LearningStat icon={<CheckCircle2 />} label="Terminées" value={counts.completed} tone="success" />
            </div>
          </header>

          {nextVirtualClass ? (
            <section aria-labelledby="next-live-class-title">
              <h2 id="next-live-class-title" className="mb-3 text-lg font-semibold">
                Prochain cours en direct
              </h2>
              <VirtualClassCard
                item={nextVirtualClass}
                detailHref={`/classes-virtuelles/${nextVirtualClass.id}`}
                joinHref={
                  ["OPEN", "LIVE"].includes(nextVirtualClass.status)
                    ? `/classes-virtuelles/${nextVirtualClass.id}/verification`
                    : undefined
                }
              />
            </section>
          ) : null}

          <LearningFilterTabs active={activeFilter} counts={counts} />

          {/* Cours (Tous / En cours / Terminés) */}
          {activeFilter !== "wishlist" ? (
            visibleEnrollments.length === 0 ? (
              <EmptyState
                tone="brand"
                icon={activeFilter === "completed" ? <Award className="h-6 w-6" /> : <BookOpen className="h-6 w-6" />}
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
                tone="brand"
                icon={<Sparkles className="h-6 w-6" />}
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
            <Card className="border-dashed border-[color:var(--brand-accent)]/35 bg-[color:var(--brand-accent)]/5">
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

function LearningStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "primary" | "neutral" | "accent" | "success" }) {
  const colors = {
    primary: "bg-[color:var(--brand-primary)]/10 text-[color:var(--brand-primary)] dark:text-blue-300",
    neutral: "bg-muted text-muted-foreground",
    accent: "bg-[color:var(--brand-accent)]/10 text-[color:var(--brand-accent)]",
    success: "bg-[color:var(--brand-success)]/10 text-[color:var(--brand-success)]",
  };
  return <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-background/80 p-3 shadow-sm">
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&_svg]:h-4 [&_svg]:w-4 ${colors[tone]}`} aria-hidden>{icon}</span>
    <span><strong className="block text-lg leading-none tabular-nums text-foreground">{value}</strong><span className="mt-1 block text-[10px] text-muted-foreground sm:text-xs">{label}</span></span>
  </div>;
}
