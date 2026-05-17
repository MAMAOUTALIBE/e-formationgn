"use server";

// Server Actions Support : tickets, messages, litiges.

import { revalidatePath } from "next/cache";

import { requireAnyAdminRole } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import type {
  DisputeStatus,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@/generated/prisma/enums";

import type { ActionResult } from "./auth";

const requireSupportRole = () => requireAnyAdminRole("ADMIN", "SUPPORT");

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
    data: { ticketId, authorId: user.userId, body, isInternalNote },
  });
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date() },
  });
  await audit(user.userId, "ticket.reply", "SupportTicket", ticketId);
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
  await audit(user.userId, "ticket.status-change", "SupportTicket", ticketId);
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
  await audit(user.userId, "ticket.assign", "SupportTicket", ticketId);
  revalidatePath(`/admin/support/tickets/${ticketId}`);
  return { success: true };
}

export async function setTicketPriority(
  ticketId: string,
  priority: TicketPriority,
): Promise<ActionResult> {
  const user = await requireSupportRole();
  await prisma.supportTicket.update({ where: { id: ticketId }, data: { priority } });
  await audit(user.userId, "ticket.priority", "SupportTicket", ticketId);
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
    data: { subject, category, requesterId, assigneeId: user.userId },
  });
  await audit(user.userId, "ticket.create", "SupportTicket", ticket.id);
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
  await audit(user.userId, "dispute.status", "Dispute", disputeId);
  revalidatePath("/admin/support/litiges");
  return { success: true };
}
