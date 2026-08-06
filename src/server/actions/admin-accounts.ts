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
// regénère.
//
// Le changement au premier accès n'est PAS imposé (choix du centre) : l'élève
// se connecte directement avec le mot de passe reçu. Le mécanisme existe
// toujours — garde de navigation dans auth.config.ts et écran
// /changer-mot-de-passe — il suffit de repasser `mustChangePassword` à `true`
// ci-dessous pour l'activer. À garder en tête : ce mot de passe transite par
// email en clair, il reste donc valable tant que l'élève ne le change pas de
// lui-même depuis son profil.

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/authorization";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";
import { generateTemporaryPassword } from "@/server/services/temporary-password";

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
      // Changement du mot de passe NON imposé, sur demande du centre : l'élève
      // se connecte directement avec celui qu'on lui a transmis. Le mécanisme
      // reste en place (garde de navigation, écran dédié) — passer cette
      // valeur à `true` suffit à le réactiver, ici et dans la
      // réinitialisation ci-dessous.
      mustChangePassword: false,
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
 * Regénère un mot de passe (compte dont le titulaire a perdu le sien).
 *
 * Met à jour `passwordChangedAt`, ce qui invalide au passage toutes les
 * sessions ouvertes du compte — voir le callback JWT dans src/auth.ts. Utile
 * au-delà du simple oubli : c'est aussi le geste qui coupe l'accès d'une
 * personne dont les identifiants ont fuité.
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
      // Non imposé — cf. commentaire dans createCenterAccount.
      mustChangePassword: false,
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
