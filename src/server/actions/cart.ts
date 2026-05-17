"use server";

// Server Actions du panier — toutes nécessitent une session valide.
// Les ajouts/retraits sont idempotents grâce à la contrainte unique
// (userId, courseId) sur CartItem.

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  checkUserRateLimit,
  rateLimitMessage,
} from "@/lib/auth/rate-limit-ip";
import { requireSession } from "@/lib/auth/authorization";
import { writeCurrencyCookie } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { setCurrencySchema } from "@/lib/validators/checkout";
import { isUserEnrolledIn } from "@/server/queries/cart";

import type { ActionResult } from "./auth";

export async function addCourseToCart(courseId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return {
      success: false,
      message: "Vous devez être connecté pour ajouter un cours au panier.",
    };
  }

  const rl = await checkUserRateLimit({
    prefix: "cart:add",
    userId: session.user.id,
    windowMs: 60_000,
    max: 60,
  });
  if (!rl.ok) return { success: false, message: rateLimitMessage(rl.resetAt) };

  // Empêche d'acheter un cours déjà possédé.
  if (await isUserEnrolledIn(session.user.id, courseId)) {
    return {
      success: false,
      message: "Vous êtes déjà inscrit à ce cours.",
    };
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, status: true, instructorId: true },
  });
  if (!course || course.status !== "PUBLISHED") {
    return { success: false, message: "Ce cours n'est pas disponible." };
  }
  if (course.instructorId === session.user.id) {
    return {
      success: false,
      message: "Vous ne pouvez pas acheter votre propre cours.",
    };
  }

  await prisma.cartItem.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    update: {},
    create: { userId: session.user.id, courseId },
  });

  revalidatePath("/panier");
  revalidatePath("/", "layout");
  return { success: true, message: "Cours ajouté au panier." };
}

export async function removeCourseFromCart(courseId: string): Promise<ActionResult> {
  const { userId } = await requireSession();
  await prisma.cartItem.deleteMany({ where: { userId, courseId } });
  revalidatePath("/panier");
  revalidatePath("/", "layout");
  return { success: true, message: "Article retiré du panier." };
}

export async function clearCart(): Promise<ActionResult> {
  const { userId } = await requireSession();
  await prisma.cartItem.deleteMany({ where: { userId } });
  revalidatePath("/panier");
  revalidatePath("/", "layout");
  return { success: true, message: "Panier vidé." };
}

// ---------------------------------------------------------------------------
// Toggle de devise (cookie + sync DB si connecté)
// ---------------------------------------------------------------------------

export async function setCurrency(formData: FormData): Promise<void> {
  const parsed = setCurrencySchema.safeParse({ currency: formData.get("currency") });
  if (!parsed.success) return;

  await writeCurrencyCookie(parsed.data.currency);

  const session = await auth();
  if (session?.user) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { preferredCurrency: parsed.data.currency },
    });
  }

  revalidatePath("/", "layout");
}
