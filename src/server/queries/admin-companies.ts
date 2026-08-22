import "server-only";

// Lectures liées aux sociétés clientes.
//
// Le point 16 du cahier des charges — « retrouver rapidement une société, ses
// élèves et leurs formations » — se joue ici : la liste est cherchable sur la
// raison sociale, le SIRET et la ville, et la fiche ramène les élèves en une
// seule requête plutôt qu'un aller-retour par élève.

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Statuts admis — la page s'en sert pour valider ce qui arrive de l'URL. */
export const COMPANY_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export interface CompanyListParams {
  search?: string;
  status?: CompanyStatus;
  city?: string;
  page?: number;
  pageSize?: number;
}

export interface CompanyListRow {
  id: string;
  name: string;
  siret: string | null;
  city: string | null;
  opco: string | null;
  status: string;
  studentCount: number;
  createdAt: Date;
}

export async function listCompanies(params: CompanyListParams = {}): Promise<{
  rows: CompanyListRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 25));
  const skip = (page - 1) * pageSize;
  const search = params.search?.trim();

  const where: Prisma.CompanyWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.city ? { city: params.city } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            // Le SIRET est saisi avec ou sans espaces selon les documents :
            // on cherche sur la forme compactée, celle qui est stockée.
            { siret: { contains: search.replace(/\s+/g, "") } },
            { city: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      select: {
        id: true,
        name: true,
        siret: true,
        city: true,
        opco: true,
        status: true,
        createdAt: true,
        // Compter en base plutôt que charger les élèves : la liste n'affiche
        // qu'un nombre, et une société peut en compter des centaines.
        _count: { select: { students: true } },
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.company.count({ where }),
  ]);

  return {
    rows: companies.map((c) => ({
      id: c.id,
      name: c.name,
      siret: c.siret,
      city: c.city,
      opco: c.opco,
      status: c.status,
      studentCount: c._count.students,
      createdAt: c.createdAt,
    })),
    total,
    page,
    pageSize,
  };
}

export interface CompanyDashboardStats {
  total: number;
  active: number;
  inactive: number;
  archived: number;
  studentsAttached: number;
  createdThisMonth: number;
  cities: string[];
}

/** Agrégats réels de l'espace Sociétés, calculés en parallèle avec la liste. */
export async function getCompanyDashboardStats(): Promise<CompanyDashboardStats> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [total, active, inactive, archived, studentsAttached, createdThisMonth, cityRows] =
    await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { status: "ACTIVE" } }),
      prisma.company.count({ where: { status: "INACTIVE" } }),
      prisma.company.count({ where: { status: "ARCHIVED" } }),
      prisma.user.count({ where: { companyId: { not: null } } }),
      prisma.company.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.company.findMany({
        where: { city: { not: null } },
        distinct: ["city"],
        select: { city: true },
        orderBy: { city: "asc" },
      }),
    ]);

  return {
    total,
    active,
    inactive,
    archived,
    studentsAttached,
    createdThisMonth,
    cities: cityRows.flatMap((row) => (row.city ? [row.city] : [])),
  };
}

/** Fiche complète : la société et ses élèves. */
export async function getCompanyDetail(companyId: string) {
  return prisma.company.findUnique({
    where: { id: companyId },
    include: {
      students: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
          role: true,
          createdAt: true,
          // Nombre d'accès réellement attribués — c'est l'information que
          // cherche un gestionnaire qui ouvre une fiche société.
          _count: { select: { enrollments: true } },
        },
        orderBy: [{ lastName: "asc" }, { email: "asc" }],
      },
    },
  });
}

/**
 * Sociétés proposables au rattachement d'un élève.
 *
 * Les sociétés archivées sont exclues : on ne doit pas pouvoir rattacher un
 * nouvel élève à un client clos. Celles qui le sont déjà gardent leur
 * rattachement — l'archivage ne casse pas l'historique.
 */
export async function listSelectableCompanies(): Promise<
  Array<{ id: string; name: string; city: string | null }>
> {
  return prisma.company.findMany({
    where: { status: { in: ["ACTIVE", "INACTIVE"] } },
    select: { id: true, name: true, city: true },
    orderBy: { name: "asc" },
  });
}

/** Y a-t-il au moins une société ? Conditionne l'inscription d'un élève. */
export async function hasAnyCompany(): Promise<boolean> {
  const count = await prisma.company.count({
    where: { status: { in: ["ACTIVE", "INACTIVE"] } },
  });
  return count > 0;
}
