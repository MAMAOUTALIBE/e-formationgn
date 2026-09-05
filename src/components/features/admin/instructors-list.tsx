"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { AccountStatus } from "@/generated/prisma/enums";
import { archiveInstructorAccounts } from "@/server/actions/admin-security";

export interface AdminInstructorListRow {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  status: AccountStatus;
  coursesCount: number;
  enrollmentsCount: number;
}

export function AdminInstructorsList({ rows }: { rows: AdminInstructorListRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<AdminInstructorListRow[] | null>(null);
  const removableRows = rows.filter((row) => row.status !== "DELETED");
  const allSelected =
    removableRows.length > 0 && removableRows.every((row) => selected.has(row.id));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function remove(rowsToRemove: AdminInstructorListRow[]) {
    startTransition(async () => {
      setMessage(null);
      const result = await archiveInstructorAccounts(rowsToRemove.map((row) => row.id));
      setMessage(result.message ?? (result.success ? "Action terminée." : "Une erreur est survenue."));
      if (result.success) {
        setSelected(new Set());
        setConfirming(null);
        router.refresh();
      }
    });
  }

  const selectedRows = removableRows.filter((row) => selected.has(row.id));
  const preservedCourses = confirming?.reduce((sum, row) => sum + row.coursesCount, 0) ?? 0;

  return (
    <>
      {selectedRows.length > 0 ? (
        <div className="flex min-h-11 items-center gap-2 border-b border-border bg-muted/35 px-4 text-xs">
          <strong>
            {selectedRows.length} sélectionné{selectedRows.length > 1 ? "s" : ""}
          </strong>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => setConfirming(selectedRows)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Supprimer
          </Button>
          <button
            type="button"
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={() => setSelected(new Set())}
          >
            Annuler
          </button>
        </div>
      ) : message ? (
        <div
          className="flex min-h-11 items-center justify-between border-b border-border bg-muted/35 px-4 text-xs"
          role="status"
        >
          <span>{message}</span>
          <button type="button" aria-label="Fermer" onClick={() => setMessage(null)}>
            ×
          </button>
        </div>
      ) : null}

      {removableRows.length > 1 ? (
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-xs text-muted-foreground">
          <Checkbox
            aria-label="Sélectionner tous les formateurs affichés"
            checked={allSelected}
            onChange={(event) =>
              setSelected(
                event.target.checked
                  ? new Set(removableRows.map((row) => row.id))
                  : new Set(),
              )
            }
          />
          <span>Sélectionner tous les formateurs affichés</span>
        </div>
      ) : null}

      <ul className="divide-y divide-border">
        {rows.map((user) => {
          const label = user.name ?? user.email;
          const archived = user.status === "DELETED";
          return (
            <li key={user.id} className="flex items-center gap-3 p-4 hover:bg-muted/35">
              {archived ? (
                <span className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <Checkbox
                  aria-label={`Sélectionner ${label}`}
                  checked={selected.has(user.id)}
                  onChange={() => toggle(user.id)}
                />
              )}
              <Link
                href={`/admin/utilisateurs/${user.id}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <Avatar src={user.image} alt={label} fallback={label} />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{label}</strong>
                  <span className="block text-xs text-muted-foreground">
                    {user.coursesCount} formation{user.coursesCount !== 1 ? "s" : ""} ·{" "}
                    {user.enrollmentsCount} inscription{user.enrollmentsCount !== 1 ? "s" : ""}
                    {archived ? " · Archivé" : ""}
                  </span>
                </span>
              </Link>
              {!archived ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirming([user])}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Supprimer</span>
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title={`Supprimer ${confirming?.length ?? 0} formateur${(confirming?.length ?? 0) > 1 ? "s" : ""} ?`}
        description={`Leur accès sera immédiatement coupé et les comptes seront retirés de la liste active. ${preservedCourses} formation${preservedCourses !== 1 ? "s" : ""} liée${preservedCourses !== 1 ? "s" : ""} restera${preservedCourses !== 1 ? "ont" : ""} conservée${preservedCourses !== 1 ? "s" : ""}.`}
        confirmLabel="Supprimer les formateurs"
        destructive
        pending={pending}
        onConfirm={() => {
          if (confirming) remove(confirming);
        }}
      />
    </>
  );
}
