"use server";

// Server Action dédiée à la réorganisation des catégories par drag-and-drop.

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";

interface ReorderResult {
  success: boolean;
  message?: string;
}

export async function reorderCategories(
  orderedIds: string[],
): Promise<ReorderResult> {
  const admin = await requireAdmin();
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { success: false, message: "Liste vide." };
  }

  // Vérifie que tous les IDs existent (anti-injection).
  const existing = await prisma.category.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true },
  });
  if (existing.length !== orderedIds.length) {
    return { success: false, message: "Une ou plusieurs catégories invalides." };
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.category.update({
        where: { id },
        data: { displayOrder: index },
      }),
    ),
  );

  await createAuditLog({
    actorId: admin.userId,
    action: "category.reorder",
    targetType: "Category",
    targetId: orderedIds[0],
    metadata: { count: orderedIds.length },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/categories");
  return { success: true };
}
