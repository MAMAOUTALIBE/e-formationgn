// Requêtes liste/fiche utilisateurs côté admin.
// Filtres apprenants : statut, q (email/nom), pays, dernière connexion, banni.
// Pagination cursor-less (offset) — adaptée jusqu'à ~50 k users.

import type { Prisma } from "@/generated/prisma/client";
import type { AccountStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export interface AdminUsersFilters {
  q?: string;
  /** Société de rattachement — le filtre central de la liste des apprenants. */
  companyId?: string;
  status?: AccountStatus;
  banned?: boolean;
  country?: string;
  inactiveDays?: number; // dernier login il y a plus de X jours
  page?: number;
  pageSize?: number;
  sort?: AdminUsersSort;
  direction?: "asc" | "desc";
}

export type AdminUsersSort =
  | "name"
  | "company"
  | "status"
  | "country"
  | "createdAt";

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  status: AccountStatus;
  country: string | null;
  companyId: string | null;
  companyName: string | null;
  isInstructor: boolean;
  bannedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  ordersCount: number;
  totalSpentCentsEur: number;
  enrollmentsCount: number;
}

export async function listAdminUsers(
  filters: AdminUsersFilters,
): Promise<{ rows: AdminUserRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  // Cette requête alimente exclusivement l'espace Apprenants. La frontière
  // est imposée ici, côté serveur, et ne dépend donc pas d'un filtre d'URL.
  const where: Prisma.UserWhereInput = { role: "STUDENT" };
  const ors: Prisma.UserWhereInput[] = [];
  if (filters.q && filters.q.trim().length > 0) {
    const q = filters.q.trim();
    ors.push(
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
    );
  }
  if (filters.companyId) where.companyId = filters.companyId;
  if (filters.status) where.status = filters.status;
  if (filters.country) where.country = filters.country;
  if (filters.banned === true) where.bannedAt = { not: null };
  if (filters.banned === false) where.bannedAt = null;
  if (filters.inactiveDays && filters.inactiveDays > 0) {
    const threshold = new Date(Date.now() - filters.inactiveDays * 24 * 3600 * 1000);
    ors.push({ lastLoginAt: null }, { lastLoginAt: { lt: threshold } });
  }
  if (ors.length > 0) where.OR = ors;

  const direction = filters.direction === "asc" ? "asc" : "desc";
  const orderBy: Prisma.UserOrderByWithRelationInput =
    filters.sort === "name" ? { name: direction }
    : filters.sort === "company" ? { company: { name: direction } }
    : filters.sort === "status" ? { status: direction }
    : filters.sort === "country" ? { country: direction }
    : { createdAt: direction };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        country: true,
        companyId: true,
        company: { select: { name: true } },
        isInstructor: true,
        bannedAt: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { enrollments: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  // KPIs par user (commandes payées + total dépensé EUR uniquement, simple).
  const userIds = rows.map((u) => u.id);
  const orderAgg = await prisma.order.groupBy({
    by: ["userId", "currency"],
    where: { userId: { in: userIds }, status: "PAID" },
    _sum: { totalCents: true },
    _count: { _all: true },
  });
  const aggMap = new Map<string, { orders: number; spentEur: number }>();
  for (const a of orderAgg) {
    const existing = aggMap.get(a.userId) ?? { orders: 0, spentEur: 0 };
    existing.orders += a._count._all;
    if (a.currency === "EUR") existing.spentEur += a._sum.totalCents ?? 0;
    aggMap.set(a.userId, existing);
  }

  return {
    rows: rows.map(({ company, _count, ...u }) => ({
      ...u,
      companyName: company?.name ?? null,
      enrollmentsCount: _count.enrollments,
      ordersCount: aggMap.get(u.id)?.orders ?? 0,
      totalSpentCentsEur: aggMap.get(u.id)?.spentEur ?? 0,
    })),
    total,
    page,
    pageSize,
  };
}

export async function getAdminUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          enrollments: true,
          coursesAuthored: true,
          reviews: true,
          questions: true,
          certificates: true,
        },
      },
    },
  });
  if (!user) return null;

  const [enrollments, recentAudit, notes] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId },
      orderBy: { enrolledAt: "desc" },
      take: 20,
      select: {
        id: true,
        progressPercent: true,
        completedAt: true,
        enrolledAt: true,
        // `source` distingue un accès attribué par le centre d'un achat : le
        // retrait d'accès n'est autorisé que sur le premier.
        source: true,
        course: { select: { id: true, title: true, slug: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { OR: [{ actorId: userId }, { targetType: "User", targetId: userId }] },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, action: true, createdAt: true, metadata: true },
    }),
    prisma.adminNote.findMany({
      where: { targetType: "USER", targetId: userId },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { name: true, email: true } } },
    }),
  ]);

  const [engagement, lastSession] = await Promise.all([
    // Engagement apprentissage : lessons commencées/terminées + temps cumulé
    prisma.lessonProgress
      .aggregate({
        where: { userId },
        _sum: { watchedSeconds: true },
        _count: { _all: true },
      })
      .then(async (started) => {
        const completed = await prisma.lessonProgress.count({
          where: { userId, isCompleted: true },
        });
        return {
          lessonsStarted: started._count._all,
          lessonsCompleted: completed,
          totalWatchedSeconds: started._sum.watchedSeconds ?? 0,
        };
      }),
    // Dernière session
    prisma.session.findFirst({
      where: { userId },
      orderBy: { expires: "desc" },
      select: { expires: true },
    }),
  ]);

  return {
    user,
    enrollments,
    recentAudit,
    notes,
    engagement,
    lastSessionExpires: lastSession?.expires ?? null,
  };
}

export interface CountryFacet {
  country: string;
  count: number;
}

export interface AdminUsersDashboardStats {
  total: number;
  withCompany: number;
  createdLast30Days: number;
  active: number;
  pending: number;
  suspended: number;
  banned: number;
  deleted: number;
}

/** Indicateurs de l'espace apprenants, calculés uniquement sur les élèves. */
export async function getAdminUsersDashboardStats(): Promise<AdminUsersDashboardStats> {
  const audience: Prisma.UserWhereInput = {
    role: "STUDENT",
  };
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [total, withCompany, createdLast30Days, active, pending, suspended, banned, deleted] =
    await Promise.all([
      prisma.user.count({ where: audience }),
      prisma.user.count({ where: { ...audience, companyId: { not: null } } }),
      prisma.user.count({ where: { ...audience, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { ...audience, status: "ACTIVE", bannedAt: null } }),
      prisma.user.count({ where: { ...audience, status: "PENDING_VERIFICATION", bannedAt: null } }),
      prisma.user.count({ where: { ...audience, status: "SUSPENDED", bannedAt: null } }),
      prisma.user.count({ where: { ...audience, bannedAt: { not: null } } }),
      prisma.user.count({ where: { ...audience, status: "DELETED", bannedAt: null } }),
    ]);

  return { total, withCompany, createdLast30Days, active, pending, suspended, banned, deleted };
}

export async function listUserCountries(): Promise<CountryFacet[]> {
  const rows = await prisma.user.groupBy({
    by: ["country"],
    where: { role: "STUDENT", country: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { country: "desc" } },
    take: 50,
  });
  return rows
    .filter((r): r is { country: string; _count: { _all: number } } => r.country !== null)
    .map((r) => ({ country: r.country, count: r._count._all }));
}
