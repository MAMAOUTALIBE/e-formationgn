"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import type { ActionResult } from "./auth";

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false };
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.user.id },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath("/", "layout");
  return { success: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false };
  await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath("/", "layout");
  return { success: true };
}
