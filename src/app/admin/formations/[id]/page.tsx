import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProgramComposition } from "@/components/features/admin/program-composition";
import {
  ProgramForm,
  type ProgramFormValues,
} from "@/components/features/admin/program-form";
import { SessionForm } from "@/components/features/admin/session-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getProgramDetail,
  listAssignableCourses,
} from "@/server/queries/admin-programs";

export const metadata: Metadata = { title: "Fiche formation — CRM admin" };
export const dynamic = "force-dynamic";

const SESSION_STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  PLANNED: { label: "Planifiée", tone: "warning" },
  ACTIVE: { label: "En cours", tone: "success" },
  COMPLETED: { label: "Terminée", tone: "neutral" },
  CANCELLED: { label: "Annulée", tone: "neutral" },
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [program, assignable] = await Promise.all([
    getProgramDetail(id),
    listAssignableCourses(id),
  ]);
  if (!program) notFound();

  const values: ProgramFormValues = {
    title: program.title,
    code: program.code ?? "",
    description: program.description ?? "",
    durationHours: program.durationHours ? String(program.durationHours) : "",
    status: program.status,
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Formations", href: "/admin/formations" }, { label: program.title }]}
      />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{program.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {program.courses.length} cours · {program.sessions.length} session
          {program.sessions.length > 1 ? "s" : ""}
          {program.code ? ` · code ${program.code}` : ""}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parcours — cours de la formation</CardTitle>
          </CardHeader>
          <CardContent>
            <ProgramComposition
              programId={program.id}
              courses={program.courses.map((pc) => ({
                courseId: pc.courseId,
                title: pc.course.title,
                status: pc.course.status,
                position: pc.position,
              }))}
              assignable={assignable}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {program.sessions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                Aucune session. Les élèves s&apos;inscrivent à une session, jamais
                directement à la formation.
              </p>
            ) : (
              <ul className="space-y-2">
                {program.sessions.map((s) => {
                  const badge = SESSION_STATUS[s.status] ?? {
                    label: s.status,
                    tone: "neutral" as const,
                  };
                  return (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-foreground">
                        {s.reference ?? "Session"}
                      </span>
                      <span className="text-muted-foreground">
                        {dateFmt.format(s.startDate)} → {dateFmt.format(s.endDate)}
                      </span>
                      {s.location ? (
                        <span className="text-muted-foreground">· {s.location}</span>
                      ) : null}
                      {s.capacity ? (
                        <span className="text-muted-foreground">· {s.capacity} places</span>
                      ) : null}
                      <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                    </li>
                  );
                })}
              </ul>
            )}

            <SessionForm programId={program.id} />
          </CardContent>
        </Card>
      </div>

      <section className="max-w-3xl space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Informations</h2>
        <ProgramForm
          programId={program.id}
          defaultValues={values}
          cancelHref="/admin/formations"
        />
      </section>
    </div>
  );
}
