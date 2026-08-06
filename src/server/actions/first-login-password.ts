"use server";

// Changement du mot de passe provisoire attribué par le centre de formation.
//
// Distinct de `resetPassword` (qui repose sur un jeton reçu par email) : ici
// l'utilisateur est déjà authentifié avec le mot de passe provisoire, mais sa
// navigation est bloquée par la garde de `auth.config.ts` tant qu'il ne l'a
// pas remplacé.

import { z } from "zod";

import { requireSession } from "@/lib/auth/authorization";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { checkPasswordPwned } from "@/lib/auth/pwned-passwords";
import { checkUserRateLimit, rateLimitMessage } from "@/lib/auth/rate-limit-ip";
import { prisma } from "@/lib/prisma";
import { passwordSchema } from "@/lib/validators/auth";
import { createAuditLog } from "@/server/services/audit-log";

import type { ActionResult } from "./auth";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Mot de passe provisoire requis."),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .strict()
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les deux mots de passe ne correspondent pas.",
  })
  .refine((d) => d.password !== d.currentPassword, {
    path: ["password"],
    message: "Choisissez un mot de passe différent du provisoire.",
  });

export async function changeTemporaryPassword(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { success: false, message: "Vous devez être connecté." };
  }

  const rl = await checkUserRateLimit({
    prefix: "auth:first-password",
    userId: session.userId,
    windowMs: 15 * 60_000,
    max: 10,
  });
  if (!rl.ok) return { success: false, message: rateLimitMessage(rl.resetAt) };

  const parsed = schema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: "Formulaire invalide.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, hashedPassword: true },
  });
  if (!user?.hashedPassword) {
    return { success: false, message: "Compte introuvable." };
  }

  // On revérifie le mot de passe provisoire : une session ouverte ne suffit
  // pas à autoriser un changement de mot de passe (protection contre un poste
  // laissé déverrouillé).
  const ok = await verifyPassword(parsed.data.currentPassword, user.hashedPassword);
  if (!ok) {
    return {
      success: false,
      message: "Mot de passe provisoire incorrect.",
      fieldErrors: { currentPassword: ["Mot de passe provisoire incorrect."] },
    };
  }

  // Vérification HaveIBeenPwned : le mot de passe provisoire a transité par
  // email en clair, autant que le nouveau soit réellement solide.
  const pwned = await checkPasswordPwned(parsed.data.password);
  if (pwned.shouldReject) {
    return {
      success: false,
      message: "Ce mot de passe figure dans une fuite de données connue.",
      fieldErrors: { password: ["Choisissez un autre mot de passe."] },
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      hashedPassword: await hashPassword(parsed.data.password),
      mustChangePassword: false,
      // Invalide toutes les sessions existantes, y compris celles ouvertes
      // avec le mot de passe provisoire transmis par email.
      passwordChangedAt: new Date(),
    },
  });

  await createAuditLog({
    actorId: user.id,
    action: "user.first_password_change",
    targetType: "User",
    targetId: user.id,
  });

  return {
    success: true,
    message: "Mot de passe modifié. Reconnectez-vous avec le nouveau.",
  };
}
