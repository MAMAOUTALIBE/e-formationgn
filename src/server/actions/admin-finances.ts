"use server";

// Server Actions Finances : remboursements via Stripe + déclenchement payouts.

import { revalidatePath } from "next/cache";

import { requireAnyAdminRole } from "@/lib/auth/authorization";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";

import type { ActionResult } from "./auth";

const requireFinanceRole = () => requireAnyAdminRole("ADMIN", "FINANCE");

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
    select: {
      stripePaymentIntentId: true,
      totalCents: true,
      status: true,
      items: {
        select: {
          id: true,
          totalCents: true,
          instructorPayoutCents: true,
          stripeTransferId: true,
        },
      },
    },
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
  // 1) Refund au client
  const refund = await stripe.refunds.create({
    payment_intent: order.stripePaymentIntentId,
    amount: amountCents,
    reason: "requested_by_customer",
    metadata: { orderId, adminId: admin.userId, ...(reason ? { reason } : {}) },
  });

  // 2) Reverse transfer côté formateur — pro rata par ligne et par transfer
  // Pour chaque OrderItem ayant un stripeTransferId, on calcule la part
  // correspondant à la portion remboursée et on crée un TransferReversal.
  const ratio = amountCents / order.totalCents;
  const reversals: Array<{ transferId: string; reversedCents: number; itemId: string }> = [];
  for (const item of order.items) {
    if (!item.stripeTransferId) continue;
    const reverseAmount = Math.round(item.instructorPayoutCents * ratio);
    if (reverseAmount <= 0) continue;
    try {
      const reversal = await stripe.transfers.createReversal(item.stripeTransferId, {
        amount: reverseAmount,
        metadata: { orderId, itemId: item.id, refundId: refund.id },
      });
      reversals.push({
        transferId: item.stripeTransferId,
        reversedCents: reverseAmount,
        itemId: item.id,
      });
      // Note : on ne décrémente pas instructorPayoutCents pour préserver
      // l'historique. Le reverse transfer est tracé dans Stripe et l'audit.
      void reversal;
    } catch (error) {
      logError("refund", error, {
        operation: "reverse_transfer",
        transferId: item.stripeTransferId,
        itemId: item.id,
      });
    }
  }

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

  await audit(admin.userId, "order.refund", "Order", orderId, {
    amountCents,
    refundId: refund.id,
    reversals,
  });

  revalidatePath("/admin/finances/transactions");
  revalidatePath("/admin/finances/remboursements");
  return {
    success: true,
    message:
      reversals.length > 0
        ? `Remboursement initié, ${reversals.length} reverse transfer(s) côté formateur.`
        : "Remboursement Stripe initié (aucun transfer formateur à inverser).",
  };
}

export async function markPayoutPaid(payoutId: string): Promise<ActionResult> {
  const admin = await requireFinanceRole();
  await prisma.payout.update({
    where: { id: payoutId },
    data: { status: "PAID", paidAt: new Date() },
  });
  await audit(admin.userId, "payout.mark-paid", "Payout", payoutId);
  revalidatePath("/admin/finances/payouts");
  return { success: true, message: "Payout marqué comme payé." };
}
