// Listing admin des cours avec filtres avancés.

import type { Prisma } from "@/generated/prisma/client";
import type { CourseStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export interface AdminCoursesFilters {
  q?: string;
  status?: CourseStatus;
  categoryId?: string;
  instructorId?: string;
  featured?: boolean;
  page?: number;
  pageSize?: number;
  sort?: AdminCoursesSort;
  direction?: "asc" | "desc";
}

/** Colonnes de tri admises — valeurs, pour que l'URL puisse être vérifiée. */
export const ADMIN_COURSES_SORTS = [
  "title",
  "status",
  "instructor",
  "category",
  "enrollments",
  "updatedAt",
] as const;

export type AdminCoursesSort = (typeof ADMIN_COURSES_SORTS)[number];

export interface AdminCourseRow {
  id: string;
  slug: string;
  title: string;
  status: CourseStatus;
  isFeatured: boolean;
  featuredOrder: number | null;
  averageRating: number;
  totalRatings: number;
  totalEnrollments: number;
  deletion: { enrollments: number; orderItems: number; certificates: number; programs: number };
  priceEUR: number;
  category: { id: string; name: string };
  instructor: { id: string; name: string | null; email: string };
  createdAt: Date;
  updatedAt: Date;
}

export async function listAdminCourses(
  filters: AdminCoursesFilters,
): Promise<{ rows: AdminCourseRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  const where: Prisma.CourseWhereInput = {};
  if (filters.q && filters.q.trim().length > 0) {
    const q = filters.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }
  if (filters.status) where.status = filters.status;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.instructorId) where.instructorId = filters.instructorId;
  if (filters.featured === true) where.isFeatured = true;
  if (filters.featured === false) where.isFeatured = false;

  const direction = filters.direction === "asc" ? "asc" : "desc";
  const orderBy: Prisma.CourseOrderByWithRelationInput =
    filters.sort === "title" ? { title: direction }
    : filters.sort === "status" ? { status: direction }
    : filters.sort === "instructor" ? { instructor: { name: direction } }
    : filters.sort === "category" ? { category: { name: direction } }
    : filters.sort === "enrollments" ? { totalEnrollments: direction }
    : { updatedAt: direction };

  const [rows, total] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        isFeatured: true,
        featuredOrder: true,
        averageRating: true,
        totalRatings: true,
        totalEnrollments: true,
        _count: { select: { enrollments: true, orderItems: true, certificates: true, programs: true } },
        priceEUR: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { id: true, name: true } },
        instructor: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.course.count({ where }),
  ]);

  return {
    rows: rows.map(({ _count, ...r }) => ({ ...r, priceEUR: Number(r.priceEUR), deletion: _count })),
    total,
    page,
    pageSize,
  };
}

export async function listFeaturedCoursesAdmin(): Promise<AdminCourseRow[]> {
  const rows = await prisma.course.findMany({
    where: { isFeatured: true },
    orderBy: [{ featuredOrder: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      isFeatured: true,
      featuredOrder: true,
      averageRating: true,
      totalRatings: true,
      totalEnrollments: true,
      _count: { select: { enrollments: true, orderItems: true, certificates: true, programs: true } },
      priceEUR: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { id: true, name: true } },
      instructor: { select: { id: true, name: true, email: true } },
    },
  });
  return rows.map(({ _count, ...r }) => ({ ...r, priceEUR: Number(r.priceEUR), deletion: _count }));
}

export async function getAdminCoursesDashboardData() {
  const [statusCounts, totals, instructors] = await Promise.all([
    prisma.course.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.course.aggregate({
      _count: { _all: true },
      _sum: { totalEnrollments: true },
    }),
    prisma.user.findMany({
      where: { isInstructor: true },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
  ]);
  const count = (status: CourseStatus) =>
    statusCounts.find((item) => item.status === status)?._count._all ?? 0;
  return {
    stats: {
      total: totals._count._all,
      published: count("PUBLISHED"),
      pending: count("PENDING_REVIEW"),
      draft: count("DRAFT"),
      archived: count("ARCHIVED"),
      rejected: count("REJECTED"),
      enrollments: totals._sum.totalEnrollments ?? 0,
    },
    instructors,
  };
}
