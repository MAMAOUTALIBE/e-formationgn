"use client";

// Curriculum collapsible, façon Udemy :
//   - chaque section est un <details> avec un compteur "X / Y · MM min"
//   - section contenant la leçon courante est ouverte par défaut
//   - icônes Lesson différenciées (vidéo / quiz / texte / ressource)
//   - bouton de complétion = check rond filled
//
// Composant client uniquement pour gérer le rendu progressif `<details>`
// (Next.js peut rendre `<details>` en SSR, mais on a besoin de `defaultOpen`
// déterministe basé sur currentLessonId).

import Link from "next/link";
import {
  Check,
  ChevronDown,
  Circle,
  FileText,
  HelpCircle,
  Paperclip,
  PlayCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDurationFromSeconds, formatLessonDuration } from "@/lib/format/duration";
import type { LessonType } from "@/generated/prisma/enums";

interface LessonSummary {
  id: string;
  title: string;
  type: LessonType;
  videoDurationSeconds: number;
}

interface SectionSummary {
  id: string;
  title: string;
  lessons: LessonSummary[];
}

interface LearningSidebarProps {
  courseSlug: string;
  sections: SectionSummary[];
  completedLessonIds: Set<string>;
  currentLessonId: string;
}

export function LearningSidebar({
  courseSlug,
  sections,
  completedLessonIds,
  currentLessonId,
}: LearningSidebarProps) {
  return (
    <nav aria-label="Programme du cours" className="divide-y divide-border">
      {sections.map((section, index) => {
        const total = section.lessons.length;
        const completed = section.lessons.filter((l) =>
          completedLessonIds.has(l.id),
        ).length;
        const totalDurationSeconds = section.lessons.reduce(
          (sum, l) => sum + l.videoDurationSeconds,
          0,
        );
        const containsCurrent = section.lessons.some(
          (l) => l.id === currentLessonId,
        );

        return (
          <details
            key={section.id}
            open={containsCurrent}
            className="group"
          >
            <summary className="flex cursor-pointer list-none items-start gap-3 bg-muted/40 px-4 py-3 transition-colors hover:bg-muted/70">
              <ChevronDown
                className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  Section {index + 1} : {section.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  {completed} / {total} · {formatDurationFromSeconds(totalDurationSeconds)}
                </p>
              </div>
            </summary>

            <ul className="border-t border-border bg-card">
              {section.lessons.map((lesson, lessonIdx) => {
                const isCompleted = completedLessonIds.has(lesson.id);
                const isActive = lesson.id === currentLessonId;
                return (
                  <li key={lesson.id}>
                    <Link
                      href={`/apprentissage/${courseSlug}/lecons/${lesson.id}`}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-start gap-3 border-l-2 px-4 py-2.5 text-sm transition-colors",
                        isActive
                          ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]/8 text-foreground"
                          : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      {isCompleted ? (
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-[color:var(--brand-success)]/20 p-0.5 text-[color:var(--brand-success)]"
                          aria-label="Leçon terminée"
                        />
                      ) : (
                        <Circle
                          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50"
                          aria-hidden
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate",
                            isActive && "font-semibold",
                          )}
                        >
                          {lessonIdx + 1}. {lesson.title}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <LessonIcon type={lesson.type} />
                          <span className="capitalize">
                            {LESSON_TYPE_LABEL[lesson.type]}
                          </span>
                          {lesson.videoDurationSeconds > 0 ? (
                            <>
                              <span aria-hidden>·</span>
                              <span className="tabular-nums">
                                {formatLessonDuration(lesson.videoDurationSeconds)}
                              </span>
                            </>
                          ) : null}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </nav>
  );
}

const LESSON_TYPE_LABEL: Record<LessonType, string> = {
  VIDEO: "vidéo",
  QUIZ: "quiz",
  TEXT: "lecture",
  RESOURCE: "ressource",
};

function LessonIcon({ type }: { type: LessonType }) {
  const className = "h-3 w-3 shrink-0";
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
