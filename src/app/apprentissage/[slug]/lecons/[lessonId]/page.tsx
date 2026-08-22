import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Download, FileText, FileVideo } from "lucide-react";

import { auth } from "@/auth";
import { CourseAnnouncements } from "@/components/features/learning/course-announcements";
import { CourseCompleteBanner } from "@/components/features/learning/course-complete-banner";
import {
  FocusModeProvider,
  FocusModeToggle,
} from "@/components/features/learning/focus-mode-provider";
import { LearningHeader } from "@/components/features/learning/learning-header";
import { LearningSidebar } from "@/components/features/learning/learning-sidebar";
import { LearningSidebarPanel } from "@/components/features/learning/learning-sidebar-panel";
import { LearningTabs } from "@/components/features/learning/learning-tabs";
import { LessonBookmarkButton } from "@/components/features/learning/lesson-bookmark-button";
import { LessonCompletionToggle } from "@/components/features/learning/lesson-completion-toggle";
import { LessonNotes } from "@/components/features/learning/lesson-notes";
import { LessonPlayer } from "@/components/features/learning/lesson-player";
import { MarkdownContent } from "@/components/features/learning/markdown-content";
import { LessonReader } from "@/components/features/learning/lesson-reader";
import { LessonResourceStage } from "@/components/features/learning/lesson-resource-stage";
import { LearningActivityHeartbeat } from "@/components/features/learning/use-learning-heartbeat";
import { LessonQuestions } from "@/components/features/learning/lesson-questions";
import { signMuxPlaybackToken } from "@/lib/mux";
import { estimateReadingMinutes } from "@/lib/markdown";
import {
  formatFileSize,
  isVideoResource,
  lessonResourceHref,
} from "@/lib/resource-file";
import { LessonTutor } from "@/components/features/learning/lesson-tutor";
import { QuizAttempt } from "@/components/features/learning/quiz-attempt";
import { CourseReviewsList } from "@/components/features/courses/course-reviews-list";
import { ReviewForm } from "@/components/features/reviews/review-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getCourseReviewsForLearner,
  getLearningCourse,
  getLessonNotes,
  getLessonProgress,
  getMyReviewForCourse,
  getQuizForLearner,
  isLessonBookmarked,
  listCourseAnnouncements,
  listLessonQuestions,
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

  const flatLessons = course.sections.flatMap((s) =>
    s.lessons.map((l) => ({ ...l, sectionId: s.id })),
  );
  const lessonIndex = flatLessons.findIndex((l) => l.id === lessonId);
  if (lessonIndex === -1) notFound();
  const lesson = flatLessons[lessonIndex];
  const previous = flatLessons[lessonIndex - 1] ?? null;
  const next = flatLessons[lessonIndex + 1] ?? null;

  const [
    progressList,
    notes,
    quiz,
    bookmarked,
    announcements,
    reviewsBundle,
    myReview,
    lessonQuestions,
  ] = await Promise.all([
    getLessonProgress(session.user.id, course.id),
    getLessonNotes(session.user.id, lessonId),
    lesson.type === "QUIZ"
      ? (async () => {
          const quizRecord = await import("@/lib/prisma").then(({ prisma }) =>
            prisma.quiz.findUnique({ where: { lessonId } }),
          );
          return quizRecord ? getQuizForLearner(quizRecord.id, session.user.id) : null;
        })()
      : Promise.resolve(null),
    isLessonBookmarked(session.user.id, lessonId),
    listCourseAnnouncements(course.id),
    getCourseReviewsForLearner(course.id, 20),
    getMyReviewForCourse(session.user.id, course.id),
    listLessonQuestions(session.user.id, course.id, lessonId),
  ]);
  const completedIds = new Set(
    progressList.filter((p) => p.isCompleted).map((p) => p.lessonId),
  );
  const lessonProgress = progressList.find((p) => p.lessonId === lessonId);

  const totalLessons = flatLessons.length;
  const completedLessons = flatLessons.filter((l) => completedIds.has(l.id)).length;
  const progressPercent =
    totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

  // --- Onglets sous le player ------------------------------------------------
  const presentationContent = (
    <div className="space-y-6">
      {lesson.description ? (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            À propos de cette leçon
          </h2>
          <p className="text-sm text-foreground">{lesson.description}</p>
        </div>
      ) : null}

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

      {/* Le texte d'une leçon TEXTE occupe désormais la scène : le répéter ici
          ferait lire deux fois la même chose. Il reste affiché pour les autres
          types, où il joue le rôle de complément écrit à la vidéo ou au quiz. */}
      {lesson.textContent && lesson.type !== "TEXT" ? (
        <MarkdownContent source={lesson.textContent} />
      ) : null}

      {!lesson.description &&
      !lesson.aiSummary &&
      (!lesson.textContent || lesson.type === "TEXT") ? (
        <p className="text-sm text-muted-foreground">
          {lesson.type === "TEXT"
            ? "Le contenu de cette leçon se lit ci-dessus."
            : "Pas de description disponible pour cette leçon."}
        </p>
      ) : null}
    </div>
  );

  const notesContent = <LessonNotes lessonId={lesson.id} initialNotes={notes} />;
  const announcementsContent = <CourseAnnouncements announcements={announcements} />;

  const reviewsContent = (
    <div className="space-y-8">
      <CourseReviewsList
        reviews={reviewsBundle.reviews}
        averageRating={reviewsBundle.averageRating}
        totalRatings={reviewsBundle.totalRatings}
      />
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          {myReview ? "Modifier votre avis" : "Donnez votre avis"}
        </h3>
        <ReviewForm
          courseId={course.id}
          initial={
            myReview
              ? {
                  rating: myReview.rating,
                  title: myReview.title ?? "",
                  comment: myReview.comment ?? "",
                }
              : undefined
          }
        />
      </div>
    </div>
  );

  // Deux sources cohabitent : les pièces jointes téléversées par le formateur
  // (`lesson.resources`) et l'unique lien historique porté par la leçon
  // (`resourceUrl`), conservé pour les cours créés avant l'upload de fichiers.
  const hasResources = lesson.resources.length > 0 || Boolean(lesson.resourceUrl);

  const resourcesContent = hasResources ? (
    <div className="space-y-4">
      {lesson.resources.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {lesson.resources.map((resource) => (
            <li key={resource.id} className="flex items-center gap-3 px-3 py-3">
              {isVideoResource(resource.url, "") ? (
                <FileVideo className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {resource.title}
                </p>
                {resource.fileSizeBytes ? (
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(resource.fileSizeBytes)}
                  </p>
                ) : null}
              </div>
              <Button asChild variant="outline" size="sm">
                <Link
                  href={lessonResourceHref(lesson.id, resource.id, true)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="h-4 w-4" />
                  Télécharger
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {lesson.resourceUrl ? (
        <Button asChild>
          <Link href={lesson.resourceUrl} target="_blank" rel="noopener noreferrer">
            <Download className="h-4 w-4" />
            {lesson.resourceFileName ?? "Télécharger"}
          </Link>
        </Button>
      ) : null}
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">
      Aucune ressource attachée à cette leçon.
    </p>
  );

  const tabs = [
    { key: "presentation", label: "Présentation", content: presentationContent },
    { key: "notes", label: "Mes notes", content: notesContent },
    {
      key: "questions",
      label: "Questions",
      badge: lessonQuestions.length > 0 ? lessonQuestions.length : undefined,
      content: (
        <LessonQuestions
          courseId={course.id}
          lessonId={lesson.id}
          instructorId={course.instructorId}
          questions={lessonQuestions}
        />
      ),
    },
    {
      key: "announcements",
      label: "Annonces",
      badge: announcements.length > 0 ? announcements.length : undefined,
      content: announcementsContent,
    },
    {
      key: "reviews",
      label: "Évaluations",
      badge: reviewsBundle.totalRatings > 0 ? reviewsBundle.totalRatings : undefined,
      content: reviewsContent,
    },
    {
      key: "resources",
      label: "Ressources",
      badge: lesson.resources.length > 0 ? lesson.resources.length : undefined,
      content: resourcesContent,
    },
  ];

  return (
    <FocusModeProvider>
      {lesson.type !== "VIDEO" ? <LearningActivityHeartbeat lessonId={lesson.id} /> : null}
      <LearningHeader
        courseSlug={course.slug}
        courseTitle={course.title}
        progressPercent={progressPercent}
        rightSlot={<FocusModeToggle />}
      />

      <main className="flex-1 bg-muted/20">
        <div
          data-learning-grid
          className="mx-auto grid w-full max-w-[1600px] grid-cols-[minmax(0,1fr)] gap-0 lg:grid-cols-[minmax(0,1fr)_360px]"
        >
          {/* ── Colonne principale : player + tabs ───────────────────── */}
          <section className="order-1 min-w-0 bg-card">
            {progressPercent === 100 ? (
              <div className="px-4 pt-4 sm:px-6">
                <CourseCompleteBanner courseId={course.id} />
              </div>
            ) : null}
            <div className={lesson.type === "VIDEO" ? "bg-black" : "bg-card"}>
              <div className="mx-auto w-full max-w-[1280px]">
                {lesson.type === "VIDEO" ? (
                  lesson.muxPlaybackId || lesson.externalVideoUrl ? (
                    <LessonPlayer
                      key={lesson.id}
                      playbackId={lesson.muxPlaybackId}
                      playbackToken={
                        lesson.muxPlaybackId
                          ? signMuxPlaybackToken({
                              playbackId: lesson.muxPlaybackId,
                              expiresInSeconds: 60 * 60,
                              subject: session.user.id,
                            })
                          : null
                      }
                      externalVideoUrl={lesson.externalVideoUrl}
                      lessonId={lesson.id}
                      initialPositionSeconds={lessonProgress?.lastPositionSeconds ?? 0}
                      durationSeconds={lesson.videoDurationSeconds}
                      title={lesson.title}
                      nextLessonHref={
                        next
                          ? `/apprentissage/${course.slug}/lecons/${next.id}`
                          : null
                      }
                      nextLessonTitle={next?.title ?? null}
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-black/90 px-6 text-center text-sm text-muted-foreground">
                      Cette leçon vidéo n&apos;a pas encore été uploadée par le formateur.
                    </div>
                  )
                ) : null}

                {lesson.type === "QUIZ" ? (
                  <div className="bg-muted/40 p-6">
                    {quiz && quiz.questions.length > 0 ? (
                      <QuizAttempt
                        quizId={quiz.id}
                        passingScore={quiz.passingScore}
                        maxAttempts={quiz.maxAttempts}
                        initialAttemptSummary={quiz.attemptSummary}
                        initialHistory={quiz.attempts.map((attempt) => ({
                          ...attempt,
                          completedAt: attempt.completedAt!.toISOString(),
                        }))}
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
                    )}
                  </div>
                ) : null}

                {lesson.type === "TEXT" ? (
                  lesson.textContent ? (
                    <LessonReader
                      key={lesson.id}
                      lessonId={lesson.id}
                      alreadyCompleted={completedIds.has(lesson.id)}
                      content={lesson.textContent}
                      readingMinutes={estimateReadingMinutes(lesson.textContent)}
                      nextLessonHref={
                        next ? `/apprentissage/${course.slug}/lecons/${next.id}` : null
                      }
                      nextLessonTitle={next?.title ?? null}
                    />
                  ) : (
                    <div className="flex min-h-[40vh] items-center justify-center bg-card p-6 text-sm text-muted-foreground">
                      Le formateur n&apos;a pas encore rédigé le contenu de cette leçon.
                    </div>
                  )
                ) : null}

                {lesson.type === "RESOURCE" ? (
                  <LessonResourceStage
                    key={lesson.id}
                    lessonId={lesson.id}
                    resources={lesson.resources.map((resource) => ({
                      id: resource.id,
                      title: resource.title,
                      url: resource.url,
                      fileSizeBytes: resource.fileSizeBytes,
                    }))}
                    legacyUrl={lesson.resourceUrl}
                    legacyFileName={lesson.resourceFileName}
                  />
                ) : null}
              </div>
            </div>

            {/* Barre titre + nav + bookmark + complétion */}
            <div className="border-b border-border bg-card px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="min-w-0 truncate text-base font-semibold text-foreground sm:text-lg">
                  {lesson.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  {previous ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/apprentissage/${course.slug}/lecons/${previous.id}`}>
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Précédente</span>
                      </Link>
                    </Button>
                  ) : null}
                  {next ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/apprentissage/${course.slug}/lecons/${next.id}`}>
                        <span className="hidden sm:inline">Suivante</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                  <LessonBookmarkButton
                    lessonId={lesson.id}
                    initialBookmarked={bookmarked}
                  />
                  <LessonCompletionToggle
                    lessonId={lesson.id}
                    initialCompleted={completedIds.has(lesson.id)}
                  />
                </div>
              </div>
            </div>

            <div className="px-4 py-4 sm:px-6">
              <LearningTabs tabs={tabs} />
            </div>
          </section>

          {/* ── Colonne curriculum (cachée en mode focus) ───────────── */}
          <aside
            data-learning-sidebar
            aria-label="Programme de la formation"
            className="order-2 border-l border-border bg-card lg:sticky lg:top-14 lg:max-h-[calc(100vh-3.5rem)] lg:overflow-y-auto"
          >
            <LearningSidebarPanel
              header={
                <div className="border-b border-border bg-muted/40 px-4 py-3">
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {completedLessons} / {totalLessons} leçon
                    {totalLessons > 1 ? "s" : ""} · {progressPercent} %
                  </p>
                </div>
              }
              curriculum={
                <LearningSidebar
                  courseSlug={course.slug}
                  sections={course.sections.map((s) => ({
                    id: s.id,
                    title: s.title,
                    lessons: s.lessons.map((l) => ({
                      id: l.id,
                      title: l.title,
                      type: l.type,
                      videoDurationSeconds: l.videoDurationSeconds,
                      hasResource: Boolean(l.resourceUrl),
                    })),
                  }))}
                  completedLessonIds={completedIds}
                  currentLessonId={lesson.id}
                />
              }
              tutor={<LessonTutor lessonId={lesson.id} />}
            />
          </aside>
        </div>
      </main>
    </FocusModeProvider>
  );
}
