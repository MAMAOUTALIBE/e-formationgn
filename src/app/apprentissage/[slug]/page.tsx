import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Award, BookOpenText } from "lucide-react";

import { auth } from "@/auth";
import { LessonSidebar } from "@/components/features/learning/lesson-sidebar";
import { AccountShell } from "@/components/features/workspace/account-shell";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import {
  computeCourseProgress,
  getCertificateForUser,
  getLearningCourse,
  getLessonProgress,
} from "@/server/queries/learning";
import { issueCertificate } from "@/server/actions/certificates";

export const metadata: Metadata = {
  title: "Apprendre",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CourseLearningPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/connexion?callbackUrl=/apprentissage/${slug}`);

  const data = await getLearningCourse(session.user.id, slug);
  if (!data) {
    redirect(`/cours/${slug}`);
  }

  const { course } = data;
  const [progressList, stats, certificate] = await Promise.all([
    getLessonProgress(session.user.id, course.id),
    computeCourseProgress(session.user.id, course.id),
    getCertificateForUser(session.user.id, course.id),
  ]);
  const completedIds = new Set(
    progressList.filter((p) => p.isCompleted).map((p) => p.lessonId),
  );

  const firstLesson = course.sections[0]?.lessons[0];
  const nextLesson = findNextLesson(course.sections, completedIds);
  const completed = stats.progressPercent === 100;

  // Coquille appliquée ICI et non par un layout : un layout couvrirait
  // aussi le lecteur de leçon, qui est immersif et porte déjà sa propre
  // colonne programme.
  return (
    <AccountShell callbackUrl="/apprentissage">
      <Container className="space-y-6">
          <Breadcrumbs
            items={[
              { label: "Mon apprentissage", href: "/apprentissage" },
              { label: course.title },
            ]}
          />

          <header className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-3">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {course.title}
              </h1>
              <p className="text-sm text-muted-foreground">
                {stats.completedLessons} / {stats.totalLessons} leçons terminées
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-[color:var(--brand-secondary)] transition-all"
                  style={{ width: `${stats.progressPercent}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {nextLesson ? (
                  <Button asChild>
                    <Link href={`/apprentissage/${course.slug}/lecons/${nextLesson.id}`}>
                      <BookOpenText className="h-4 w-4" />
                      {stats.progressPercent === 0
                        ? "Commencer la formation"
                        : "Reprendre où vous en étiez"}
                    </Link>
                  </Button>
                ) : firstLesson ? (
                  <Button asChild>
                    <Link href={`/apprentissage/${course.slug}/lecons/${firstLesson.id}`}>
                      <BookOpenText className="h-4 w-4" />
                      Revoir une leçon
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Award className="h-5 w-5 text-[color:var(--brand-warning)]" />
                  Certificat
                </CardTitle>
                <CardDescription>
                  Disponible une fois toutes les leçons terminées.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {certificate ? (
                  <>
                    <Badge variant="success">Certificat émis</Badge>
                    <p className="text-xs text-muted-foreground">
                      Référence : <code>{certificate.serialNumber}</code>
                    </p>
                    <Button asChild className="w-full" variant="outline">
                      <Link href={`/api/certificats/${certificate.serialNumber}`}>
                        Télécharger le PDF
                      </Link>
                    </Button>
                  </>
                ) : completed ? (
                  <form
                    action={async () => {
                      "use server";
                      const result = await issueCertificate(course.id);
                      if (result.success && result.serialNumber) {
                        redirect(`/api/certificats/${result.serialNumber}`);
                      }
                    }}
                  >
                    <Button type="submit" className="w-full">
                      Générer mon attestation
                    </Button>
                  </form>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Encore {stats.totalLessons - stats.completedLessons} leçon(s) à
                    terminer pour débloquer l&apos;attestation.
                  </p>
                )}
              </CardContent>
            </Card>
          </header>

          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Programme</h2>
              <LessonSidebar
                courseSlug={course.slug}
                sections={course.sections.map((s) => ({
                  id: s.id,
                  title: s.title,
                  lessons: s.lessons.map((l) => ({
                    id: l.id,
                    title: l.title,
                    type: l.type,
                    videoDurationSeconds: l.videoDurationSeconds,
                  })),
                }))}
                completedLessonIds={completedIds}
                currentLessonId=""
              />
            </aside>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>À propos de la formation</CardTitle>
                </CardHeader>
                <CardContent className="prose prose-sm max-w-none whitespace-pre-line text-muted-foreground">
                  {course.description}
                </CardContent>
              </Card>
            </div>
          </div>
      </Container>
    </AccountShell>
  );
}

function findNextLesson(
  sections: Array<{
    id: string;
    lessons: Array<{ id: string; type: string }>;
  }>,
  completedIds: Set<string>,
) {
  for (const section of sections) {
    for (const lesson of section.lessons) {
      if (!completedIds.has(lesson.id)) return lesson;
    }
  }
  return null;
}
