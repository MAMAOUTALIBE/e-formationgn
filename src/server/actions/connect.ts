"use server";

// Server Actions Stripe Connect (côté formateur).
//
// Flux d'onboarding :
//   1. createInstructorOnboardingLink() : si pas de stripeAccountId, on crée
//      un Express Account Stripe puis on retourne un onboarding link.
//   2. Le formateur complète le formulaire hébergé Stripe.
//   3. À son retour, la page /formateur/paiements appelle
//      refreshInstructorAccountStatus() pour relire le statut depuis Stripe.

import { redirect } from "next/navigation";

import { requireInstructorOrAdmin } from "@/lib/auth/authorization";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const requireInstructor = requireInstructorOrAdmin;

export async function createInstructorOnboardingLink(): Promise<void> {
  if (!isStripeConfigured()) {
    throw new Error("Stripe n'est pas configuré sur le serveur.");
  }
  const user = await requireInstructor();
  const stripe = getStripeClient();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { id: true, email: true, stripeAccountId: true },
  });
  if (!dbUser) throw new Error("Utilisateur introuvable.");

  let accountId = dbUser.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: dbUser.email,
      metadata: { userId: dbUser.id },
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
    });
    accountId = account.id;
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { stripeAccountId: accountId, stripeAccountStatus: "pending" },
    });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${APP_URL}/formateur/paiements?refresh=1`,
    return_url: `${APP_URL}/formateur/paiements?return=1`,
    type: "account_onboarding",
  });

  redirect(link.url);
}

export interface InstructorAccountStatus {
  hasAccount: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  status: "none" | "pending" | "active" | "restricted";
}

export async function refreshInstructorAccountStatus(): Promise<InstructorAccountStatus> {
  const user = await requireInstructor();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { stripeAccountId: true },
  });
  if (!dbUser?.stripeAccountId || !isStripeConfigured()) {
    return {
      hasAccount: false,
      detailsSubmitted: false,
      payoutsEnabled: false,
      chargesEnabled: false,
      status: "none",
    };
  }

  const stripe = getStripeClient();
  const account = await stripe.accounts.retrieve(dbUser.stripeAccountId);
  const detailsSubmitted = Boolean(account.details_submitted);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const chargesEnabled = Boolean(account.charges_enabled);

  const status: InstructorAccountStatus["status"] =
    payoutsEnabled && chargesEnabled
      ? "active"
      : detailsSubmitted
        ? "restricted"
        : "pending";

  await prisma.user.update({
    where: { id: user.userId },
    data: {
      stripeAccountStatus: status,
      stripeOnboardingDone: payoutsEnabled && chargesEnabled,
    },
  });

  return {
    hasAccount: true,
    detailsSubmitted,
    payoutsEnabled,
    chargesEnabled,
    status,
  };
}

export async function openInstructorDashboardLink(): Promise<void> {
  if (!isStripeConfigured()) throw new Error("Stripe non configuré.");
  const user = await requireInstructor();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { stripeAccountId: true },
  });
  if (!dbUser?.stripeAccountId) throw new Error("Aucun compte Stripe connecté.");

  const stripe = getStripeClient();
  const link = await stripe.accounts.createLoginLink(dbUser.stripeAccountId);
  redirect(link.url);
}
