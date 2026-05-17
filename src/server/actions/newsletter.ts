"use server";

// Inscription newsletter — RGPD-compatible :
//   - consentement explicite obligatoire (case à cocher serveur-vérifiée)
//   - IP hashée (jamais stockée en clair)
//   - upsert idempotent (re-inscription d'un email déjà unsubscribed = OK)
//   - rate-limit IP (5 / heure) pour empêcher l'inscription massive
//   - validation Zod stricte (email + source enum)

import { randomBytes } from "node:crypto";

import { headers } from "next/headers";
import { z } from "zod";

import { checkIpRateLimit, clientIpHash, rateLimitMessage } from "@/lib/auth/rate-limit-ip";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { validateFormData } from "@/lib/validators/form-data";

import type { ActionResult } from "./auth";

/** Génère un token URL-safe de ~43 caractères (32 octets en base64url). */
function generateUnsubscribeToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface UnsubscribeResult {
  ok: boolean;
  message: string;
  /** Email anonymisé (a***@example.com) pour confirmation visuelle. */
  emailMasked?: string;
}

/**
 * Désinscription via token public (envoyé dans chaque email newsletter).
 * Pas d'auth requise — accessible directement depuis un client mail.
 * Idempotent : appeler 2× n'erreure pas. Pas d'info sur l'email réel
 * dans le retour (juste masqué) → anti-énumération si token deviné.
 */
export async function unsubscribeNewsletterByToken(
  token: string,
): Promise<UnsubscribeResult> {
  if (!token || token.length < 10) {
    return { ok: false, message: "Lien de désinscription invalide." };
  }

  const subscription = await prisma.newsletterSubscription.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true, email: true, unsubscribedAt: true },
  });

  if (!subscription) {
    return { ok: false, message: "Ce lien de désinscription n'est pas valide." };
  }

  if (subscription.unsubscribedAt) {
    return {
      ok: true,
      message: "Vous étiez déjà désinscrit. Aucun email ne vous sera envoyé.",
      emailMasked: maskEmail(subscription.email),
    };
  }

  await prisma.newsletterSubscription.update({
    where: { id: subscription.id },
    data: { unsubscribedAt: new Date() },
  });

  return {
    ok: true,
    message: "Vous êtes désinscrit de la newsletter. À bientôt !",
    emailMasked: maskEmail(subscription.email),
  };
}

/** Masque un email pour confirmation : `john.doe@gmail.com` → `j***@gmail.com`. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.min(3, local.length - 1))}@${domain}`;
}

const SUBSCRIBE_SOURCES = [
  "home-hero",
  "home-section",
  "footer",
  "checkout-thank-you",
  "blog-inline",
] as const;

const subscribeSchema = z
  .object({
    email: z.string().email("Email invalide."),
    consent: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
    source: z
      .string()
      .optional()
      .transform((v) =>
        (SUBSCRIBE_SOURCES as readonly string[]).includes(v ?? "") ? v! : "footer",
      ),
  })
  .strict();

export async function subscribeNewsletter(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  // 1) Rate-limit IP (5 / heure) — protège contre l'inscription massive.
  const rl = await checkIpRateLimit({
    prefix: "newsletter:subscribe",
    windowMs: 60 * 60 * 1000,
    max: 5,
  });
  if (!rl.ok) {
    return { success: false, message: rateLimitMessage(rl.resetAt) };
  }

  const parsed = validateFormData(formData, subscribeSchema);
  if (!parsed.ok) {
    // validateFormData renvoie un type fieldErrors plus large
    // (Record<string,string[]|undefined>) que ActionResult ; au runtime
    // les valeurs sont toujours string[], cast contrôlé.
    return parsed.error as ActionResult;
  }

  if (!parsed.data.consent) {
    return {
      success: false,
      fieldErrors: { consent: ["Vous devez accepter pour vous inscrire."] },
      message: "Le consentement RGPD est obligatoire.",
    };
  }

  const email = parsed.data.email.toLowerCase().trim();

  try {
    const h = await headers();
    const userAgent = h.get("user-agent")?.slice(0, 300) ?? null;
    const ipHash = await clientIpHash();

    // upsert : si l'email existe déjà avec unsubscribedAt non-null, on le
    // réactive en remettant `consentedAt` à maintenant (nouveau consentement
    // explicite) et en effaçant `unsubscribedAt`. Si déjà actif, idempotent.
    // Le token d'unsubscribe est généré à la création uniquement (jamais
    // régénéré à la ré-inscription pour ne pas casser les liens passés).
    await prisma.newsletterSubscription.upsert({
      where: { email },
      update: {
        consentedAt: new Date(),
        unsubscribedAt: null,
        source: parsed.data.source,
        ipHash,
        userAgent,
      },
      create: {
        email,
        source: parsed.data.source,
        unsubscribeToken: generateUnsubscribeToken(),
        ipHash,
        userAgent,
      },
    });

    return {
      success: true,
      message: "Inscription confirmée. Merci !",
    };
  } catch (error) {
    logError("newsletter.subscribe", error, { email });
    return {
      success: false,
      message: "Une erreur est survenue. Réessayez plus tard.",
    };
  }
}
