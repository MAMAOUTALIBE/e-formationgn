"use client";

import { Check, Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import {
  SECONDARY_STEPS,
  WIZARD_STEPS,
  currentStepIndex,
  stepHref,
} from "./wizard";

interface CourseEditorTabsProps {
  courseId: string;
  /** Slugs des étapes de création déjà complétées (pour la pastille ✓). */
  completedSlugs: string[];
  /** Index max accessible : les étapes au-delà sont verrouillées. */
  unlockedMaxIndex: number;
}

export function CourseEditorTabs({
  courseId,
  completedSlugs,
  unlockedMaxIndex,
}: CourseEditorTabsProps) {
  const pathname = usePathname();
  const activeIndex = currentStepIndex(courseId, pathname);
  const completed = new Set(completedSlugs);

  return (
    <nav aria-label="Étapes de création du cours" className="border-b border-border">
      {/* Étapes numérotées (parcours guidé) */}
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 py-1">
        {WIZARD_STEPS.map((step, i) => {
          const href = stepHref(courseId, step.slug);
          const isActive = i === activeIndex;
          const isDone = completed.has(step.slug);
          const isLocked = i > unlockedMaxIndex;

          const badge = (
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                isActive
                  ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] text-primary-foreground"
                  : isLocked
                    ? "border-border text-muted-foreground/60"
                    : isDone
                      ? "border-[color:var(--brand-success)] bg-[color:var(--brand-success)] text-white"
                      : "border-border text-muted-foreground",
              )}
            >
              {isLocked ? (
                <Lock className="h-3 w-3" aria-hidden />
              ) : isDone && !isActive ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                i + 1
              )}
            </span>
          );

          return (
            <li key={step.slug} className="flex items-center">
              {isLocked ? (
                <span
                  aria-disabled
                  title="Terminez l'étape précédente pour débloquer celle-ci."
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/60"
                >
                  {badge}
                  {step.label}
                </span>
              ) : (
                <Link
                  href={href}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[color:var(--brand-primary)]/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {badge}
                  {step.label}
                </Link>
              )}
              {i < WIZARD_STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className="mx-1 hidden h-px w-4 bg-border sm:block"
                />
              ) : null}
            </li>
          );
        })}

        {/* Onglets secondaires (post-création) */}
        <li aria-hidden className="mx-2 hidden h-5 w-px bg-border sm:block" />
        {SECONDARY_STEPS.map((step) => {
          const href = stepHref(courseId, step.slug);
          const isActive = pathname.startsWith(href);
          return (
            <li key={step.slug}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
