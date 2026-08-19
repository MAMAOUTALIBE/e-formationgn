"use client";

// Composition d'un programme : ajout et retrait de formations (points 6 et 7 du
// cahier des charges, au niveau du programme).
//
// `useTransition` plutôt qu'un formulaire : chaque ligne a son propre bouton
// et on veut désactiver seulement celui qu'on vient de cliquer, pas tout
// l'écran.

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  addCourseToProgram,
  removeCourseFromProgram,
} from "@/server/actions/admin-programs";

export interface ProgramCourseRow {
  courseId: string;
  title: string;
  status: string;
  position: number;
}

export function ProgramComposition({
  programId,
  courses,
  assignable,
}: {
  programId: string;
  courses: ProgramCourseRow[];
  assignable: Array<{ id: string; title: string; status: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function add() {
    if (!selected) return;
    startTransition(async () => {
      const res = await addCourseToProgram(programId, selected);
      setMessage(res.message ?? null);
      setSelected("");
      router.refresh();
    });
  }

  function remove(courseId: string) {
    startTransition(async () => {
      const res = await removeCourseFromProgram(programId, courseId);
      setMessage(res.message ?? null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}

      {courses.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          Aucune formation dans ce programme. Ajoutez-en pour définir le parcours.
        </p>
      ) : (
        <ol className="space-y-2">
          {courses.map((c, index) => (
            <li
              key={c.courseId}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
            >
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {c.title}
              </span>
              <StatusBadge tone={c.status === "PUBLISHED" ? "success" : "neutral"}>
                {c.status === "PUBLISHED" ? "Publié" : c.status}
              </StatusBadge>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => remove(c.courseId)}
                aria-label={`Retirer ${c.title}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <label htmlFor="addCourse" className="mb-1 block text-xs font-medium text-muted-foreground">
            Ajouter une formation
          </label>
          <Select
            id="addCourse"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={pending || assignable.length === 0}
          >
            <option value="">
              {assignable.length === 0
                ? "Toutes les formations sont déjà dans le programme"
                : "Sélectionner une formation…"}
            </option>
            {assignable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={add} disabled={pending || !selected}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          Ajouter
        </Button>
      </div>
    </div>
  );
}
