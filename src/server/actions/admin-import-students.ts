"use server";

// Import d'une promotion entière : création des comptes en lot, avec
// attribution optionnelle de formations dans la foulée.
//
// Plafond volontaire (MAX_IMPORT_ROWS = 50). Chaque compte exige un hachage
// bcrypt à coût 12, mesuré à ~300 ms : 50 lignes représentent déjà une
// quinzaine de secondes de calcul. Au-delà, l'action deviendrait assez longue
// pour ressembler à un blocage et monopoliserait le CPU du serveur. Une
// promotion plus grande se découpe en deux imports — c'est le compromis
// honnête entre confort et santé du service.

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/authorization";
import { hashPassword } from "@/lib/auth/password";
import {
  MAX_IMPORT_ROWS,
  parseStudentCsv,
  type ParsedStudentRow,
} from "@/lib/admin/csv-students";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";
import { generateTemporaryPassword } from "@/server/services/temporary-password";

import type { ActionResult } from "./auth";

export interface CreatedAccount {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface ImportStudentsResult extends ActionResult {
  created?: CreatedAccount[];
  /** Lignes ignorées : compte déjà existant, ou ligne mal formée. */
  skipped?: Array<{ line: number; reason: string }>;
  grantedCourses?: string[];
}

export async function importStudents(
  _prev: ImportStudentsResult,
  formData: FormData,
): Promise<ImportStudentsResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { success: false, message: "Non autorisé." };
  }

  const raw = String(formData.get("csv") ?? "");
  if (raw.trim() === "") {
    return { success: false, message: "Collez d'abord une liste d'élèves." };
  }

  const { rows, errors } = parseStudentCsv(raw);
  const skipped = [...errors];

  if (rows.length === 0) {
    return {
      success: false,
      message: "Aucune ligne exploitable dans cette liste.",
      skipped,
    };
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      success: false,
      message: `${rows.length} lignes détectées : l'import est limité à ${MAX_IMPORT_ROWS} à la fois. Découpez votre liste.`,
      skipped,
    };
  }

  // Comptes déjà présents : on les écarte plutôt que d'échouer sur la
  // contrainte d'unicité au milieu du lot, ce qui laisserait un import à
  // moitié fait sans dire lesquels sont passés.
  const existing = await prisma.user.findMany({
    where: { email: { in: rows.map((r) => r.email) } },
    select: { email: true },
  });
  const existingEmails = new Set(existing.map((e) => e.email));

  const toCreate: ParsedStudentRow[] = [];
  for (const row of rows) {
    if (existingEmails.has(row.email)) {
      skipped.push({ line: row.line, reason: `Compte déjà existant : ${row.email}.` });
      continue;
    }
    toCreate.push(row);
  }

  if (toCreate.length === 0) {
    return {
      success: false,
      message: "Tous ces comptes existent déjà.",
      skipped,
    };
  }

  // Formations à attribuer aux comptes créés (facultatif).
  const courseIds = formData.getAll("courseIds").map(String).filter(Boolean);
  const courses = courseIds.length
    ? await prisma.course.findMany({
        where: { id: { in: courseIds }, status: "PUBLISHED" },
        select: { id: true, title: true },
      })
    : [];

  const created: CreatedAccount[] = [];

  for (const row of toCreate) {
    const password = generateTemporaryPassword();
    const user = await prisma.user.create({
      data: {
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        name: `${row.firstName} ${row.lastName}`,
        hashedPassword: await hashPassword(password),
        role: "STUDENT",
        isInstructor: false,
        status: "ACTIVE",
        emailVerified: new Date(),
        mustChangePassword: false,
      },
      select: { id: true },
    });

    if (courses.length > 0) {
      await prisma.enrollment.createMany({
        data: courses.map((c) => ({
          userId: user.id,
          courseId: c.id,
          source: "ADMIN_GRANT" as const,
        })),
        skipDuplicates: true,
      });
    }

    created.push({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      password,
    });
  }

  await createAuditLog({
    actorId: session.userId,
    action: "user.bulk_import",
    targetType: "User",
    targetId: null,
    metadata: {
      createdCount: created.length,
      skippedCount: skipped.length,
      courses: courses.map((c) => c.title),
    },
  });

  revalidatePath("/admin/utilisateurs");

  return {
    success: true,
    message: `${created.length} compte${created.length > 1 ? "s" : ""} créé${created.length > 1 ? "s" : ""}.`,
    created,
    skipped,
    grantedCourses: courses.map((c) => c.title),
  };
}
