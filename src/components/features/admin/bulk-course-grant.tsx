"use client";

import { useActionState, useMemo, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { grantCourseToUsers } from "@/server/actions/admin-enrollments";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

export interface GrantCandidate {
  id: string;
  name: string;
  email: string;
  /** Déjà inscrit à cette formation : affiché, mais non sélectionnable. */
  alreadyEnrolled: boolean;
}

/**
 * Ouvre une formation à plusieurs comptes depuis la fiche de la formation.
 *
 * Pensé pour une promotion : filtre par nom ou email, tout sélectionner sur le
 * résultat filtré, puis un seul envoi — au lieu de rouvrir chaque fiche élève.
 */
export function BulkCourseGrant({
  courseId,
  candidates,
}: {
  courseId: string;
  candidates: GrantCandidate[];
}) {
  const [state, formAction] = useActionState(grantCourseToUsers, initialState);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    );
  }, [candidates, query]);

  const selectable = filtered.filter((c) => !c.alreadyEnrolled);
  const allSelected =
    selectable.length > 0 && selectable.every((c) => selected.includes(c.id));

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const toggleAll = () =>
    setSelected((s) =>
      allSelected
        ? s.filter((id) => !selectable.some((c) => c.id === id))
        : [...new Set([...s, ...selectable.map((c) => c.id)])],
    );

  const enrolledCount = candidates.filter((c) => c.alreadyEnrolled).length;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="courseId" value={courseId} />

      {state.message ? (
        <Alert variant={state.success ? "success" : "destructive"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {enrolledCount} compte{enrolledCount > 1 ? "s ont" : " a"} déjà accès sur{" "}
        {candidates.length}.
      </p>

      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer par nom ou email…"
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleAll}
          disabled={selectable.length === 0}
          className="shrink-0"
        >
          {allSelected ? "Tout décocher" : "Tout cocher"}
        </Button>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-md border border-border">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Aucun compte trouvé.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => (
              <li key={c.id}>
                <label
                  className={`flex items-center gap-2 px-3 py-2 text-sm ${
                    c.alreadyEnrolled ? "opacity-55" : "cursor-pointer hover:bg-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="userIds"
                    value={c.id}
                    disabled={c.alreadyEnrolled}
                    checked={selected.includes(c.id)}
                    onChange={() => toggle(c.id)}
                    className="h-4 w-4"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-foreground">{c.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.email}
                    </span>
                  </span>
                  {c.alreadyEnrolled ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      déjà inscrit
                    </span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SubmitButton disabled={selected.length === 0}>
        Ouvrir la formation{selected.length > 0 ? ` à ${selected.length} compte${selected.length > 1 ? "s" : ""}` : ""}
      </SubmitButton>
    </form>
  );
}
