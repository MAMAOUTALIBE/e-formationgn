"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  grantCourseToUsers,
  loadCourseGrantCandidates,
} from "@/server/actions/admin-enrollments";
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
  totalCandidates = candidates.length,
  pageSize = 50,
}: {
  courseId: string;
  candidates: GrantCandidate[];
  totalCandidates?: number;
  pageSize?: number;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [visible, setVisible] = useState(candidates);
  const [visibleTotal, setVisibleTotal] = useState(totalCandidates);
  const [grantedIds, setGrantedIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const requestId = useRef(0);
  const [state, formAction] = useActionState(async (previous: ActionResult, formData: FormData) => {
    const result = await grantCourseToUsers(previous, formData);
    if (result.success) {
      setGrantedIds((current) => [...new Set([...current, ...selected])]);
      setSelected([]);
    }
    return result;
  }, initialState);

  useEffect(() => {
    const normalized = query.trim();
    if (!normalized) return;

    const currentRequest = ++requestId.current;
    const timer = window.setTimeout(() => {
      startLoading(async () => {
        const result = await loadCourseGrantCandidates({
          courseId,
          query: normalized,
          offset: 0,
          limit: pageSize,
        });
        if (currentRequest !== requestId.current) return;
        if (!result.success) {
          setLoadError(result.message ?? "Impossible de rechercher les comptes.");
          return;
        }
        setVisible(result.candidates);
        setVisibleTotal(result.total);
        setLoadError(null);
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [courseId, pageSize, query]);

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    if (nextQuery.trim()) return;
    requestId.current += 1;
    setVisible(candidates);
    setVisibleTotal(totalCandidates);
    setLoadError(null);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    );
  }, [query, visible]);

  const selectable = filtered.filter(
    (candidate) => !candidate.alreadyEnrolled && !grantedIds.includes(candidate.id),
  );
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

  function loadMore() {
    const normalized = query.trim();
    startLoading(async () => {
      const result = await loadCourseGrantCandidates({
        courseId,
        query: normalized,
        offset: visible.length,
        limit: pageSize,
      });
      if (!result.success) {
        setLoadError(result.message ?? "Impossible de charger plus de comptes.");
        return;
      }
      setVisible((current) => {
        const ids = new Set(current.map((candidate) => candidate.id));
        return [...current, ...result.candidates.filter((candidate) => !ids.has(candidate.id))];
      });
      setVisibleTotal(result.total);
      setLoadError(null);
    });
  }

  return (
    <form action={formAction} className="flex h-full min-h-0 flex-col gap-2 xl:gap-1">
      <input type="hidden" name="courseId" value={courseId} />
      {selected.map((id) => (
        <input key={id} type="hidden" name="userIds" value={id} />
      ))}

      {state.message ? (
        <Alert variant={state.success ? "success" : "destructive"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <p
          className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium tabular-nums text-foreground"
          aria-live="polite"
        >
          {selected.length} sur {totalCandidates}
        </p>
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            aria-label="Rechercher un compte par nom ou e-mail"
            placeholder="Nom ou e-mail…"
            className="h-9 pl-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleAll}
          disabled={selectable.length === 0}
          className="shrink-0"
        >
          {allSelected ? "Tout décocher" : "Tout sélectionner"}
        </Button>
        {loading ? <span className="sr-only" aria-live="polite">Actualisation des comptes…</span> : null}
      </div>

      {loadError ? (
        <p role="alert" className="text-xs text-destructive">{loadError}</p>
      ) : null}

      <div
        className="min-h-24 flex-1 overflow-y-auto overscroll-contain rounded-md border border-border"
        aria-busy={loading}
      >
        <div className="sticky top-0 z-10 flex h-8 items-center justify-between border-b border-border bg-card px-3 text-xs text-muted-foreground">
          <span>Comptes</span>
          <span>{visibleTotal} résultat{visibleTotal > 1 ? "s" : ""}</span>
        </div>
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {loading ? "Recherche en cours…" : "Aucun compte trouvé."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => (
              <li key={c.id}>
                <label
                  className={`flex items-center gap-2 px-3 py-2 text-sm ${
                    c.alreadyEnrolled || grantedIds.includes(c.id)
                      ? "opacity-55"
                      : "cursor-pointer hover:bg-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={c.alreadyEnrolled || grantedIds.includes(c.id)}
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
                  {c.alreadyEnrolled || grantedIds.includes(c.id) ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      déjà inscrit
                    </span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
        )}
        {visible.length < visibleTotal ? (
          <div className="flex justify-center border-t border-border bg-card p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={loadMore}
              disabled={loading}
              className="h-8 text-xs"
            >
              {loading ? "Chargement…" : "Charger plus"}
            </Button>
          </div>
        ) : null}
      </div>

      <SubmitButton disabled={selected.length === 0} size="sm" pendingLabel="Ouverture…" className="shrink-0 xl:h-7">
        Ouvrir la formation{selected.length > 0 ? ` à ${selected.length} compte${selected.length > 1 ? "s" : ""}` : ""}
      </SubmitButton>
    </form>
  );
}
