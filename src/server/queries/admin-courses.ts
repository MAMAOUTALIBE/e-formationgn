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
}

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

  const [rows, total] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy: { updatedAt: "desc" },
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
    rows: rows.map((r) => ({ ...r, priceEUR: Number(r.priceEUR) })),
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
      priceEUR: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { id: true, name: true } },
      instructor: { select: { id: true, name: true, email: true } },
    },
  });
  return rows.map((r) => ({ ...r, priceEUR: Number(r.priceEUR) }));
}
