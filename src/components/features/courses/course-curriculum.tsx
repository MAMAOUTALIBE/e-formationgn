"use client";

import { ChevronDown, FileText, HelpCircle, PlayCircle, Paperclip } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { formatLessonDuration } from "@/lib/format/duration";
import type { LessonType } from "@/generated/prisma/enums";
import { pluralize } from "@/lib/format/labels";

interface LessonSummary {
  id: string;
  title: string;
  type: LessonType;
  videoDurationSeconds: number;
  isFreePreview: boolean;
}

interface SectionSummary {
  id: string;
  title: string;
  lessons: LessonSummary[];
}

interface CourseCurriculumProps {
  sections: SectionSummary[];
}

export function CourseCurriculum({ sections }: CourseCurriculumProps) {
  // Toutes ouvertes par défaut sur mobile, premières 2 sur desktop
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(sections.slice(0, 2).map((s) => s.id)),
  );

  function toggle(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (sections.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
        Le programme détaillé sera publié prochainement.
      </div>
    );
  }

  const totalLessons = sections.reduce((acc, s) => acc + s.lessons.length, 0);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
        {sections.length} {pluralize(sections.length, "section")} ·{" "}
        {totalLessons} {pluralize(totalLessons, "leçon")}
      </div>
      <ul className="divide-y divide-border">
        {sections.map((section) => {
          const isOpen = openIds.has(section.id);
          const lessonCount = section.lessons.length;
          const totalSeconds = section.lessons.reduce(
            (acc, lesson) => acc + lesson.videoDurationSeconds,
            0,
          );

          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => toggle(section.id)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-3">
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      !isOpen && "-rotate-90",
                    )}
                    aria-hidden
                  />
                  <span className="text-sm font-semibold text-foreground">
                    {section.title}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {lessonCount} {pluralize(lessonCount, "leçon")}
                  {totalSeconds > 0 ? ` · ${formatLessonDuration(totalSeconds)}` : ""}
                </span>
              </button>

              {isOpen ? (
                <ul className="border-t border-border bg-muted/20">
                  {section.lessons.map((lesson) => (
                    <li
                      key={lesson.id}
                      className="flex items-center justify-between gap-4 px-4 py-2.5 pl-11 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <LessonIcon type={lesson.type} />
                        <span className="truncate text-foreground">{lesson.title}</span>
                        {lesson.isFreePreview ? (
                          <span className="ml-1 inline-flex items-center rounded bg-[color:var(--brand-success)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--brand-success)]">
                            Aperçu gratuit
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {lesson.videoDurationSeconds > 0
                          ? formatLessonDuration(lesson.videoDurationSeconds)
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LessonIcon({ type }: { type: LessonType }) {
  const className = "h-4 w-4 shrink-0 text-muted-foreground";
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
