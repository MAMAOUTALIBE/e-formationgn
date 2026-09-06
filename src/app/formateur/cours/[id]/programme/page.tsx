import { notFound } from "next/navigation";
import { Copy, FolderOpen, Trash2 } from "lucide-react";

import { auth } from "@/auth";
import { ConfirmAction } from "@/components/features/instructor/confirm-action";
import { LessonCreateForm } from "@/components/features/instructor/lesson-create-form";
import { ProgramLessonsList } from "@/components/features/instructor/program-lessons-list";
import { SectionCreateForm } from "@/components/features/instructor/section-create-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDurationFromSeconds } from "@/lib/format/duration";
import { pluralize } from "@/lib/format/labels";
import { deleteSection, duplicateSection } from "@/server/actions/curriculum";
import { getInstructorCourse } from "@/server/queries/instructor";

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
              {course.sections.map((section, sectionIndex) => {
                const sectionResourceCount = section.lessons.reduce(
                  (count, lesson) => count + lesson.resources.length,
                  0,
                );

                return (
                  <li
                    key={section.id}
                    className="overflow-hidden rounded-[14px] border border-[#CBD5E1] bg-slate-50 shadow-[0_4px_14px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900/50"
                  >
                    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#CBD5E1] bg-emerald-50 px-4 py-3 dark:border-slate-700 dark:bg-emerald-950/30 sm:px-5">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <p className="inline-flex rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-800 shadow-sm dark:border-emerald-800 dark:bg-slate-950 dark:text-emerald-300">
                            Section {sectionIndex + 1}
                          </p>
                          {sectionResourceCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                              <FolderOpen className="h-3.5 w-3.5" aria-hidden />
                              {sectionResourceCount} ressource
                              {sectionResourceCount > 1 ? "s" : ""}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="truncate text-base font-bold text-foreground sm:text-lg">
                          {section.title}
                        </h3>
                      </div>

                      <div className="ml-auto flex w-full items-center justify-end gap-1 sm:w-auto">
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

                    <div className="space-y-3 p-3 sm:p-4">
                      {section.lessons.length === 0 ? (
                        <p className="rounded-[10px] border border-dashed border-[#D8E0EA] bg-white p-3 text-center text-sm text-muted-foreground dark:border-slate-700 dark:bg-slate-950">
                          Aucune leçon pour le moment.
                        </p>
                      ) : (
                        <ProgramLessonsList
                          courseId={course.id}
                          lessons={section.lessons.map((lesson) => ({
                            id: lesson.id,
                            title: lesson.title,
                            type: lesson.type,
                            isFreePreview: lesson.isFreePreview,
                            muxPlaybackId: lesson.muxPlaybackId,
                            externalVideoUrl: lesson.externalVideoUrl,
                            videoDurationSeconds: lesson.videoDurationSeconds,
                            presentation: lesson.presentation,
                            resources: lesson.resources.map((resource) => ({
                              id: resource.id,
                              title: resource.title,
                              url: resource.url,
                              fileSizeBytes: resource.fileSizeBytes,
                            })),
                          }))}
                        />
                      )}

                      <LessonCreateForm courseId={course.id} sectionId={section.id} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <SectionCreateForm courseId={course.id} />
        </CardContent>
      </Card>
    </div>
  );
}
