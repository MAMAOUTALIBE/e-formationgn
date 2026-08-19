"use server";

// Server Actions pour les annonces formateur — créer, supprimer.
// Une annonce est envoyée à TOUS les inscrits d'un cours (pattern Udemy
// "Course announcements"). Visible côté élève dans /apprentissage > onglet
// Annonces.

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";

import type { ActionResult } from "./auth";

const MAX_TITLE = 120;
const MAX_BODY = 5000;

async function requireCourseOwnership(courseId: string, userId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { instructorId: true },
  });
  if (!course) throw new Error("Formation introuvable.");
  if (course.instructorId !== userId) throw new Error("Action non autorisée.");
}

export async function createAnnouncement(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, message: "Connectez-vous." };

  const courseId = String(formData.get("courseId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!courseId) return { success: false, message: "courseId manquant." };
  if (title.length < 3 || title.length > MAX_TITLE) {
    return { success: false, message: `Titre entre 3 et ${MAX_TITLE} caractères.` };
  }
  if (body.length < 10 || body.length > MAX_BODY) {
    return { success: false, message: `Message entre 10 et ${MAX_BODY} caractères.` };
  }

  try {
    await requireCourseOwnership(courseId, session.user.id);
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }

  const announcement = await prisma.courseAnnouncement.create({
    data: { courseId, authorId: session.user.id, title, body },
  });

  await createAuditLog({
    actorId: session.user.id,
    action: "instructor.announcement.create",
    targetType: "CourseAnnouncement",
    targetId: announcement.id,
    metadata: { courseId, titleLen: title.length, bodyLen: body.length },
  });

  revalidatePath(`/formateur/cours/${courseId}/annonces`);
  revalidatePath(`/apprentissage/[slug]`, "page");
  return { success: true, message: "Annonce publiée." };
}

export async function deleteAnnouncement(
  announcementId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, message: "Connectez-vous." };

  const existing = await prisma.courseAnnouncement.findUnique({
    where: { id: announcementId },
    select: { authorId: true, courseId: true, course: { select: { instructorId: true } } },
  });
  if (!existing) return { success: false, message: "Annonce introuvable." };
  if (existing.course.instructorId !== session.user.id) {
    return { success: false, message: "Action non autorisée." };
  }

  await prisma.courseAnnouncement.delete({ where: { id: announcementId } });

  await createAuditLog({
    actorId: session.user.id,
    action: "instructor.announcement.delete",
    targetType: "CourseAnnouncement",
    targetId: announcementId,
    metadata: { courseId: existing.courseId },
  });

  revalidatePath(`/formateur/cours/${existing.courseId}/annonces`);
  return { success: true, message: "Annonce supprimée." };
}
