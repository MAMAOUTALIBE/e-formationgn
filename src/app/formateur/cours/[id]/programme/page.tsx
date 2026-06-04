import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, FileText, HelpCircle, Paperclip, PenLine, PlayCircle, Trash2 } from "lucide-react";

import { auth } from "@/auth";
import { ConfirmAction } from "@/components/features/instructor/confirm-action";
import { LessonCreateForm } from "@/components/features/instructor/lesson-create-form";
import { SectionCreateForm } from "@/components/features/instructor/section-create-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDurationFromSeconds,
  formatLessonDuration,
} from "@/lib/format/duration";
import { pluralize } from "@/lib/format/labels";
import {
  deleteSection,
  duplicateLesson,
  duplicateSection,
} from "@/server/actions/curriculum";
import { getInstructorCourse } from "@/server/queries/instructor";
import type { LessonType } from "@/generated/prisma/enums";

import { assertStepUnlocked } from "../_components/wizard-state";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseProgramPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const course = await getInstructorCourse(
    id,
    session.user.id,
    session.user.role === "ADMIN",
  );
  if (!course) notFound();

  // Mode strict : accès verrouillé tant que « Général » n'est pas complet.
  await assertStepUnlocked(id, 1);

  const totalLessons = course.sections.reduce(
    (acc, section) => acc + section.lessons.length,
    0,
  );
  const totalSeconds = course.sections.reduce(
    (acc, section) =>
      acc +
      section.lessons.reduce((s, l) => s + (l.videoDurationSeconds ?? 0), 0),
    0,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Programme</CardTitle>
          <CardDescription>
            {course.sections.length} {pluralize(course.sections.length, "section")} ·{" "}
            {totalLessons} {pluralize(totalLessons, "leçon")} ·{" "}
            <span className="font-medium text-foreground">
              {formatDurationFromSeconds(totalSeconds)}
            </span>{" "}
            au total
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {course.sections.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
              Aucune section pour le moment. Ajoutez la première ci-dessous.
            </p>
          ) : (
            <ul className="space-y-6">
              {course.sections.map((section, sectionIndex) => (
                <li
                  key={section.id}
                  className="space-y-3 rounded-lg border border-border bg-card p-4"
                >
                  <header className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Section {sectionIndex + 1}
                      </p>
                      <h3 className="text-base font-semibold text-foreground">
                        {section.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1">
                      <form action={duplicateSection.bind(null, section.id)}>
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          title="Dupliquer la section et ses leçons"
                        >
                          <Copy className="h-4 w-4" />
                          Dupliquer
                        </Button>
                      </form>
                      <ConfirmAction
                        variant="ghost"
                        size="sm"
                        message={`Supprimer la section « ${section.title} » et toutes ses leçons ?`}
                        onConfirm={async () => {
                          "use server";
                          await deleteSection(section.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Supprimer la section
                      </ConfirmAction>
                    </div>
                  </header>

                  {section.lessons.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-center text-sm text-muted-foreground">
                      Aucune leçon pour le moment.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {section.lessons.map((lesson, lessonIndex) => (
                        <li
                          key={lesson.id}
                          className="flex items-center justify-between gap-4 px-3 py-2.5"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              {lessonIndex + 1}.
                            </span>
                            <LessonIcon type={lesson.type} />
                            <span className="truncate text-sm text-foreground">
                              {lesson.title}
                            </span>
                            {lesson.isFreePreview ? (
                              <span className="ml-1 inline-flex items-center rounded bg-[color:var(--brand-success)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--brand-success)]">
                                Aperçu
                              </span>
                            ) : null}
                            {lesson.type === "VIDEO" ? (
                              lesson.muxPlaybackId || lesson.externalVideoUrl ? (
                                <span className="ml-1 inline-flex items-center rounded bg-[color:var(--brand-accent)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--brand-accent)]">
                                  Vidéo prête
                                </span>
                              ) : (
                                <span className="ml-1 inline-flex items-center rounded bg-[color:var(--brand-warning)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--brand-warning)]">
                                  Vidéo manquante
                                </span>
                              )
                            ) : null}
                          </span>
                          <span className="flex items-center gap-3 text-xs text-muted-foreground">
                            {lesson.type === "VIDEO" &&
                            lesson.videoDurationSeconds > 0
                              ? formatLessonDuration(lesson.videoDurationSeconds)
                              : null}
                            <Button asChild variant="link" size="sm" className="h-auto px-0">
                              <Link
                                href={`/formateur/cours/${course.id}/lecons/${lesson.id}`}
                              >
                                <PenLine className="h-3.5 w-3.5" />
                                Modifier
                              </Link>
                            </Button>
                            <form action={duplicateLesson.bind(null, lesson.id)}>
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                className="h-auto px-1"
                                title="Dupliquer la leçon"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                <span className="sr-only">Dupliquer</span>
                              </Button>
                            </form>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <LessonCreateForm sectionId={section.id} />
                </li>
              ))}
            </ul>
          )}

          <SectionCreateForm courseId={course.id} />
        </CardContent>
      </Card>
    </div>
  );
}

function LessonIcon({ type }: { type: LessonType }) {
  const className = "h-4 w-4 text-muted-foreground";
  switch (type) {
    case "VIDEO":
      return <PlayCircle className={className} aria-hidden />;
    case "QUIZ":
      return <HelpCircle className={className} aria-hidden />;
    case "RESOURCE":
      return <Paperclip className={className} aria-hidden />;
    case "TEXT":
    default:
      return <FileText className={className} aria-hidden />;
  }
}
