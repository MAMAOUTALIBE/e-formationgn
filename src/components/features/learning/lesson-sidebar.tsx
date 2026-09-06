import Link from "next/link";
import { Check, Circle, FileText, GalleryHorizontalEnd, HelpCircle, Paperclip, PlayCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatLessonDuration } from "@/lib/format/duration";
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

interface LessonSidebarProps {
  courseSlug: string;
  sections: SectionSummary[];
  completedLessonIds: Set<string>;
  currentLessonId: string;
}

export function LessonSidebar({
  courseSlug,
  sections,
  completedLessonIds,
  currentLessonId,
}: LessonSidebarProps) {
  return (
    <nav aria-label="Progression de la formation" className="space-y-4">
      {sections.map((section) => (
        <section key={section.id}>
          <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {section.title}
          </h3>
          <ul className="space-y-1">
            {section.lessons.map((lesson) => {
              const completed = completedLessonIds.has(lesson.id);
              const active = lesson.id === currentLessonId;
              return (
                <li key={lesson.id}>
                  <Link
                    href={`/apprentissage/${courseSlug}/lecons/${lesson.id}`}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-[color:var(--brand-primary)]/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {completed ? (
                        <Check className="h-4 w-4 shrink-0 text-[color:var(--brand-success)]" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <LessonIcon type={lesson.type} />
                      <span className="truncate">{lesson.title}</span>
                    </span>
                    {lesson.videoDurationSeconds > 0 ? (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatLessonDuration(lesson.videoDurationSeconds)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}

function LessonIcon({ type }: { type: LessonType }) {
  const className = "h-3.5 w-3.5 shrink-0";
  switch (type) {
    case "VIDEO":
      return <PlayCircle className={className} aria-hidden />;
    case "QUIZ":
      return <HelpCircle className={className} aria-hidden />;
    case "PRESENTATION":
      return <GalleryHorizontalEnd className={className} aria-hidden />;
    case "RESOURCE":
      return <Paperclip className={className} aria-hidden />;
    case "TEXT":
    default:
      return <FileText className={className} aria-hidden />;
  }
}
