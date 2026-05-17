"use server";

// Server Actions admin — toutes vérifient le rôle ADMIN, journalisent
// l'action dans AuditLog, et notifient l'utilisateur impacté quand pertinent.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import {
  categorySchema,
  cmsPageSchema,
  commissionRateSchema,
  moderateCourseSchema,
  promoCodeSchema,
  userActionSchema,
} from "@/lib/validators/admin";

import type { ActionResult } from "./auth";

async function audit(
  actorId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      metadata: metadata as never,
    },
  });
}

// --- Modération des cours -------------------------------------------------

export async function moderateCourse(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = moderateCourseSchema.safeParse({
    courseId: formData.get("courseId"),
    action: formData.get("action"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const course = await prisma.course.findUnique({
    where: { id: parsed.data.courseId },
    select: { id: true, instructorId: true, slug: true, title: true, status: true },
  });
  if (!course) return { success: false, message: "Cours introuvable." };

  if (parsed.data.action === "approve") {
    await prisma.course.update({
      where: { id: course.id },
      data: { status: "PUBLISHED", publishedAt: new Date(), rejectionReason: null },
    });
    await prisma.notification.create({
      data: {
        userId: course.instructorId,
        kind: "COURSE_PUBLISHED",
        title: "Votre cours est publié",
        body: `« ${course.title} » est désormais visible dans le catalogue.`,
        url: `/cours/${course.slug}`,
      },
    });
  } else {
    await prisma.course.update({
      where: { id: course.id },
      data: {
        status: "REJECTED",
        rejectionReason: parsed.data.reason || "Non précisée.",
      },
    });
    await prisma.notification.create({
      data: {
        userId: course.instructorId,
        kind: "COURSE_REJECTED",
        title: "Votre cours nécessite des modifications",
        body: parsed.data.reason ?? "Non précisée.",
        url: `/formateur/cours/${course.id}`,
      },
    });
  }

  await audit(admin.userId, `course.${parsed.data.action}`, "Course", course.id, {
    reason: parsed.data.reason,
  });

  revalidatePath("/admin/cours");
  revalidatePath(`/admin/cours/${course.id}`);
  return { success: true, message: "Décision enregistrée." };
}

// --- Utilisateurs ---------------------------------------------------------

export async function applyUserAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = userActionSchema.safeParse({
    userId: formData.get("userId"),
    action: formData.get("action"),
  });
  if (!parsed.success) return { success: false, message: "Action invalide." };

  if (parsed.data.userId === admin.userId) {
    return { success: false, message: "Vous ne pouvez pas modifier votre propre compte." };
  }

  switch (parsed.data.action) {
    case "suspend":
      await prisma.user.update({
        where: { id: parsed.data.userId },
        data: { status: "SUSPENDED" },
      });
      break;
    case "reactivate":
      await prisma.user.update({
        where: { id: parsed.data.userId },
        data: { status: "ACTIVE" },
      });
      break;
    case "promote_admin":
      await prisma.user.update({
        where: { id: parsed.data.userId },
        data: { role: "ADMIN" },
      });
      break;
    case "demote_admin":
      await prisma.user.update({
        where: { id: parsed.data.userId },
        data: { role: "STUDENT" },
      });
      break;
  }

  await audit(admin.userId, `user.${parsed.data.action}`, "User", parsed.data.userId);
  revalidatePath("/admin/utilisateurs");
  return { success: true, message: "Action appliquée." };
}

// --- Catégories ------------------------------------------------------------

export async function upsertCategory(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = categorySchema.safeParse({
    id: formData.get("id") ?? undefined,
    slug: formData.get("slug"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    iconName: formData.get("iconName") ?? "",
    displayOrder: formData.get("displayOrder") ?? "0",
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  if (data.id) {
    await prisma.category.update({
      where: { id: data.id },
      data: {
        slug: data.slug,
        name: data.name,
        description: data.description ? data.description : null,
        iconName: data.iconName ? data.iconName : null,
        displayOrder: data.displayOrder,
        isActive: data.isActive,
      },
    });
    await audit(admin.userId, "category.update", "Category", data.id);
  } else {
    const created = await prisma.category.create({
      data: {
        slug: data.slug,
        name: data.name,
        description: data.description ? data.description : null,
        iconName: data.iconName ? data.iconName : null,
        displayOrder: data.displayOrder,
        isActive: data.isActive,
      },
    });
    await audit(admin.userId, "category.create", "Category", created.id);
  }
  revalidatePath("/admin/categories");
  revalidatePath("/categories");
  return { success: true, message: "Catégorie enregistrée." };
}

export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  // Ne pas supprimer une catégorie utilisée
  const count = await prisma.course.count({ where: { categoryId } });
  if (count > 0) {
    return {
      success: false,
      message: "Cette catégorie est utilisée par des cours. Désactivez-la plutôt.",
    };
  }
  await prisma.category.delete({ where: { id: categoryId } });
  await audit(admin.userId, "category.delete", "Category", categoryId);
  revalidatePath("/admin/categories");
  revalidatePath("/categories");
  return { success: true };
}

// --- Commissions -----------------------------------------------------------

export async function updateCommissionRate(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = commissionRateSchema.safeParse({
    source: formData.get("source"),
    rateBps: formData.get("rateBps"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  await prisma.commissionRate.upsert({
    where: { source: parsed.data.source },
    update: {
      rateBps: parsed.data.rateBps,
      description: parsed.data.description ? parsed.data.description : null,
    },
    create: {
      source: parsed.data.source,
      rateBps: parsed.data.rateBps,
      description: parsed.data.description ? parsed.data.description : null,
    },
  });
  await audit(admin.userId, "commission.update", "CommissionRate", parsed.data.source, {
    rateBps: parsed.data.rateBps,
  });
  revalidatePath("/admin/commissions");
  return { success: true, message: "Taux mis à jour." };
}

// --- Codes promo -----------------------------------------------------------

export async function upsertPromoCode(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = promoCodeSchema.safeParse({
    id: formData.get("id") ?? undefined,
    code: formData.get("code"),
    kind: formData.get("kind"),
    scope: formData.get("scope"),
    value: formData.get("value"),
    currency: formData.get("currency") || undefined,
    maxRedemptions: formData.get("maxRedemptions") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    endsAt: formData.get("endsAt") ?? "",
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;
  const writeData = {
    code: data.code,
    kind: data.kind,
    scope: data.scope,
    value: data.value,
    currency: data.kind === "FIXED_AMOUNT" ? (data.currency ?? "EUR") : null,
    maxRedemptions:
      data.maxRedemptions === undefined || data.maxRedemptions === ""
        ? null
        : Number(data.maxRedemptions),
    startsAt: data.startsAt && data.startsAt !== "" ? new Date(data.startsAt) : null,
    endsAt: data.endsAt && data.endsAt !== "" ? new Date(data.endsAt) : null,
    isActive: data.isActive,
  };
  if (data.id) {
    await prisma.promoCode.update({ where: { id: data.id }, data: writeData });
    await audit(admin.userId, "promo.update", "PromoCode", data.id);
  } else {
    const created = await prisma.promoCode.create({ data: writeData });
    await audit(admin.userId, "promo.create", "PromoCode", created.id);
  }
  revalidatePath("/admin/codes-promo");
  return { success: true, message: "Code promo enregistré." };
}

export async function deletePromoCode(promoId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.promoCode.delete({ where: { id: promoId } });
  await audit(admin.userId, "promo.delete", "PromoCode", promoId);
  revalidatePath("/admin/codes-promo");
  return { success: true };
}

// --- CMS -------------------------------------------------------------------

export async function upsertCmsPage(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = cmsPageSchema.safeParse({
    id: formData.get("id") ?? undefined,
    slug: formData.get("slug"),
    title: formData.get("title"),
    body: formData.get("body"),
    isPublished: formData.get("isPublished") === "on",
  });
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;
  const writeData = {
    slug: data.slug,
    title: data.title,
    body: data.body,
    isPublished: data.isPublished,
    publishedAt: data.isPublished ? new Date() : null,
  };
  if (data.id) {
    await prisma.cmsPage.update({ where: { id: data.id }, data: writeData });
    await audit(admin.userId, "cms.update", "CmsPage", data.id);
  } else {
    const created = await prisma.cmsPage.create({ data: writeData });
    await audit(admin.userId, "cms.create", "CmsPage", created.id);
  }
  revalidatePath("/admin/cms");
  revalidatePath(`/${data.slug}`);
  return { success: true, message: "Page enregistrée." };
}

export async function deleteCmsPage(pageId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.cmsPage.delete({ where: { id: pageId } });
  await audit(admin.userId, "cms.delete", "CmsPage", pageId);
  revalidatePath("/admin/cms");
  return { success: true };
}

// --- Action utilitaire pour redirection après modération -----------------

export async function approveCourseAndRedirect(courseId: string): Promise<void> {
  const fd = new FormData();
  fd.set("courseId", courseId);
  fd.set("action", "approve");
  await moderateCourse(fd);
  redirect("/admin/cours");
}
