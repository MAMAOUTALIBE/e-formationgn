// Queries serveur — catégories.

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const CATEGORY_LIST_INCLUDE = {
  _count: {
    select: {
      courses: { where: { status: "PUBLISHED" } },
    },
  },
} satisfies Prisma.CategoryInclude;

export type CategoryWithCount = Prisma.CategoryGetPayload<{
  include: typeof CATEGORY_LIST_INCLUDE;
}>;

export async function listCategories(): Promise<CategoryWithCount[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true, parentId: null },
    include: CATEGORY_LIST_INCLUDE,
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
  return categories as CategoryWithCount[];
}

export async function getCategoryBySlug(slug: string): Promise<CategoryWithCount | null> {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: CATEGORY_LIST_INCLUDE,
  });
  if (!category || !category.isActive) return null;
  return category as CategoryWithCount;
}

export async function listFeaturedCategories(limit = 8): Promise<CategoryWithCount[]> {
  // Pour l'instant : les premières catégories par displayOrder.
  // À terme : pondérer par nombre de cours / popularité.
  const categories = await prisma.category.findMany({
    where: { isActive: true, parentId: null },
    include: CATEGORY_LIST_INCLUDE,
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    take: limit,
  });
  return categories as CategoryWithCount[];
}
