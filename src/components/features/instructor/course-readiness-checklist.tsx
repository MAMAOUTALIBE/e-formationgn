import { Check, ChevronDown, Circle } from "lucide-react";
import Link from "next/link";

import type { CourseReadiness } from "@/server/queries/instructor";

interface CourseReadinessChecklistProps {
  courseId: string;
  readiness: CourseReadiness;
}

/**
 * Panneau « prêt à publier » : barre de progression + checklist dépliable
 * (élément <details> natif, aucun JS requis). Chaque item manquant renvoie
 * vers l'étape de l'assistant à corriger.
 */
export function CourseReadinessChecklist({
  courseId,
  readiness,
}: CourseReadinessChecklistProps) {
  const { percent, ready, requiredDone, requiredTotal, items } = readiness;
  const base = `/formateur/cours/${courseId}`;

  return (
    <details className="group rounded-lg border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">
              {ready ? "Prête à publier ✓" : "Progression de la formation"}
            </p>
            <span className="text-sm font-semibold text-muted-foreground">
              {percent}%
            </span>
          </div>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${percent}%`,
                backgroundColor: ready
                  ? "var(--brand-success)"
                  : "var(--brand-primary)",
              }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {requiredDone}/{requiredTotal} éléments obligatoires complétés
          </p>
        </div>
        <ChevronDown
          className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <ul className="space-y-1 border-t border-border p-4 pt-3">
        {items.map((item) => {
          const href = item.stepSlug ? `${base}/${item.stepSlug}` : base;
          return (
            <li key={item.key}>
              <Link
                href={href}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                {item.done ? (
                  <Check
                    className="h-4 w-4 shrink-0 text-[color:var(--brand-success)]"
                    aria-hidden
                  />
                ) : (
                  <Circle
                    className="h-4 w-4 shrink-0 text-muted-foreground/50"
                    aria-hidden
                  />
                )}
                <span
                  className={
                    item.done ? "text-muted-foreground" : "text-foreground"
                  }
                >
                  {item.label}
                </span>
                {!item.required ? (
                  <span className="ml-auto text-xs text-muted-foreground">
                    recommandé
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
