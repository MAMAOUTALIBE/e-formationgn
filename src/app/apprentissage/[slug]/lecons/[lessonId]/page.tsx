import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Download } from "lucide-react";

import { auth } from "@/auth";
import { LessonCompletionToggle } from "@/components/features/learning/lesson-completion-toggle";
import { LessonNotes } from "@/components/features/learning/lesson-notes";
import { LessonPlayer } from "@/components/features/learning/lesson-player";
import { LessonSidebar } from "@/components/features/learning/lesson-sidebar";
import { LessonTutor } from "@/components/features/learning/lesson-tutor";
import { QuizAttempt } from "@/components/features/learning/quiz-attempt";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import {
  getLearningCourse,
  getLessonNotes,
  getLessonProgress,
  getQuizForLearner,
} from "@/server/queries/learning";

export const metadata: Metadata = {
  title: "Leçon",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string; lessonId: string }>;
}

export default async function LessonViewerPage({ params }: PageProps) {
  const { slug, lessonId } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/connexion?callbackUrl=/apprentissage/${slug}/lecons/${lessonId}`);

  const data = await getLearningCourse(session.user.id, slug);
  if (!data) redirect(`/cours/${slug}`);
  const { course } = data;

  // Trouve la leçon dans les sections
  const flatLessons = course.sections.flatMap((s) =>
    s.lessons.map((l) => ({ ...l, sectionId: s.id })),
  );
  const lessonIndex = flatLessons.findIndex((l) => l.id === lessonId);
  if (lessonIndex === -1) notFound();
  const lesson = flatLessons[lessonIndex];
  const previous = flatLessons[lessonIndex - 1] ?? null;
  const next = flatLessons[lessonIndex + 1] ?? null;

  const [progressList, notes, quiz] = await Promise.all([
    getLessonProgress(session.user.id, course.id),
    getLessonNotes(session.user.id, lessonId),
    lesson.type === "QUIZ"
      ? (async () => {
          // Trouve le quiz lié
          const quizRecord = await import("@/lib/prisma").then(({ prisma }) =>
            prisma.quiz.findUnique({ where: { lessonId } }),
          );
          return quizRecord ? getQuizForLearner(quizRecord.id) : null;
        })()
      : Promise.resolve(null),
  ]);
  const completedIds = new Set(
    progressList.filter((p) => p.isCompleted).map((p) => p.lessonId),
  );
  const lessonProgress = progressList.find((p) => p.lessonId === lessonId);

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-muted/20">
        <Container className="grid gap-6 py-6 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-lg border border-border bg-card p-4 lg:sticky lg:top-20 lg:self-start">
            <h2 className="mb-3 text-sm font-semibold text-foreground">{course.title}</h2>
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
              currentLessonId={lesson.id}
            />
          </aside>

          <div className="space-y-6">
            <Breadcrumbs
              items={[
                { label: "Mon apprentissage", href: "/apprentissage" },
                {
                  label: course.title,
                  href: `/apprentissage/${course.slug}`,
                },
                { label: lesson.title },
              ]}
            />

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {lesson.title}
              </h1>
              {lesson.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{lesson.description}</p>
              ) : null}
            </div>

            {lesson.aiSummary ? (
              <Card className="border-[color:var(--brand-secondary)]/30 bg-[color:var(--brand-secondary)]/5">
                <CardContent className="p-5">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-secondary)]">
                    <span>Résumé pédagogique</span>
                    <span className="rounded bg-background/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      IA
                    </span>
                  </div>
                  <div className="prose prose-sm max-w-none whitespace-pre-line text-foreground">
                    {lesson.aiSummary}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Contenu selon le type */}
            {lesson.type === "VIDEO" ? (
              lesson.muxPlaybackId || lesson.externalVideoUrl ? (
                <LessonPlayer
                  playbackId={lesson.muxPlaybackId}
                  externalVideoUrl={lesson.externalVideoUrl}
                  lessonId={lesson.id}
                  initialPositionSeconds={lessonProgress?.lastPositionSeconds ?? 0}
                  durationSeconds={lesson.videoDurationSeconds}
                  title={lesson.title}
                />
              ) : (
                <Alert variant="info">
                  <AlertDescription>
                    Cette leçon vidéo n&apos;a pas encore été uploadée par le formateur.
                  </AlertDescription>
                </Alert>
              )
            ) : null}

            {lesson.type === "TEXT" ? (
              <Card>
                <CardContent className="prose prose-sm max-w-none whitespace-pre-line p-6 text-foreground">
                  {lesson.textContent ?? "(Aucun contenu)"}
                </CardContent>
              </Card>
            ) : null}

            {lesson.type === "RESOURCE" ? (
              <Card>
                <CardContent className="space-y-3 p-6">
                  {lesson.resourceUrl ? (
                    <Button asChild>
                      <Link
                        href={lesson.resourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="h-4 w-4" />
                        {lesson.resourceFileName ?? "Télécharger la ressource"}
                      </Link>
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucune ressource attachée pour le moment.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {lesson.type === "QUIZ" ? (
              quiz && quiz.questions.length > 0 ? (
                <QuizAttempt
                  quizId={quiz.id}
                  passingScore={quiz.passingScore}
                  questions={quiz.questions.map((q) => ({
                    id: q.id,
                    prompt: q.prompt,
                    kind: q.kind,
                    options: q.options.map((o) => ({ id: o.id, label: o.label })),
                  }))}
                />
              ) : (
                <Alert variant="info">
                  <AlertDescription>
                    Le quiz n&apos;a pas encore de questions.
                  </AlertDescription>
                </Alert>
              )
            ) : null}

            {/* Actions de leçon */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {previous ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/apprentissage/${course.slug}/lecons/${previous.id}`}>
                      <ArrowLeft className="h-4 w-4" />
                      Précédente
                    </Link>
                  </Button>
                ) : null}
                {next ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/apprentissage/${course.slug}/lecons/${next.id}`}>
                      Suivante
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
              </div>
              <LessonCompletionToggle
                lessonId={lesson.id}
                initialCompleted={completedIds.has(lesson.id)}
              />
            </div>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mes notes</CardTitle>
              </CardHeader>
              <CardContent>
                <LessonNotes lessonId={lesson.id} initialNotes={notes} />
              </CardContent>
            </Card>

            {/* Tuteur IA */}
            <LessonTutor lessonId={lesson.id} />
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
