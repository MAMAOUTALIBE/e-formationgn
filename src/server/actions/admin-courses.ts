"use server";

// Server Actions admin pour la gestion des cours.

import { revalidatePath, updateTag } from "next/cache";

import { requireAnyAdminRole } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";

import type { ActionResult } from "./auth";

// Invalide les caches publics (home, /cours, /categories) qui dépendent du
// catalogue. À appeler après tout passage PUBLISHED ↔ DRAFT/ARCHIVED/REJECTED
// ou changement de mise en avant.
function invalidateCatalogCaches() {
  updateTag("courses");
  updateTag("categories");
  revalidatePath("/");
  revalidatePath("/cours");
}

// Modération de cours : ADMIN ou MODERATOR.
const requireAdmin = () => requireAnyAdminRole("ADMIN", "MODERATOR");

async function audit(
  actorId: string,
  action: string,
  targetId: string,
  metadata?: Record<string, unknown>,
) {
  await createAuditLog({
    actorId,
    action,
    targetType: "Course",
    targetId,
    metadata: metadata ?? null,
  });
}

export async function approveCourse(courseId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.course.update({
    where: { id: courseId },
    data: { status: "PUBLISHED", publishedAt: new Date(), rejectionReason: null },
  });
  await audit(admin.userId, "course.approve", courseId);
  revalidatePath("/admin/cours");
  revalidatePath("/admin/cours/moderation");
  invalidateCatalogCaches();
  return { success: true, message: "Cours publié." };
}

export async function rejectCourse(
  courseId: string,
  reason: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (reason.trim().length < 10) {
    return {
      success: false,
      message: "Le motif de rejet doit faire au moins 10 caractères.",
    };
  }
  await prisma.course.update({
    where: { id: courseId },
    data: { status: "REJECTED", rejectionReason: reason },
  });
  await audit(admin.userId, "course.reject", courseId, { reason });
  revalidatePath("/admin/cours");
  revalidatePath("/admin/cours/moderation");
  return { success: true, message: "Cours rejeté." };
}

export async function unpublishCourse(courseId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.course.update({
    where: { id: courseId },
    data: { status: "ARCHIVED" },
  });
  await audit(admin.userId, "course.unpublish", courseId);
  revalidatePath("/admin/cours");
  invalidateCatalogCaches();
  return { success: true, message: "Cours archivé." };
}

export async function toggleFeaturedCourse(
  courseId: string,
  featured: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  let nextOrder: number | null = null;
  if (featured) {
    const max = await prisma.course.aggregate({
      _max: { featuredOrder: true },
      where: { isFeatured: true },
    });
    nextOrder = (max._max.featuredOrder ?? 0) + 1;
  }
  await prisma.course.update({
    where: { id: courseId },
    data: {
      isFeatured: featured,
      featuredOrder: featured ? nextOrder : null,
    },
  });
  await audit(admin.userId, "course.feature", courseId, { featured });
  revalidatePath("/admin/cours");
  revalidatePath("/admin/cours/featured");
  invalidateCatalogCaches();
  return { success: true, message: featured ? "Cours mis en avant." : "Retiré de la vitrine." };
}

export async function bulkUnpublish(courseIds: string[]): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (courseIds.length === 0) {
    return { success: false, message: "Aucun cours sélectionné." };
  }
  await prisma.course.updateMany({
    where: { id: { in: courseIds } },
    data: { status: "ARCHIVED" },
  });
  for (const id of courseIds) {
    await audit(admin.userId, "course.bulk-unpublish", id);
  }
  revalidatePath("/admin/cours");
  return {
    success: true,
    message: `${courseIds.length} cours archivés.`,
  };
}

export async function bulkChangeCategory(
  courseIds: string[],
  categoryId: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (courseIds.length === 0) {
    return { success: false, message: "Aucun cours sélectionné." };
  }
  await prisma.course.updateMany({
    where: { id: { in: courseIds } },
    data: { categoryId },
  });
  for (const id of courseIds) {
    await audit(admin.userId, "course.bulk-category", id, { categoryId });
  }
  revalidatePath("/admin/cours");
  return {
    success: true,
    message: `${courseIds.length} cours déplacés.`,
  };
}

export async function setInternalNotesOnCourse(
  courseId: string,
  notes: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.course.update({
    where: { id: courseId },
    data: { internalNotes: notes.trim() || null },
  });
  await audit(admin.userId, "course.internal-notes", courseId);
  revalidatePath(`/admin/cours/${courseId}`);
  return { success: true, message: "Notes internes enregistrées." };
}
