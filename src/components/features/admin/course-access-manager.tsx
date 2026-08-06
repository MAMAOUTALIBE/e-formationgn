"use client";

import { useActionState, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  grantCourseAccess,
  revokeCourseAccess,
} from "@/server/actions/admin-enrollments";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

export interface AssignableCourse {
  id: string;
  title: string;
}

export interface GrantedCourse {
  id: string;
  courseId: string;
  title: string;
  progressPercent: number;
  /** ADMIN_GRANT, PURCHASE, … — conditionne la possibilité de retirer. */
  source: string;
}

/**
 * Attribution des formations à un compte.
 *
 * L'élève voit tout le catalogue ; il ne peut suivre que ce qui figure ici.
 * Un accès issu d'un achat n'est pas retirable depuis cet écran : il
 * correspond à une commande payée, et le retirer créerait une incohérence
 * comptable silencieuse.
 */
export function CourseAccessManager({
  userId,
  granted,
  assignable,
}: {
  userId: string;
  granted: GrantedCourse[];
  assignable: AssignableCourse[];
}) {
  const [grantState, grantAction] = useActionState(grantCourseAccess, initialState);
  const [revokeState, revokeAction] = useActionState(revokeCourseAccess, initialState);
  const [selected, setSelected] = useState<string[]>([]);

  const grantedIds = new Set(granted.map((g) => g.courseId));
  const available = assignable.filter((c) => !grantedIds.has(c.id));

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="space-y-5">
      {grantState.message ? (
        <Alert variant={grantState.success ? "success" : "destructive"}>
          <AlertDescription>{grantState.message}</AlertDescription>
        </Alert>
      ) : null}
      {revokeState.message ? (
        <Alert variant={revokeState.success ? "success" : "destructive"}>
          <AlertDescription>{revokeState.message}</AlertDescription>
        </Alert>
      ) : null}

      {/* Formations déjà accessibles */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          Formations accessibles ({granted.length})
        </p>
        {granted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune formation attribuée : ce compte voit le catalogue mais ne peut
            suivre aucun cours.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {granted.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{g.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(g.progressPercent)} % effectué
                    {g.source === "PURCHASE" ? " — issu d'un achat" : ""}
                  </p>
                </div>
                {g.source === "PURCHASE" ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    non retirable
                  </span>
                ) : (
                  <form action={revokeAction} className="shrink-0">
                    <input type="hidden" name="userId" value={userId} />
                    <input type="hidden" name="courseId" value={g.courseId} />
                    <SubmitButton variant="ghost" className="text-xs">
                      Retirer
                    </SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Attribution */}
      {available.length > 0 ? (
        <form action={grantAction} className="space-y-3">
          <input type="hidden" name="userId" value={userId} />
          <p className="text-sm font-medium text-foreground">Attribuer des formations</p>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
            {available.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
              >
                <input
                  type="checkbox"
                  name="courseIds"
                  value={c.id}
                  checked={selected.includes(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4"
                />
                <span className="truncate text-foreground">{c.title}</span>
              </label>
            ))}
          </div>
          <SubmitButton disabled={selected.length === 0}>
            Attribuer {selected.length > 0 ? `(${selected.length})` : ""}
          </SubmitButton>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          Toutes les formations publiées sont déjà attribuées à ce compte.
        </p>
      )}
    </div>
  );
}
