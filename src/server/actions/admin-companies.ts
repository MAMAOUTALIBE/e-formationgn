"use server";

// Server Actions des sociétés clientes : création, modification, archivage.
//
// Aucune suppression physique n'est exposée. Une société porte des élèves, qui
// portent des accès et un historique ; la faire disparaître effacerait la
// traçabilité qu'un organisme de formation doit pouvoir produire. L'archivage
// la retire des listes de rattachement sans rien détruire.

import { revalidatePath } from "next/cache";

import { requireAnyAdminRole } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import { companySchema } from "@/lib/validators/company";
import { createAuditLog } from "@/server/services/audit-log";

export interface CompanyActionResult {
  success: boolean;
  message?: string;
  companyId?: string;
  /** Erreurs par champ, pour un affichage au bon endroit du formulaire. */
  fieldErrors?: Record<string, string>;
}

/** FormData → objet brut, avant validation Zod. */
function readCompanyForm(formData: FormData) {
  const get = (k: string) => (formData.get(k) as string | null) ?? "";
  return {
    name: get("name"),
    siret: get("siret"),
    siren: get("siren"),
    vatNumber: get("vatNumber"),
    addressLine1: get("addressLine1"),
    addressLine2: get("addressLine2"),
    postalCode: get("postalCode"),
    city: get("city"),
    country: get("country") || "France",
    contactName: get("contactName"),
    contactEmail: get("contactEmail"),
    contactPhone: get("contactPhone"),
    opco: get("opco"),
    opcoReference: get("opcoReference"),
    notes: get("notes"),
    status: get("status") || "ACTIVE",
  };
}

function toFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export async function createCompany(
  _prev: CompanyActionResult,
  formData: FormData,
): Promise<CompanyActionResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole();
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  const parsed = companySchema.safeParse(readCompanyForm(formData));
  if (!parsed.success) {
    return {
      success: false,
      message: "Corrigez les champs signalés.",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  // Doublon de SIRET : la base a la contrainte, mais on veut un message clair
  // plutôt qu'une erreur Prisma brute — et le SIRET est l'identifiant qui
  // permet réellement de détecter deux fiches du même client.
  if (parsed.data.siret) {
    const existing = await prisma.company.findUnique({
      where: { siret: parsed.data.siret },
      select: { id: true, name: true },
    });
    if (existing) {
      return {
        success: false,
        message: `Ce SIRET est déjà enregistré pour « ${existing.name} ».`,
        fieldErrors: { siret: "SIRET déjà utilisé." },
      };
    }
  }

  const company = await prisma.company.create({ data: parsed.data });

  await createAuditLog({
    actorId: actor.userId,
    action: "company.create",
    targetType: "Company",
    targetId: company.id,
    metadata: { name: company.name, siret: company.siret },
  });

  revalidatePath("/admin/societes");
  return { success: true, companyId: company.id, message: "Société créée." };
}

export async function updateCompany(
  companyId: string,
  _prev: CompanyActionResult,
  formData: FormData,
): Promise<CompanyActionResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole();
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  const current = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, siret: true, status: true },
  });
  if (!current) return { success: false, message: "Société introuvable." };

  const parsed = companySchema.safeParse(readCompanyForm(formData));
  if (!parsed.success) {
    return {
      success: false,
      message: "Corrigez les champs signalés.",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  if (parsed.data.siret && parsed.data.siret !== current.siret) {
    const clash = await prisma.company.findUnique({
      where: { siret: parsed.data.siret },
      select: { id: true, name: true },
    });
    if (clash && clash.id !== companyId) {
      return {
        success: false,
        message: `Ce SIRET est déjà enregistré pour « ${clash.name} ».`,
        fieldErrors: { siret: "SIRET déjà utilisé." },
      };
    }
  }

  await prisma.company.update({ where: { id: companyId }, data: parsed.data });

  await createAuditLog({
    actorId: actor.userId,
    action: "company.update",
    targetType: "Company",
    targetId: companyId,
    // On journalise l'avant/après du statut : c'est le changement qui a des
    // conséquences (une société archivée disparaît des rattachements).
    metadata: {
      name: parsed.data.name,
      statusFrom: current.status,
      statusTo: parsed.data.status,
    },
  });

  revalidatePath("/admin/societes");
  revalidatePath(`/admin/societes/${companyId}`);
  return { success: true, companyId, message: "Société mise à jour." };
}

/**
 * Archive ou réactive une société.
 *
 * L'archivage la retire des listes de rattachement sans toucher aux élèves
 * déjà rattachés ni à leurs accès.
 */
export async function setCompanyStatus(
  companyId: string,
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED",
): Promise<CompanyActionResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole();
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, status: true, _count: { select: { students: true } } },
  });
  if (!company) return { success: false, message: "Société introuvable." };

  await prisma.company.update({ where: { id: companyId }, data: { status } });

  await createAuditLog({
    actorId: actor.userId,
    action: "company.status",
    targetType: "Company",
    targetId: companyId,
    metadata: {
      name: company.name,
      from: company.status,
      to: status,
      studentCount: company._count.students,
    },
  });

  revalidatePath("/admin/societes");
  revalidatePath(`/admin/societes/${companyId}`);
  return {
    success: true,
    companyId,
    message:
      status === "ARCHIVED"
        ? `« ${company.name} » archivée. Ses ${company._count.students} élève(s) et leurs accès sont conservés.`
        : "Statut mis à jour.",
  };
}
