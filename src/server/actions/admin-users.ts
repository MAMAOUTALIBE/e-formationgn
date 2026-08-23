"use server";

// Server Actions admin pour la gestion des utilisateurs.
// Toutes vérifient le rôle ADMIN et loggent dans AuditLog.

import type { UserRole } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";

import { isStaffRole } from "@/lib/account-audience";
import { requireAdmin } from "@/lib/auth/authorization";
import { checkUserRateLimit, rateLimitMessage } from "@/lib/auth/rate-limit-ip";
import { csvResponseHeaders, rowsToCsv, slugifyForFilename } from "@/lib/csv";
import { joinFullName } from "@/lib/identity-name";
import { prisma } from "@/lib/prisma";
import {
  buildAdminUsersWhere,
  listAdminUsers,
  type AdminUsersFilters,
} from "@/server/queries/admin-users";
import { createAuditLog } from "@/server/services/audit-log";
import { buildUserDataExport, eraseUserData } from "@/server/services/gdpr";

import type { ActionResult } from "./auth";

async function audit(
  actorId: string,
  action: string,
  targetId: string,
  metadata?: Record<string, unknown>,
) {
  await createAuditLog({
    actorId,
    action,
    targetType: "User",
    targetId,
    metadata: metadata ?? null,
  });
}

async function learnerIdsOrError(
  requestedIds: string[],
): Promise<{ ids: string[] } | { error: string }> {
  const ids = [...new Set(requestedIds)].slice(0, 100);
  if (ids.length === 0) return { error: "Aucun apprenant sélectionné." };

  const learners = await prisma.user.findMany({
    where: { id: { in: ids }, role: "STUDENT" },
    select: { id: true },
  });
  if (learners.length !== ids.length) {
    return {
      error:
        "La sélection contient un compte interne. Aucune modification n’a été appliquée.",
    };
  }
  return { ids: learners.map((learner) => learner.id) };
}

export async function suspendUser(userId: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { status: "SUSPENDED" },
  });
  await audit(admin.userId, "user.suspend", userId, { reason });
  revalidatePath(`/admin/utilisateurs/${userId}`);
  return { success: true, message: "Utilisateur suspendu." };
}

export async function reactivateUser(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { status: "ACTIVE", bannedAt: null, bannedReason: null },
  });
  await audit(admin.userId, "user.reactivate", userId);
  revalidatePath(`/admin/utilisateurs/${userId}`);
  return { success: true, message: "Compte réactivé." };
}

export async function bulkSetUserState(
  userIds: string[],
  state: "ACTIVE" | "SUSPENDED" | "BANNED" | "DELETED",
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const targets = await learnerIdsOrError(userIds);
  if ("error" in targets) return { success: false, message: targets.error };
  const { ids } = targets;
  const data = state === "BANNED"
    ? { status: "SUSPENDED" as const, bannedAt: new Date(), bannedReason: "Action groupée administrateur" }
    : state === "ACTIVE"
      ? { status: "ACTIVE" as const, bannedAt: null, bannedReason: null }
      : { status: state };
  await prisma.user.updateMany({ where: { id: { in: ids } }, data });
  await Promise.all(ids.map((id) => audit(admin.userId, `user.bulk-${state.toLowerCase()}`, id)));
  revalidatePath("/admin/utilisateurs");
  return { success: true, message: `${ids.length} compte${ids.length > 1 ? "s" : ""} mis à jour.` };
}

export async function bulkAssignCompany(userIds: string[], companyId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!companyId) return { success: false, message: "Sélection et société requises." };
  const targets = await learnerIdsOrError(userIds);
  if ("error" in targets) return { success: false, message: targets.error };
  const { ids } = targets;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, status: true } });
  if (!company || company.status === "ARCHIVED") return { success: false, message: "Société invalide ou archivée." };
  await prisma.user.updateMany({ where: { id: { in: ids } }, data: { companyId } });
  await Promise.all(ids.map((id) => audit(admin.userId, "user.assign-company", id, { companyId })));
  revalidatePath("/admin/utilisateurs");
  return { success: true, message: `${ids.length} compte${ids.length > 1 ? "s" : ""} affecté${ids.length > 1 ? "s" : ""}.` };
}

export async function exportSelectedUsersCsv(userIds: string[]): Promise<{ csv: string; filename: string } | { error: string }> {
  try { await requireAdmin(); } catch { return { error: "Non autorisé." }; }
  const targets = await learnerIdsOrError(userIds);
  if ("error" in targets) return targets;
  const users = await prisma.user.findMany({ where: { id: { in: targets.ids }, role: "STUDENT" }, select: { id: true, name: true, email: true, role: true, status: true, country: true, createdAt: true } });
  return {
    csv: rowsToCsv(users.map((user) => ({ ...user, name: user.name ?? "", country: user.country ?? "", createdAt: user.createdAt.toISOString() }))),
    filename: `apprenants-selection-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}

export async function banUser(userId: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "SUSPENDED",
      bannedAt: new Date(),
      bannedReason: reason,
    },
  });
  await audit(admin.userId, "user.ban", userId, { reason });
  revalidatePath(`/admin/utilisateurs/${userId}`);
  return { success: true, message: "Utilisateur banni." };
}

export async function forceVerifyEmail(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerified: new Date(),
      status: "ACTIVE",
    },
  });
  await audit(admin.userId, "user.verify-email", userId);
  revalidatePath(`/admin/utilisateurs/${userId}`);
  return { success: true, message: "Email vérifié." };
}

export async function changeUserRole(
  userId: string,
  role: UserRole,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (userId === admin.userId) {
    return { success: false, message: "Vous ne pouvez pas modifier votre propre rôle." };
  }
  if (!isStaffRole(role)) {
    return {
      success: false,
      message: "Un compte interne ne peut pas être transformé en apprenant.",
    };
  }
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!target || !isStaffRole(target.role)) {
    return {
      success: false,
      message:
        "Ce compte est un apprenant. Créez un compte interne séparé pour lui attribuer un rôle.",
    };
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      role,
      isInstructor: role === "INSTRUCTOR",
    },
  });
  await audit(admin.userId, "user.role-change", userId, { role });
  revalidatePath("/admin/equipe");
  revalidatePath(`/admin/utilisateurs/${userId}`);
  revalidatePath("/admin/formateurs");
  return { success: true, message: "Rôle modifié." };
}

export async function addAdminNoteOnUser(
  userId: string,
  body: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (body.trim().length < 2) {
    return { success: false, message: "Note trop courte." };
  }
  await prisma.adminNote.create({
    data: { targetType: "USER", targetId: userId, body, authorId: admin.userId },
  });
  await audit(admin.userId, "user.note", userId);
  revalidatePath(`/admin/utilisateurs/${userId}`);
  return { success: true, message: "Note enregistrée." };
}

/** Libellés lisibles du sexe, dans les termes du formulaire de saisie. */
const GENDER_LABELS: Record<string, string> = {
  FEMALE: "Féminin",
  MALE: "Masculin",
  OTHER: "Autre",
};

/**
 * Export CSV des apprenants — RESTREINT AU PÉRIMÈTRE AFFICHÉ.
 *
 * L'export prend les filtres de l'écran et les passe à la même fonction que la
 * liste (`buildAdminUsersWhere`). Sans cela il sortait tous les apprenants de
 * toutes les sociétés clientes : filtrer sur une entreprise puis exporter
 * produisait un fichier contenant l'état civil, le téléphone et l'adresse du
 * domicile des salariés des autres clients — une violation de données au sens
 * de l'article 33 du RGPD dès que le fichier était transmis au client.
 *
 * La colonne « societe » et le suffixe du nom de fichier rendent le périmètre
 * lisible : celui qui ouvre le fichier voit à qui il appartient.
 */
export async function exportUsersCsv(
  filters: AdminUsersFilters = {},
): Promise<{ csv: string; filename: string } | { error: string }> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { error: "Non autorisé." };
  }
  // Export de masse de données personnelles : plafonné pour qu'une session
  // admin compromise ne puisse pas aspirer le fichier en boucle.
  const rl = await checkUserRateLimit({
    prefix: "admin:export:users",
    userId: session.userId,
    windowMs: 10 * 60_000,
    max: 5,
  });
  if (!rl.ok) return { error: rateLimitMessage(rl.resetAt) };

  const where = buildAdminUsersWhere(filters);

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      birthPlace: true,
      gender: true,
      phone: true,
      address: true,
      role: true,
      status: true,
      country: true,
      isInstructor: true,
      createdAt: true,
      lastLoginAt: true,
      company: { select: { name: true } },
    },
  });
  // Les intitulés sont ceux que l'import sait relire : un export réimporté
  // n'a donc pas à être retaillé à la main.
  const rows = users.map((u) => ({
    id: u.id,
    "nom et prenom": joinFullName(u),
    email: u.email,
    // Le rattachement figure sur chaque ligne : un fichier transmis à une
    // entreprise cliente doit pouvoir être vérifié d'un coup d'œil.
    societe: u.company?.name ?? "",
    "date de naissance": u.birthDate ? u.birthDate.toISOString().slice(0, 10) : "",
    "lieu de naissance": u.birthPlace ?? "",
    sexe: GENDER_LABELS[u.gender ?? ""] ?? "",
    telephone: u.phone ?? "",
    pays: u.country ?? "",
    adresse: u.address ?? "",
    role: u.role,
    status: u.status,
    isInstructor: u.isInstructor ? "oui" : "non",
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? "",
  }));

  // Le nom du fichier porte le périmètre : un export d'une seule société le
  // dit, un export global le dit aussi. C'est la dernière barrière avant
  // l'envoi du mauvais fichier au mauvais client.
  const societes = new Set(rows.map((r) => r.societe).filter(Boolean));
  const perimetre =
    societes.size === 1
      ? slugifyForFilename([...societes][0])
      : societes.size === 0
        ? "sans-societe"
        : "toutes-societes";
  // Export de masse de données personnelles : tracé au même titre qu'une
  // mutation. Sans cette entrée, une exfiltration du fichier utilisateurs ne
  // laisserait aucune trace dans AuditLog.
  await createAuditLog({
    actorId: session.userId,
    action: "user.export_csv",
    targetType: "User",
    targetId: null,
    // Le périmètre est journalisé au même titre que le volume : en cas de
    // fichier transmis au mauvais destinataire, l'audit doit dire ce qui est
    // sorti, pas seulement combien de lignes.
    metadata: {
      rowCount: rows.length,
      perimetre,
      filtres: {
        companyId: filters.companyId ?? null,
        status: filters.status ?? null,
        country: filters.country ?? null,
        q: filters.q ? "(recherche)" : null,
      },
    },
  });

  return {
    csv: rowsToCsv(rows),
    filename: `apprenants-${perimetre}-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}

// Garde csvResponseHeaders pour les éventuelles routes /api d'export.
export { csvResponseHeaders };

// Re-export pour usage dans la page liste.
export { listAdminUsers };

// --- RGPD : export & suppression définitive --------------------------------

/**
 * Droit d'accès et de portabilité : produit l'archive, séance tenante.
 *
 * L'action ne se contente plus d'enregistrer une intention : elle rassemble les
 * données et renvoie le fichier à remettre à la personne. La demande est créée
 * puis close dans la foulée, avec la trace de ce qui a été produit.
 */
export async function exportUserGdprData(
  userId: string,
): Promise<ActionResult & { json?: string; filename?: string }> {
  const admin = await requireAdmin();

  const demande = await prisma.gdprRequest.create({
    data: { userId, kind: "EXPORT", status: "PENDING" },
    select: { id: true },
  });

  let archive: Awaited<ReturnType<typeof buildUserDataExport>>;
  try {
    archive = await buildUserDataExport(userId);
  } catch (error) {
    console.error("[rgpd] export impossible", { userId, error });
    await prisma.gdprRequest.update({
      where: { id: demande.id },
      data: { status: "REJECTED", metadata: { erreur: "Génération de l'archive impossible." } },
    });
    return { success: false, message: "Export impossible. La demande est enregistrée comme non traitée." };
  }

  await prisma.gdprRequest.update({
    where: { id: demande.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      metadata: {
        inscriptions: archive.inscriptions.length,
        attestations: archive.attestations.length,
        notes: archive.notesPersonnelles.length,
      },
    },
  });
  await audit(admin.userId, "user.gdpr-export", userId);
  revalidatePath(`/admin/utilisateurs/${userId}`);
  revalidatePath("/admin/securite/rgpd");

  return {
    success: true,
    message: "Archive générée. Remettez-la à la personne concernée.",
    json: JSON.stringify(archive, null, 2),
    filename: `donnees-personnelles-${userId}-${new Date().toISOString().slice(0, 10)}.json`,
  };
}

/**
 * Droit à l'effacement : efface pour de bon.
 *
 * L'ancienne version créait une demande « à exécuter par un job » qui n'a jamais
 * existé, et se bornait à basculer le compte en statut supprimé — les données
 * restaient en base indéfiniment. L'effacement est désormais exécuté ici, et son
 * résultat détaillé est consigné sur la demande : ce qui a disparu, ce qui est
 * conservé, et au titre de quelle obligation.
 */
export async function deleteUserGdpr(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();

  const demande = await prisma.gdprRequest.create({
    data: { userId, kind: "DELETE", status: "PENDING" },
    select: { id: true },
  });

  let bilan: Awaited<ReturnType<typeof eraseUserData>>;
  try {
    bilan = await eraseUserData(userId);
  } catch (error) {
    console.error("[rgpd] effacement impossible", { userId, error });
    await prisma.gdprRequest.update({
      where: { id: demande.id },
      data: { status: "REJECTED", metadata: { erreur: "Effacement interrompu." } },
    });
    return {
      success: false,
      message: "Effacement interrompu. La demande reste ouverte — aucune clôture n'a été enregistrée.",
    };
  }

  await prisma.gdprRequest.update({
    where: { id: demande.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      metadata: { supprime: bilan.supprime, conserve: bilan.conserve },
    },
  });
  await audit(admin.userId, "user.gdpr-delete", userId, {
    supprime: bilan.supprime,
    conserve: bilan.conserve,
  });
  revalidatePath("/admin/utilisateurs");
  revalidatePath("/admin/securite/rgpd");
  return {
    success: true,
    message: `Données effacées. Conservé : ${bilan.conserve.length} catégorie(s) sous obligation légale.`,
  };
}
