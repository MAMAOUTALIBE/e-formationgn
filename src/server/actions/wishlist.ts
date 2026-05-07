"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import type { ActionResult } from "./auth";

export async function toggleWishlist(courseId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return {
      success: false,
      message: "Vous devez être connecté pour utiliser la wishlist.",
    };
  }
  const userId = session.user.id;

  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    revalidatePath("/apprentissage");
    revalidatePath(`/cours`);
    return { success: true, message: "Retiré de votre liste de souhaits." };
  }

  await prisma.wishlistItem.create({ data: { userId, courseId } });
  revalidatePath("/apprentissage");
  return { success: true, message: "Ajouté à votre liste de souhaits." };
}

export async function isCourseInWishlist(courseId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;
  const item = await prisma.wishlistItem.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    select: { id: true },
  });
  return Boolean(item);
}
