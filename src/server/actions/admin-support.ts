"use server";

// Server Actions Support : tickets, messages, litiges.

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type {
  DisputeStatus,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@/generated/prisma/enums";

import type { ActionResult } from "./auth";

async function requireSupportRole() {
  const session = await auth();
  if (!session?.user) throw new Error("Connectez-vous.");
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPPORT") {
    throw new Error("Réservé aux admins et au rôle Support.");
  }
  return session.user;
}

async function audit(actorId: string, action: string, targetType: string, targetId: string) {
  await prisma.auditLog.create({
    data: { actorId, action, targetType, targetId },
  });
}

export async function createTicketReply(
  ticketId: string,
  body: string,
  isInternalNote = false,
): Promise<ActionResult> {
  const user = await requireSupportRole();
  if (body.trim().length < 2) {
    return { success: false, message: "Message trop court." };
  }
  await prisma.ticketMessage.create({
    data: { ticketId, authorId: user.id, body, isInternalNote },
  });
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date() },
  });
  await audit(user.id, "ticket.reply", "SupportTicket", ticketId);
  revalidatePath(`/admin/support/tickets/${ticketId}`);
  return { success: true };
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
): Promise<ActionResult> {
  const user = await requireSupportRole();
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status,
      ...(status === "CLOSED" || status === "RESOLVED"
        ? { closedAt: new Date() }
        : { closedAt: null }),
    },
  });
  await audit(user.id, "ticket.status-change", "SupportTicket", ticketId);
  revalidatePath(`/admin/support/tickets/${ticketId}`);
  revalidatePath("/admin/support");
  return { success: true };
}

export async function assignTicket(
  ticketId: string,
  assigneeId: string | null,
): Promise<ActionResult> {
  const user = await requireSupportRole();
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { assigneeId },
  });
  await audit(user.id, "ticket.assign", "SupportTicket", ticketId);
  revalidatePath(`/admin/support/tickets/${ticketId}`);
  return { success: true };
}

export async function setTicketPriority(
  ticketId: string,
  priority: TicketPriority,
): Promise<ActionResult> {
  const user = await requireSupportRole();
  await prisma.supportTicket.update({ where: { id: ticketId }, data: { priority } });
  await audit(user.id, "ticket.priority", "SupportTicket", ticketId);
  revalidatePath(`/admin/support/tickets/${ticketId}`);
  return { success: true };
}

export async function createTicket(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSupportRole();
  const subject = String(formData.get("subject") ?? "").trim();
  const category = (String(formData.get("category") ?? "OTHER") as TicketCategory);
  const requesterId = String(formData.get("requesterId") ?? "");
  if (!subject || !requesterId) {
    return { success: false, message: "Sujet et demandeur requis." };
  }
  const ticket = await prisma.supportTicket.create({
    data: { subject, category, requesterId, assigneeId: user.id },
  });
  await audit(user.id, "ticket.create", "SupportTicket", ticket.id);
  revalidatePath("/admin/support");
  return { success: true, message: "Ticket créé." };
}

// --- Litiges ---------------------------------------------------------------

export async function updateDisputeStatus(
  disputeId: string,
  status: DisputeStatus,
  resolution?: string,
): Promise<ActionResult> {
  const user = await requireSupportRole();
  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status,
      resolution: resolution ?? undefined,
      resolvedAt: status.startsWith("RESOLVED") ? new Date() : null,
    },
  });
  await audit(user.id, "dispute.status", "Dispute", disputeId);
  revalidatePath("/admin/support/litiges");
  return { success: true };
}
