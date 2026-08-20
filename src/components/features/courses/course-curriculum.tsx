"use client";

import Link from "next/link";
import {
  ChevronDown,
  FileText,
  HelpCircle,
  PlayCircle,
  Paperclip,
} from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { formatDurationFromSeconds, formatLessonDuration } from "@/lib/format/duration";
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
  /** Slug du cours — sert à construire les liens « Aperçu » vers la leçon. */
  courseSlug?: string;
}

export function CourseCurriculum({ sections, courseSlug }: CourseCurriculumProps) {
  // Toutes ouvertes par défaut sur mobile, 2 premières sur desktop.
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(sections.slice(0, 2).map((s) => s.id)),
  );

  const allIds = useMemo(() => sections.map((s) => s.id), [sections]);
  const allOpen = openIds.size === allIds.length;

  function toggle(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setOpenIds(new Set(allIds));
  }

  function collapseAll() {
    setOpenIds(new Set());
  }

  if (sections.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
        Le programme détaillé sera publié prochainement.
      </div>
    );
  }

  const totalLessons = sections.reduce((acc, s) => acc + s.lessons.length, 0);
  const totalSeconds = sections.reduce(
    (acc, s) =>
      acc + s.lessons.reduce((sum, l) => sum + l.videoDurationSeconds, 0),
    0,
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[#d8e4df] bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {sections.length} {pluralize(sections.length, "section")} ·{" "}
          {totalLessons} {pluralize(totalLessons, "leçon")}
          {totalSeconds > 0 ? ` · ${formatDurationFromSeconds(totalSeconds)}` : ""}
        </p>
        <button
          type="button"
          onClick={allOpen ? collapseAll : expandAll}
          className="text-xs font-semibold text-[color:var(--brand-secondary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {allOpen ? "Tout masquer" : "Tout afficher"}
        </button>
      </div>
      <ul className="divide-y divide-[#d8e4df]">
        {sections.map((section) => {
          const isOpen = openIds.has(section.id);
          const lessonCount = section.lessons.length;
          const sectionSeconds = section.lessons.reduce(
            (acc, lesson) => acc + lesson.videoDurationSeconds,
            0,
          );

          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => toggle(section.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-[#f3faf6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#07883f]"
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e9f7ef] text-xs font-semibold text-[#07883f]">
                    {sections.indexOf(section) + 1}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-[#345044] transition-transform",
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
                  {sectionSeconds > 0 ? ` · ${formatLessonDuration(sectionSeconds)}` : ""}
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
                        <span className="truncate text-foreground">
                          {lesson.type === "QUIZ" ? "Quiz de validation" : lesson.title}
                        </span>
                        {lesson.isFreePreview ? (
                          // Si on a le slug du cours, le badge devient un lien
                          // cliquable qui ouvre la leçon en mode aperçu (le
                          // backend laisse passer les `isFreePreview=true`
                          // même sans inscription).
                          courseSlug ? (
                            <Link
                              href={`/apprentissage/${courseSlug}/lecons/${lesson.id}`}
                              className="ml-1 inline-flex items-center gap-1 rounded bg-[color:var(--brand-success)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--brand-success)] hover:bg-[color:var(--brand-success)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <PlayCircle className="h-3 w-3" aria-hidden />
                              Aperçu gratuit
                            </Link>
                          ) : (
                            <span className="ml-1 inline-flex items-center rounded bg-[color:var(--brand-success)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--brand-success)]">
                              Aperçu gratuit
                            </span>
                          )
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
