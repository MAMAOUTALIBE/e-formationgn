"use client";

// Inscriptions d'un élève : rattachement à une session, puis pilotage des
// accès par le statut.
//
// Les boutons de statut sont l'unique geste des points 8 et 9 du cahier des
// charges : activer ouvre réellement les formations du programme, suspendre les
// retire. Rien n'est « masqué » — l'accès est retiré en base, donc les six
// contrôles existants de l'application le refusent d'eux-mêmes.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  registerStudentToSession,
  setRegistrationStatus,
} from "@/server/actions/admin-registrations";

export interface RegistrationRow {
  id: string;
  status: string;
  programTitle: string;
  sessionReference: string | null;
  startDate: string;
  endDate: string;
  courseCount: number;
}

export interface SessionOption {
  id: string;
  label: string;
  full: boolean;
  seatsLeft: number | null;
}

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  PENDING: { label: "En attente", tone: "warning" },
  ACTIVE: { label: "Actif", tone: "success" },
  SUSPENDED: { label: "Suspendu", tone: "warning" },
  COMPLETED: { label: "Terminé", tone: "neutral" },
  CANCELLED: { label: "Annulé", tone: "neutral" },
};

/** Transitions proposées depuis chaque statut — on n'offre que ce qui a du sens. */
const NEXT_STATUSES: Record<string, Array<{ value: string; label: string }>> = {
  PENDING: [
    { value: "ACTIVE", label: "Activer les accès" },
    { value: "CANCELLED", label: "Annuler" },
  ],
  ACTIVE: [
    { value: "SUSPENDED", label: "Suspendre" },
    { value: "COMPLETED", label: "Terminer" },
    { value: "CANCELLED", label: "Annuler" },
  ],
  SUSPENDED: [
    { value: "ACTIVE", label: "Réactiver" },
    { value: "CANCELLED", label: "Annuler" },
  ],
  COMPLETED: [{ value: "ACTIVE", label: "Rouvrir les accès" }],
  CANCELLED: [{ value: "ACTIVE", label: "Rouvrir les accès" }],
};

export function StudentRegistrations({
  studentId,
  registrations,
  sessions,
}: {
  studentId: string;
  registrations: RegistrationRow[];
  sessions: SessionOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function register() {
    if (!selected) return;
    startTransition(async () => {
      const res = await registerStudentToSession(selected, studentId);
      setMessage(res.message ?? null);
      setSelected("");
      router.refresh();
    });
  }

  function changeStatus(registrationId: string, status: string) {
    startTransition(async () => {
      const res = await setRegistrationStatus(
        registrationId,
        status as "PENDING" | "ACTIVE" | "SUSPENDED" | "COMPLETED" | "CANCELLED",
      );
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

      {registrations.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          Aucune inscription. Rattachez cet élève à une session pour lui ouvrir
          des accès.
        </p>
      ) : (
        <ul className="space-y-2">
          {registrations.map((r) => {
            const badge = STATUS[r.status] ?? { label: r.status, tone: "neutral" as const };
            return (
              <li key={r.id} className="rounded-lg border border-border px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {r.programTitle}
                  </span>
                  <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.sessionReference ? `${r.sessionReference} · ` : ""}
                  {r.startDate} → {r.endDate} · {r.courseCount} formation{r.courseCount !== 1 ? "s" : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(NEXT_STATUSES[r.status] ?? []).map((t) => (
                    <Button
                      key={t.value}
                      size="sm"
                      variant={t.value === "ACTIVE" ? "default" : "outline"}
                      disabled={pending}
                      onClick={() => changeStatus(r.id, t.value)}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <label
            htmlFor="sessionId"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Inscrire à une session
          </label>
          <Select
            id="sessionId"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={pending || sessions.length === 0}
          >
            <option value="">
              {sessions.length === 0
                ? "Aucune session ouverte"
                : "Sélectionner une session…"}
            </option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id} disabled={s.full}>
                {s.label}
                {s.full
                  ? " — complète"
                  : s.seatsLeft !== null
                    ? ` — ${s.seatsLeft} place(s)`
                    : ""}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={register} disabled={pending || !selected}>
          Inscrire
        </Button>
      </div>
    </div>
  );
}
