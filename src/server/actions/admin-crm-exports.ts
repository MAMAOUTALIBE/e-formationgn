"use server";

import { requireAnyAdminRole } from "@/lib/auth/authorization";
import { rowsToCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";

type ExportResult = Promise<{ csv: string; filename: string } | { error: string }>;

export async function exportInstructorsCsv(): ExportResult {
  let actor;
  try { actor = await requireAnyAdminRole(); } catch { return { error: "Non autorisé." }; }
  const instructors = await prisma.user.findMany({
    where: { isInstructor: true }, orderBy: { createdAt: "desc" }, take: 5000,
    select: { id: true, name: true, email: true, status: true, stripeOnboardingDone: true, stripeAccountId: true, createdAt: true, _count: { select: { coursesAuthored: true } } },
  });
  const csv = rowsToCsv(instructors.map((row) => ({ id: row.id, nom: row.name ?? "", email: row.email, statut: row.status, stripe: row.stripeOnboardingDone ? "pret" : row.stripeAccountId ? "en_cours" : "non_configure", cours: row._count.coursesAuthored, inscritLe: row.createdAt.toISOString() })));
  await createAuditLog({ actorId: actor.userId, action: "instructor.export_csv", targetType: "User", targetId: null, metadata: { rowCount: instructors.length } });
  return { csv, filename: `formateurs-${new Date().toISOString().slice(0, 10)}.csv` };
}

export async function exportProgramsCsv(): ExportResult {
  let actor;
  try { actor = await requireAnyAdminRole(); } catch { return { error: "Non autorisé." }; }
  const programs = await prisma.program.findMany({ orderBy: { title: "asc" }, take: 5000, select: { id: true, title: true, code: true, durationHours: true, status: true, createdAt: true, _count: { select: { courses: true, sessions: true } } } });
  const csv = rowsToCsv(programs.map((row) => ({ id: row.id, formation: row.title, code: row.code ?? "", dureeHeures: row.durationHours ?? "", statut: row.status, cours: row._count.courses, sessions: row._count.sessions, creeLe: row.createdAt.toISOString() })));
  await createAuditLog({ actorId: actor.userId, action: "program.export_csv", targetType: "Program", targetId: null, metadata: { rowCount: programs.length } });
  return { csv, filename: `formations-${new Date().toISOString().slice(0, 10)}.csv` };
}
