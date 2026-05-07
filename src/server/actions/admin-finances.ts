"use server";

// Server Actions Finances : remboursements via Stripe + déclenchement payouts.

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";

import type { ActionResult } from "./auth";

async function requireFinanceRole() {
  const session = await auth();
  if (!session?.user) throw new Error("Connectez-vous.");
  if (session.user.role !== "ADMIN" && session.user.role !== "FINANCE") {
    throw new Error("Réservé aux admins et au rôle Finance.");
  }
  return session.user;
}

async function audit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      targetType,
      targetId,
      metadata: (metadata as never) ?? undefined,
    },
  });
}

export async function refundOrder(
  orderId: string,
  amountCents: number,
  reason?: string,
): Promise<ActionResult> {
  const admin = await requireFinanceRole();
  if (!isStripeConfigured()) {
    return { success: false, message: "Stripe n'est pas configuré." };
  }
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { stripePaymentIntentId: true, totalCents: true, status: true },
  });
  if (!order) return { success: false, message: "Commande introuvable." };
  if (!order.stripePaymentIntentId) {
    return {
      success: false,
      message: "Aucun PaymentIntent Stripe sur cette commande.",
    };
  }
  if (amountCents <= 0 || amountCents > order.totalCents) {
    return { success: false, message: "Montant invalide." };
  }

  const stripe = getStripeClient();
  const refund = await stripe.refunds.create({
    payment_intent: order.stripePaymentIntentId,
    amount: amountCents,
    reason: "requested_by_customer",
    metadata: { orderId, adminId: admin.id, ...(reason ? { reason } : {}) },
  });

  await prisma.refund.create({
    data: {
      orderId,
      amountCents,
      reason: reason ?? null,
      stripeRefundId: refund.id,
    },
  });
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: amountCents === order.totalCents ? "REFUNDED" : "PARTIALLY_REFUNDED",
    },
  });

  await audit(admin.id, "order.refund", "Order", orderId, {
    amountCents,
    refundId: refund.id,
  });

  revalidatePath("/admin/finances/transactions");
  revalidatePath("/admin/finances/remboursements");
  return { success: true, message: "Remboursement Stripe initié." };
}

export async function markPayoutPaid(payoutId: string): Promise<ActionResult> {
  const admin = await requireFinanceRole();
  await prisma.payout.update({
    where: { id: payoutId },
    data: { status: "PAID", paidAt: new Date() },
  });
  await audit(admin.id, "payout.mark-paid", "Payout", payoutId);
  revalidatePath("/admin/finances/payouts");
  return { success: true, message: "Payout marqué comme payé." };
}
