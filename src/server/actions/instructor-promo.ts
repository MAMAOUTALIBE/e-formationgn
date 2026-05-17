"use server";

// Server Actions pour la gestion des codes promo côté formateur.
// Règles d'autorisation strictes :
//   - Le formateur connecté ne peut créer/lister/supprimer QUE ses propres
//     codes (PromoCode.instructorId === userId).
//   - Tous les courseIds doivent appartenir au formateur (vérification DB).
//   - Le scope est forcé à COURSE_SPECIFIC (pas de codes globaux).
//   - Pas d'accès aux codes plateforme (instructorId = null).

import { revalidatePath } from "next/cache";

import { requireInstructorOrAdmin } from "@/lib/auth/authorization";
import { instructorPromoCreateSchema } from "@/lib/validators/instructor-promo";
import { prisma } from "@/lib/prisma";

import type { ActionResult } from "./auth";

const requireInstructorUser = requireInstructorOrAdmin;

export async function createInstructorPromoCode(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireInstructorUser();

  const parsed = instructorPromoCreateSchema.safeParse({
    code: formData.get("code"),
    kind: formData.get("kind"),
    value: formData.get("value"),
    currency: formData.get("currency") || undefined,
    courseIds: formData.getAll("courseIds").map(String),
    maxRedemptions: formData.get("maxRedemptions") ?? "",
    endsAt: formData.get("endsAt") ?? "",
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  // Vérifie que tous les courseIds appartiennent au formateur connecté.
  const ownedCount = await prisma.course.count({
    where: { id: { in: data.courseIds }, instructorId: user.userId },
  });
  if (ownedCount !== data.courseIds.length) {
    return {
      success: false,
      message:
        "Un ou plusieurs cours sélectionnés ne vous appartiennent pas. Rafraîchissez la page.",
    };
  }

  // Code unique global — anti-collision.
  const existing = await prisma.promoCode.findUnique({
    where: { code: data.code },
    select: { id: true },
  });
  if (existing) {
    return {
      success: false,
      fieldErrors: { code: ["Ce code est déjà utilisé. Choisissez-en un autre."] },
    };
  }

  await prisma.promoCode.create({
    data: {
      code: data.code,
      kind: data.kind,
      scope: "COURSE_SPECIFIC",
      value: data.value,
      currency: data.kind === "FIXED_AMOUNT" ? (data.currency ?? "EUR") : null,
      maxRedemptions:
        data.maxRedemptions === undefined || data.maxRedemptions === ""
          ? null
          : Number(data.maxRedemptions),
      endsAt: data.endsAt && data.endsAt !== "" ? new Date(data.endsAt) : null,
      isActive: data.isActive,
      instructorId: user.userId,
      courses: {
        create: data.courseIds.map((courseId) => ({ courseId })),
      },
    },
  });

  revalidatePath("/formateur/codes-promo");
  return { success: true, message: "Code promo créé." };
}

export async function deleteInstructorPromoCode(promoId: string): Promise<ActionResult> {
  const user = await requireInstructorUser();

  // Charge + vérifie la propriété en une seule query.
  const promo = await prisma.promoCode.findFirst({
    where: { id: promoId, instructorId: user.userId },
    select: { id: true },
  });
  if (!promo) {
    return { success: false, message: "Code introuvable ou non autorisé." };
  }

  await prisma.promoCode.delete({ where: { id: promo.id } });
  revalidatePath("/formateur/codes-promo");
  return { success: true };
}

export async function toggleInstructorPromoCode(
  promoId: string,
  active: boolean,
): Promise<ActionResult> {
  const user = await requireInstructorUser();
  const promo = await prisma.promoCode.findFirst({
    where: { id: promoId, instructorId: user.userId },
    select: { id: true },
  });
  if (!promo) return { success: false, message: "Code introuvable ou non autorisé." };
  await prisma.promoCode.update({ where: { id: promo.id }, data: { isActive: active } });
  revalidatePath("/formateur/codes-promo");
  return { success: true };
}
