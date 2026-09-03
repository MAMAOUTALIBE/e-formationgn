"use client";

import Link from "next/link";
import {
  ChevronDown,
  Copy,
  FileText,
  FolderOpen,
  FolderPlus,
  HelpCircle,
  Paperclip,
  PenLine,
  PlayCircle,
  X,
} from "lucide-react";
import { useId, useState } from "react";

import { LessonResourcesManager } from "@/components/features/instructor/lesson-resources-manager";
import { Button } from "@/components/ui/button";
import type { LessonType } from "@/generated/prisma/enums";
import { formatLessonDuration } from "@/lib/format/duration";
import { cn } from "@/lib/utils";
import { duplicateLesson } from "@/server/actions/curriculum";

interface ProgramLessonResource {
  id: string;
  title: string;
  url: string;
  fileSizeBytes: number | null;
}

interface ProgramLesson {
  id: string;
  title: string;
  type: LessonType;
  isFreePreview: boolean;
  muxPlaybackId: string | null;
  externalVideoUrl: string | null;
  videoDurationSeconds: number;
  resources: ProgramLessonResource[];
}

interface ProgramLessonsListProps {
  courseId: string;
  lessons: ProgramLesson[];
}

/**
 * Liste interactive des leçons d'une section.
 *
 * L'état est volontairement local à la section : une seule gestion de
 * ressources peut être ouverte à la fois, sans transformer toute la page
 * Programme en composant client.
 */
export function ProgramLessonsList({ courseId, lessons }: ProgramLessonsListProps) {
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);

  return (
    <ul className="space-y-2.5">
      {lessons.map((lesson, lessonIndex) => (
        <ProgramLessonCard
          key={lesson.id}
          courseId={courseId}
          lesson={lesson}
          lessonIndex={lessonIndex}
          resourcesOpen={openLessonId === lesson.id}
          onToggleResources={() =>
            setOpenLessonId((current) => (current === lesson.id ? null : lesson.id))
          }
        />
      ))}
    </ul>
  );
}

interface ProgramLessonCardProps {
  courseId: string;
  lesson: ProgramLesson;
  lessonIndex: number;
  resourcesOpen: boolean;
  onToggleResources: () => void;
}

function ProgramLessonCard({
  courseId,
  lesson,
  lessonIndex,
  resourcesOpen,
  onToggleResources,
}: ProgramLessonCardProps) {
  const generatedId = useId();
  const panelId = `lesson-resources-${generatedId.replace(/:/g, "")}`;
  const titleId = `${panelId}-title`;
  const resourceCount = lesson.resources.length;
  const resourceLabel =
    resourceCount > 0 ? "Ressource" : "Ajouter une ressource";

  return (
    <li
      data-lesson-card
      className="relative min-w-0 overflow-hidden rounded-[10px] border border-[#D8E0EA] bg-white [color-scheme:light] [--background:white] [--border:var(--neutral-200)] [--card:white] [--card-foreground:var(--neutral-900)] [--foreground:var(--neutral-900)] [--input:var(--neutral-200)] [--muted:var(--neutral-100)] [--muted-foreground:var(--neutral-600)] shadow-[0_2px_6px_rgba(15,23,42,0.06)] transition-[border-color,box-shadow] duration-200 hover:border-[#2563EB] hover:shadow-[0_4px_12px_rgba(15,23,42,0.12)] focus-within:border-[#2563EB] focus-within:shadow-[0_4px_12px_rgba(15,23,42,0.12)] dark:border-[#D8E0EA] dark:bg-white dark:hover:border-[#2563EB]"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 z-10 w-1 bg-[color:var(--brand-success)]"
      />

      <div className="flex min-w-0 items-center justify-between gap-2 py-3 pl-4 pr-3 sm:gap-4 sm:px-4 sm:pl-5">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">
            {lessonIndex + 1}.
          </span>
          <span className="shrink-0">
            <LessonIcon type={lesson.type} />
          </span>
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {lesson.title}
          </span>
          {lesson.isFreePreview ? (
            <span className="inline-flex shrink-0 items-center rounded bg-[color:var(--brand-success)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--brand-success)]">
              Aperçu
            </span>
          ) : null}
          {lesson.type === "VIDEO" ? (
            lesson.muxPlaybackId || lesson.externalVideoUrl ? (
              <span className="inline-flex shrink-0 items-center rounded bg-[color:var(--brand-accent)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--brand-accent)]">
                Vidéo prête
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center rounded bg-[color:var(--brand-warning)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--brand-warning)]">
                Vidéo manquante
              </span>
            )
          ) : null}
        </span>

        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground sm:gap-2">
          {lesson.type === "VIDEO" && lesson.videoDurationSeconds > 0 ? (
            <span className="hidden xl:inline">
              {formatLessonDuration(lesson.videoDurationSeconds)}
            </span>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleResources}
            aria-expanded={resourcesOpen}
            aria-controls={panelId}
            aria-label={resourceLabel}
            title={resourceLabel}
            className={cn(
              "h-auto border-blue-200 bg-blue-50 px-1.5 text-[color:var(--brand-secondary)] hover:bg-blue-100 dark:border-blue-200 dark:bg-blue-50 dark:hover:bg-blue-100 md:px-2",
              resourcesOpen && "border-[#2563EB] bg-blue-100 dark:bg-blue-100",
            )}
          >
            {resourceCount > 0 ? (
              <FolderOpen className="h-3.5 w-3.5" />
            ) : (
              <FolderPlus className="h-3.5 w-3.5" />
            )}
            <span className="hidden lg:inline">{resourceLabel}</span>
            {resourceCount > 0 ? (
              <span className="tabular-nums lg:hidden">{resourceCount}</span>
            ) : null}
            <ChevronDown
              className={cn(
                "hidden h-3.5 w-3.5 transition-transform lg:block",
                resourcesOpen && "rotate-180",
              )}
              aria-hidden
            />
          </Button>

          <Button asChild variant="link" size="sm" className="h-auto px-1 sm:px-0">
            <Link
              href={`/formateur/cours/${courseId}/lecons/${lesson.id}`}
              title={lesson.type === "QUIZ" ? "Configurer le quiz" : "Modifier"}
            >
              <PenLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {lesson.type === "QUIZ" ? "Configurer le quiz" : "Modifier"}
              </span>
              <span className="sr-only sm:hidden">
                {lesson.type === "QUIZ" ? "Configurer le quiz" : "Modifier"}
              </span>
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
      </div>

      {resourcesOpen ? (
        <section
          id={panelId}
          aria-labelledby={titleId}
          className="border-t border-blue-200 bg-blue-50/70 p-3 dark:border-blue-200 dark:bg-blue-50/70 sm:p-4"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h4 id={titleId} className="text-sm font-semibold text-foreground">
                Ressource de la leçon
              </h4>
              <p className="text-xs text-muted-foreground">
                {resourceCount > 0
                  ? "Un fichier téléchargeable est disponible."
                  : "Ajoutez un seul support téléchargeable à cette leçon."}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onToggleResources}
              aria-label="Fermer les ressources"
              title="Fermer"
              className="h-auto px-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <LessonResourcesManager
            lessonId={lesson.id}
            resources={lesson.resources}
            compact
          />
        </section>
      ) : null}
    </li>
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
