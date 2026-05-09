import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface AdminDashboardStats {
  totalUsers: number;
  totalInstructors: number;
  totalCourses: number;
  pendingCourses: number;
  publishedCourses: number;
  totalOrders: number;
  paidOrders: number;
  grossRevenueCents: number;
  platformFeeCents: number;
  byCurrency: Record<
    "EUR" | "USD" | "GNF" | "XOF",
    { gross: number; platform: number }
  >;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const [
    users,
    instructors,
    coursesByStatus,
    ordersByStatus,
    revenueByCurrency,
    feeByCurrency,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isInstructor: true } }),
    prisma.course.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["currency"],
      where: { status: "PAID" },
      _sum: { totalCents: true },
    }),
    prisma.orderItem.groupBy({
      by: ["currency"],
      where: { order: { status: "PAID" } },
      _sum: { platformFeeCents: true },
    }),
  ]);

  const stats: AdminDashboardStats = {
    totalUsers: users,
    totalInstructors: instructors,
    totalCourses: coursesByStatus.reduce((acc, c) => acc + c._count._all, 0),
    pendingCourses:
      coursesByStatus.find((c) => c.status === "PENDING_REVIEW")?._count._all ?? 0,
    publishedCourses:
      coursesByStatus.find((c) => c.status === "PUBLISHED")?._count._all ?? 0,
    totalOrders: ordersByStatus.reduce((acc, o) => acc + o._count._all, 0),
    paidOrders: ordersByStatus.find((o) => o.status === "PAID")?._count._all ?? 0,
    grossRevenueCents: 0,
    platformFeeCents: 0,
    byCurrency: {
      EUR: { gross: 0, platform: 0 },
      USD: { gross: 0, platform: 0 },
      GNF: { gross: 0, platform: 0 },
      XOF: { gross: 0, platform: 0 },
    },
  };

  for (const row of revenueByCurrency) {
    const cents = row._sum.totalCents ?? 0;
    stats.grossRevenueCents += cents;
    stats.byCurrency[row.currency].gross = cents;
  }
  for (const row of feeByCurrency) {
    const cents = row._sum.platformFeeCents ?? 0;
    stats.platformFeeCents += cents;
    stats.byCurrency[row.currency].platform = cents;
  }
  return stats;
}

export async function listPendingCourses() {
  return prisma.course.findMany({
    where: { status: "PENDING_REVIEW" },
    include: {
      instructor: { select: { id: true, name: true, email: true } },
      category: { select: { name: true, slug: true } },
      _count: { select: { sections: true } },
    },
    orderBy: { updatedAt: "asc" },
  });
}

export async function getAdminCourse(courseId: string) {
  return prisma.course.findUnique({
    where: { id: courseId },
    include: {
      instructor: { select: { id: true, name: true, email: true } },
      category: { select: { name: true, slug: true } },
      sections: {
        include: { lessons: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });
}

export async function listUsersForAdmin(query?: string) {
  const where: Prisma.UserWhereInput = query
    ? {
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
        ],
      }
    : {};
  return prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      isInstructor: true,
      createdAt: true,
      _count: { select: { coursesAuthored: true, enrollments: true, orders: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
