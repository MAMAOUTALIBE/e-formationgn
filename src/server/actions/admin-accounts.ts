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

/** Cet écran crée exclusivement des apprenants. L'équipe a son propre flux. */
const CREATABLE_ROLES = ["STUDENT"] as const;

const createAccountSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Email invalide."),
    firstName: z.string().trim().min(1, "Prénom requis.").max(80),
    lastName: z.string().trim().min(1, "Nom requis.").max(80),
    phone: z.string().trim().max(40).optional().default(""),
    role: z.enum(CREATABLE_ROLES),
    // Identifiant d'une société EXISTANTE, jamais un nom saisi librement :
    // deux orthographes du même client fausseraient tout regroupement
    // (facturation, dossier OPCO, statistiques). Vide pour un formateur, qui
    // n'appartient à aucune société cliente.
    companyId: z.string().trim().optional().default(""),
  })
  .strict()
  .refine((v) => v.companyId !== "", {
    message: "Sélectionnez la société de rattachement.",
    path: ["companyId"],
  });

export interface CreateAccountResult extends ActionResult {
  /** Mot de passe provisoire, affiché une seule fois. */
  temporaryPassword?: string;
  createdEmail?: string;
  /**
   * Valeurs reçues, renvoyées en cas d'échec.
   *
   * React 19 réinitialise le formulaire dès que l'action a répondu : sans ce
   * renvoi, une adresse déjà utilisée ferait repartir le prénom, le nom, le
   * téléphone et la société à vide. Le formulaire s'en sert comme
   * `defaultValue`, donc la réinitialisation restaure la saisie.
   */
  values?: Record<string, string>;
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

  const raw = {
    email: String(formData.get("email") ?? ""),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    role: String(formData.get("role") ?? "STUDENT"),
    companyId: String(formData.get("companyId") ?? ""),
  };

  const parsed = createAccountSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      message: "Formulaire incomplet. Votre saisie est conservée.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values: raw,
    };
  }

  const { email, firstName, lastName, phone, role, companyId } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return {
      success: false,
      message: "Un compte existe déjà avec cet email.",
      fieldErrors: { email: ["Cet email est déjà utilisé."] },
      values: raw,
    };
  }

  // La société est vérifiée côté serveur : le `<select>` ne prouve rien, on
  // reçoit un identifiant que n'importe qui peut forger. On refuse aussi une
  // société archivée — on ne rattache pas un nouvel élève à un client clos.
  if (companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, status: true },
    });
    if (!company || company.status === "ARCHIVED") {
      return {
        success: false,
        message: "Société invalide ou archivée.",
        fieldErrors: { companyId: ["Sélectionnez une société active."] },
        values: raw,
      };
    }
  }

  const temporaryPassword = generateTemporaryPassword();

  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      phone: phone || null,
      hashedPassword: await hashPassword(temporaryPassword),
      role,
      companyId,
      isInstructor: false,
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
    metadata: { email: user.email, role, companyId: companyId || null },
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
