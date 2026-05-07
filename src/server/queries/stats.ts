import { prisma } from "@/lib/prisma";

export interface PublicStats {
  totalStudents: number;
  totalInstructors: number;
  totalCourses: number;
  totalCategories: number;
}

export async function getPublicStats(): Promise<PublicStats> {
  const [students, instructors, courses, categories] = await Promise.all([
    prisma.user.count({ where: { isInstructor: false } }),
    prisma.user.count({ where: { isInstructor: true } }),
    prisma.course.count({ where: { status: "PUBLISHED" } }),
    prisma.category.count({ where: { isActive: true, parentId: null } }),
  ]);

  return {
    totalStudents: students,
    totalInstructors: instructors,
    totalCourses: courses,
    totalCategories: categories,
  };
}
