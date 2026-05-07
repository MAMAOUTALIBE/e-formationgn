// Requêtes liste/fiche utilisateurs côté admin.
// Filtres : rôle, statut, q (email/nom), pays, dernière connexion, banni.
// Pagination cursor-less (offset) — adaptée jusqu'à ~50 k users.

import type { Prisma } from "@/generated/prisma/client";
import type { AccountStatus, UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export interface AdminUsersFilters {
  q?: string;
  role?: UserRole;
  status?: AccountStatus;
  banned?: boolean;
  country?: string;
  inactiveDays?: number; // dernier login il y a plus de X jours
  page?: number;
  pageSize?: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: AccountStatus;
  country: string | null;
  isInstructor: boolean;
  bannedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  ordersCount: number;
  totalSpentCentsEur: number;
}

export async function listAdminUsers(
  filters: AdminUsersFilters,
): Promise<{ rows: AdminUserRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  const where: Prisma.UserWhereInput = {};
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
  if (filters.role) where.role = filters.role;
  if (filters.status) where.status = filters.status;
  if (filters.country) where.country = filters.country;
  if (filters.banned === true) where.bannedAt = { not: null };
  if (filters.banned === false) where.bannedAt = null;
  if (filters.inactiveDays && filters.inactiveDays > 0) {
    const threshold = new Date(Date.now() - filters.inactiveDays * 24 * 3600 * 1000);
    ors.push({ lastLoginAt: null }, { lastLoginAt: { lt: threshold } });
  }
  if (ors.length > 0) where.OR = ors;

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        country: true,
        isInstructor: true,
        bannedAt: true,
        lastLoginAt: true,
        createdAt: true,
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
    rows: rows.map((u) => ({
      ...u,
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
          orders: true,
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

  const [orders, enrollments, recentAudit, notes] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        currency: true,
        totalCents: true,
        createdAt: true,
        paidAt: true,
        items: { select: { course: { select: { title: true } } } },
      },
    }),
    prisma.enrollment.findMany({
      where: { userId },
      orderBy: { enrolledAt: "desc" },
      take: 20,
      select: {
        id: true,
        progressPercent: true,
        completedAt: true,
        enrolledAt: true,
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

  const spendByCurrency = await prisma.order.groupBy({
    by: ["currency"],
    where: { userId, status: "PAID" },
    _sum: { totalCents: true },
  });

  return { user, orders, enrollments, recentAudit, notes, spendByCurrency };
}

export interface CountryFacet {
  country: string;
  count: number;
}

export async function listUserCountries(): Promise<CountryFacet[]> {
  const rows = await prisma.user.groupBy({
    by: ["country"],
    where: { country: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { country: "desc" } },
    take: 50,
  });
  return rows
    .filter((r): r is { country: string; _count: { _all: number } } => r.country !== null)
    .map((r) => ({ country: r.country, count: r._count._all }));
}
