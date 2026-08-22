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

import { requireAdmin } from "@/lib/auth/authorization";
import { hashPassword } from "@/lib/auth/password";
import { splitFullName } from "@/lib/identity-name";
import { prisma } from "@/lib/prisma";
import {
  createCenterAccountSchema,
  readCivilStatusFields,
  updateAccountIdentitySchema,
} from "@/lib/validators/identity";
import { createAuditLog } from "@/server/services/audit-log";
import { generateTemporaryPassword } from "@/server/services/temporary-password";

import type { ActionResult } from "./auth";

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
    ...readCivilStatusFields(formData),
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? "STUDENT"),
    companyId: String(formData.get("companyId") ?? ""),
  };

  const parsed = createCenterAccountSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      message: "Formulaire incomplet. Votre saisie est conservée.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values: raw,
    };
  }

  const {
    email,
    fullName,
    birthDate,
    birthPlace,
    gender,
    phone,
    country,
    address,
    role,
    companyId,
  } = parsed.data;
  // `name` fait foi pour l'affichage ; prénom et nom n'en sont que les
  // dérivés de tri — cf. `splitFullName`.
  const identity = splitFullName(fullName);

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
      name: identity.name,
      firstName: identity.firstName,
      lastName: identity.lastName,
      birthDate,
      birthPlace,
      gender,
      phone,
      country,
      address,
      hashedPassword: await hashPassword(temporaryPassword),
      role,
      companyId,
      isInstructor: false,
      // Le compte est immédiatement utilisable : c'est le centre qui a
      // vérifié l'identité de la personne, pas une boucle email.
      status: "ACTIVE",
      // Et puisque c'est le centre qui l'a saisie, c'est lui qui la corrige :
      // le titulaire ne renomme pas ce qui figurera sur son certificat.
      identityLockedAt: new Date(),
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

// ---------------------------------------------------------------------------
// Correction d'une identité verrouillée
// ---------------------------------------------------------------------------

/**
 * Corrige l'état civil d'un compte.
 *
 * Contrepartie indispensable du verrou : l'écran de profil dit à l'apprenant
 * de s'adresser à l'administration, encore faut-il que l'administration
 * dispose du geste. Sans cette action, une faute de frappe à la création
 * devenait définitive et se reportait sur tous les certificats émis, puisque
 * ceux-ci lisent le nom en direct plutôt qu'une copie figée.
 *
 * Réservé à l'ADMIN strict, comme la création de compte dans ce même fichier :
 * c'est l'identité qui figure sur les attestations qu'on modifie ici.
 */
export async function updateAccountIdentity(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { success: false, message: "Non autorisé." };
  }

  const parsed = updateAccountIdentitySchema.safeParse({
    ...readCivilStatusFields(formData),
    userId: String(formData.get("userId") ?? ""),
  });
  if (!parsed.success) {
    return {
      success: false,
      message: "Veuillez corriger les erreurs ci-dessous.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { userId, fullName, ...civil } = parsed.data;
  // Case à cocher du formulaire : absente du corps quand elle n'est pas
  // cochée, comme toute case HTML.
  const propagateToCertificates = formData.get("updateCertificates") === "on";

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, firstName: true, lastName: true },
  });
  if (!target) return { success: false, message: "Compte introuvable." };

  const identity = splitFullName(fullName);

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: identity.name,
      firstName: identity.firstName,
      lastName: identity.lastName,
      birthDate: civil.birthDate,
      birthPlace: civil.birthPlace,
      gender: civil.gender,
      phone: civil.phone,
      country: civil.country,
      address: civil.address,
      // Une identité corrigée par l'administration reste sous sa garde : on
      // (re)pose le verrou plutôt que de le laisser au hasard de l'état
      // antérieur du compte.
      identityLockedAt: new Date(),
    },
  });

  // Les attestations portent un nom FIGÉ à l'émission : les réaligner est un
  // acte distinct de la correction du compte, et il se demande. Rectifier une
  // faute de frappe doit pouvoir se faire sans toucher aux documents déjà
  // remis, et corriger un nom d'usage doit pouvoir les rejoindre — seule
  // l'administration sait de quel cas il s'agit.
  let certificatesUpdated = 0;
  if (propagateToCertificates) {
    const result = await prisma.certificate.updateMany({
      where: { userId },
      data: { holderName: identity.name },
    });
    certificatesUpdated = result.count;
  }

  await createAuditLog({
    actorId: session.userId,
    action: "user.identity_corrected",
    targetType: "User",
    targetId: userId,
    metadata: {
      email: target.email,
      before: target.name ?? `${target.firstName ?? ""} ${target.lastName ?? ""}`.trim(),
      after: identity.name,
      certificatesUpdated,
    },
  });

  revalidatePath(`/admin/utilisateurs/${userId}`);
  revalidatePath("/admin/utilisateurs");

  return {
    success: true,
    message:
      certificatesUpdated > 0
        ? `Identité enregistrée. ${certificatesUpdated} attestation${certificatesUpdated > 1 ? "s" : ""} mise${certificatesUpdated > 1 ? "s" : ""} à jour.`
        : "Identité enregistrée.",
  };
}

// ---------------------------------------------------------------------------
// Suppression définitive d'un compte apprenant
// ---------------------------------------------------------------------------

/**
 * Efface un compte apprenant et tout ce qui en dépend.
 *
 * Distincte de la demande RGPD (`deleteUserGdpr`), qui archive : le compte y
 * passe en statut DELETED et ses données restent en base, ce qui est le bon
 * comportement quand une trace doit subsister. Ici la ligne disparaît, ainsi
 * que — par cascade déclarée au schéma — inscriptions, progression,
 * tentatives de quiz, certificats, notes, favoris, questions et sessions.
 *
 * Trois refus délibérés :
 *
 *  1. Les comptes non apprenants. Un formateur est propriétaire de formations
 *     dont la relation n'est pas en cascade : la suppression échouerait à
 *     mi-chemin, et surtout on ne détruit pas un catalogue par ce geste.
 *  2. Son propre compte, qui laisserait l'administration sans opérateur.
 *  3. Un compte porteur de commandes. `Order.user` n'est pas en cascade — une
 *     pièce comptable ne s'efface pas au gré d'un ménage d'annuaire.
 *
 * Le journal d'audit conserve l'identité effacée : la ligne part, la trace de
 * son départ reste.
 */
export async function deleteLearnerAccount(userId: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { success: false, message: "Non autorisé." };
  }

  if (!userId) return { success: false, message: "Compte introuvable." };
  if (userId === session.userId) {
    return { success: false, message: "Vous ne pouvez pas supprimer votre propre compte." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      _count: { select: { orders: true, coursesAuthored: true, certificates: true } },
    },
  });
  if (!target) return { success: false, message: "Compte introuvable." };

  if (target.role !== "STUDENT" || target._count.coursesAuthored > 0) {
    return {
      success: false,
      message:
        "Seul un compte apprenant peut être supprimé définitivement. Suspendez plutôt ce compte.",
    };
  }

  if (target._count.orders > 0) {
    return {
      success: false,
      message:
        "Ce compte porte des commandes et ne peut pas être effacé. Utilisez la demande de suppression RGPD.",
    };
  }

  // Journalisé AVANT la suppression : `AuditLog.actorId` est en SetNull, mais
  // les métadonnées, elles, ne dépendent d'aucune ligne survivante.
  await createAuditLog({
    actorId: session.userId,
    action: "user.hard_delete",
    targetType: "User",
    targetId: userId,
    metadata: {
      email: target.email,
      name: target.name,
      certificates: target._count.certificates,
    },
  });

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (error) {
    console.error("[admin-accounts] suppression définitive", { userId, error });
    return {
      success: false,
      message:
        "Suppression impossible : ce compte est référencé par des données non effaçables.",
    };
  }

  revalidatePath("/admin/utilisateurs");
  return { success: true, message: "Compte supprimé définitivement." };
}
