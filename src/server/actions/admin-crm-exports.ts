"use server";

import { requireAnyAdminRole } from "@/lib/auth/authorization";
import type { AdminRole } from "@/lib/constants";
import { rowsToCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { ADMIN_NAV } from "@/lib/workspace/admin-nav";
import { sectionRolesForPath } from "@/lib/workspace/navigation";
import { createAuditLog } from "@/server/services/audit-log";

/**
 * Rôles autorisés sur un écran, lus dans le registre de navigation.
 *
 * Une Server Action s'appelle directement : restreindre un écran ne restreint
 * pas ce que l'écran déclenche. Les deux exports appelaient
 * `requireAnyAdminRole()` sans argument, donc ouverts aux cinq rôles
 * administratifs. Pour les formateurs cela correspondait à l'écran, qui les
 * admet tous ; pour les formations non — l'écran est réservé à
 * l'administrateur, au modérateur et au gestionnaire, si bien que le support
 * et la finance pouvaient exporter le catalogue de formations sans y avoir
 * accès.
 *
 * En lisant la même déclaration que la garde de route, les deux ne peuvent
 * plus diverger — ni aujourd'hui, ni quand les rôles d'un écran changeront.
 */
function rolesForScreen(pathname: string): AdminRole[] {
  return [...(sectionRolesForPath(ADMIN_NAV, pathname) ?? [])] as AdminRole[];
}

type ExportResult = Promise<{ csv: string; filename: string } | { error: string }>;

export async function exportInstructorsCsv(): ExportResult {
  let actor;
  try {
    actor = await requireAnyAdminRole(...rolesForScreen("/admin/formateurs"));
  } catch {
    return { error: "Non autorisé." };
  }
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
  try {
    actor = await requireAnyAdminRole(...rolesForScreen("/admin/formations"));
  } catch {
    return { error: "Non autorisé." };
  }
  const programs = await prisma.program.findMany({ orderBy: { title: "asc" }, take: 5000, select: { id: true, title: true, code: true, durationHours: true, status: true, createdAt: true, _count: { select: { courses: true, sessions: true } } } });
  const csv = rowsToCsv(programs.map((row) => ({ id: row.id, formation: row.title, code: row.code ?? "", dureeHeures: row.durationHours ?? "", statut: row.status, cours: row._count.courses, sessions: row._count.sessions, creeLe: row.createdAt.toISOString() })));
  await createAuditLog({ actorId: actor.userId, action: "program.export_csv", targetType: "Program", targetId: null, metadata: { rowCount: programs.length } });
  return { csv, filename: `formations-${new Date().toISOString().slice(0, 10)}.csv` };
}
