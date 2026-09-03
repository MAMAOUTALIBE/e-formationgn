"use client";

// Curriculum collapsible, façon Udemy :
//   - chaque section est un <details> avec un compteur "X / Y · MM min"
//   - section contenant la leçon courante est ouverte par défaut
//   - icônes Lesson différenciées (vidéo / quiz / texte)
//   - l'unique ressource éventuelle se télécharge directement sous sa leçon
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
  Download,
  FileText,
  HelpCircle,
  Paperclip,
  PlayCircle,
  Search,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { formatDurationFromSeconds, formatLessonDuration } from "@/lib/format/duration";
import { formatFileSize, lessonResourceHref } from "@/lib/resource-file";
import type { LessonType } from "@/generated/prisma/enums";

interface LessonResourceSummary {
  id: string;
  title: string;
  fileSizeBytes: number | null;
}

interface LessonSummary {
  id: string;
  title: string;
  type: LessonType;
  videoDurationSeconds: number;
  resources: LessonResourceSummary[];
  /** Ancienne ressource unique, conservée pour les cours historiques. */
  legacyResource?: { title: string; url: string };
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
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  // Filtrage : on garde l'index d'origine de chaque section pour conserver la
  // numérotation « Section N » même quand on filtre.
  const filteredSections = sections
    .map((section, index) => {
      const learningLessons = section.lessons.filter(
        (lesson) => lesson.type !== "RESOURCE",
      );
      if (!q) return { section: { ...section, lessons: learningLessons }, index };
      const sectionMatches = section.title.toLowerCase().includes(q);
      const lessons = sectionMatches
        ? learningLessons
        : learningLessons.filter((l) => l.title.toLowerCase().includes(q));
      return { section: { ...section, lessons }, index };
    })
    .filter(({ section }) => section.lessons.length > 0);

  return (
    <nav aria-label="Programme de la formation" className="divide-y divide-border">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une leçon…"
            aria-label="Rechercher une leçon"
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {filteredSections.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Aucune leçon ne correspond à « {query} ».
        </p>
      ) : null}

      {filteredSections.map(({ section, index }) => {
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
            open={containsCurrent || q !== ""}
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
                const resource = lesson.resources[0] ?? null;
                const resourceHref = resource
                  ? lessonResourceHref(lesson.id, resource.id, true)
                  : lesson.legacyResource?.url;
                const resourceTitle = resource?.title ?? lesson.legacyResource?.title;
                const resourceSize = resource?.fileSizeBytes ?? null;
                return (
                  <li
                    key={lesson.id}
                    className={cn(
                      "border-l-2 text-sm transition-colors",
                      isActive
                        ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]/8 text-foreground"
                        : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <div className="min-w-0 px-3 py-2.5 pl-4">
                      <Link
                        href={`/apprentissage/${courseSlug}/lecons/${lesson.id}`}
                        aria-current={isActive ? "page" : undefined}
                        className="flex min-w-0 flex-1 items-start gap-3"
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
                              "whitespace-normal break-words leading-5 [overflow-wrap:anywhere]",
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

                      {resourceHref && resourceTitle ? (
                        <a
                          href={resourceHref}
                          download
                          aria-label={`Télécharger la ressource ${resourceTitle}`}
                          className="mt-2.5 ml-7 flex min-w-0 items-center gap-2 rounded-md border border-blue-200 bg-blue-50/70 px-2.5 py-2 text-foreground transition-colors hover:border-blue-400 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
                        >
                          <Paperclip
                            className="h-3.5 w-3.5 shrink-0 text-[color:var(--brand-secondary)]"
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium">
                              {resourceTitle}
                            </span>
                            {resourceSize ? (
                              <span className="block text-[10px] text-muted-foreground">
                                {formatFileSize(resourceSize)}
                              </span>
                            ) : null}
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[color:var(--brand-secondary)]">
                            <Download className="h-3.5 w-3.5" aria-hidden />
                            Télécharger
                          </span>
                        </a>
                      ) : null}
                    </div>
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
