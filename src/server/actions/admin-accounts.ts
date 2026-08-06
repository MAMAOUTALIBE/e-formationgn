"use server";

// Création de comptes par le centre de formation.
//
// En mode `centre_formation`, l'inscription publique est fermée : c'est le
// centre qui crée les comptes, élèves comme formateurs, et transmet lui-même
// les identifiants par email.
//
// Le mot de passe provisoire est renvoyé EN CLAIR à l'appelant, une seule
// fois, pour être affiché à l'admin qui vient de créer le compte. Il n'est
// jamais stocké en clair ni réaffichable ensuite : si l'admin le perd, il
// regénère. C'est aussi pourquoi `mustChangePassword` est posé — un mot de
// passe transmis par email en clair ne doit pas rester valable durablement.

import { randomInt } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/authorization";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";

import type { ActionResult } from "./auth";

/** Rôles qu'un centre peut attribuer à la création. */
const CREATABLE_ROLES = ["STUDENT", "INSTRUCTOR"] as const;

const createAccountSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Email invalide."),
    firstName: z.string().trim().min(1, "Prénom requis.").max(80),
    lastName: z.string().trim().min(1, "Nom requis.").max(80),
    role: z.enum(CREATABLE_ROLES),
  })
  .strict();

export interface CreateAccountResult extends ActionResult {
  /** Mot de passe provisoire, affiché une seule fois. */
  temporaryPassword?: string;
  createdEmail?: string;
}

/**
 * Alphabet sans caractères ambigus (0/O, 1/l/I) : ce mot de passe est
 * recopié à la main ou lu au téléphone, une confusion coûte un appel au
 * secrétariat.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generateTemporaryPassword(): string {
  // randomInt (CSPRNG) plutôt que Math.random : c'est un secret d'accès.
  let out = "";
  for (let i = 0; i < 14; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  // Garantit la présence d'un chiffre et d'un caractère spécial, exigés par
  // la politique de mot de passe appliquée au changement.
  return `${out}7!`;
}

export async function createCenterAccount(
  _prev: CreateAccountResult,
  formData: FormData,
): Promise<CreateAccountResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { success: false, message: "Non autorisé." };
  }

  const parsed = createAccountSchema.safeParse({
    email: formData.get("email"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: "Formulaire incomplet.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { email, firstName, lastName, role } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return {
      success: false,
      message: "Un compte existe déjà avec cet email.",
      fieldErrors: { email: ["Cet email est déjà utilisé."] },
    };
  }

  const temporaryPassword = generateTemporaryPassword();

  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      hashedPassword: await hashPassword(temporaryPassword),
      role,
      isInstructor: role === "INSTRUCTOR",
      // Le compte est immédiatement utilisable : c'est le centre qui a
      // vérifié l'identité de la personne, pas une boucle email.
      status: "ACTIVE",
      emailVerified: new Date(),
      mustChangePassword: true,
    },
    select: { id: true, email: true },
  });

  await createAuditLog({
    actorId: session.userId,
    action: "user.create_by_center",
    targetType: "User",
    targetId: user.id,
    metadata: { email: user.email, role },
  });

  revalidatePath("/admin/utilisateurs");

  return {
    success: true,
    message: "Compte créé.",
    temporaryPassword,
    createdEmail: user.email,
  };
}

/**
 * Regénère un mot de passe provisoire (élève ayant perdu le sien).
 *
 * Repose `mustChangePassword` et met à jour `passwordChangedAt`, ce qui
 * invalide au passage toutes les sessions ouvertes du compte — voir le
 * callback JWT dans src/auth.ts.
 */
export async function resetCenterAccountPassword(
  _prev: CreateAccountResult,
  formData: FormData,
): Promise<CreateAccountResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { success: false, message: "Non autorisé." };
  }

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { success: false, message: "Compte introuvable." };

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!target) return { success: false, message: "Compte introuvable." };

  const temporaryPassword = generateTemporaryPassword();

  await prisma.user.update({
    where: { id: userId },
    data: {
      hashedPassword: await hashPassword(temporaryPassword),
      mustChangePassword: true,
      passwordChangedAt: new Date(),
    },
  });

  await createAuditLog({
    actorId: session.userId,
    action: "user.reset_password_by_center",
    targetType: "User",
    targetId: userId,
    metadata: { email: target.email },
  });

  revalidatePath(`/admin/utilisateurs/${userId}`);

  return {
    success: true,
    message: "Mot de passe réinitialisé.",
    temporaryPassword,
    createdEmail: target.email,
  };
}
