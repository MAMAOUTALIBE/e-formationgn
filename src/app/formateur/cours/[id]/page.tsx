import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { CourseGeneralForm } from "@/components/features/instructor/course-general-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listCategories } from "@/server/queries/categories";
import { getInstructorCourse } from "@/server/queries/instructor";
import type { CourseLevel } from "@/generated/prisma/enums";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseGeneralPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const [course, categories] = await Promise.all([
    getInstructorCourse(id, session.user.id, session.user.role === "ADMIN"),
    listCategories(),
  ]);
  if (!course) notFound();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informations générales</CardTitle>
      </CardHeader>
      <CardContent>
        <CourseGeneralForm
          courseId={course.id}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          defaults={{
            title: course.title,
            subtitle: course.subtitle ?? "",
            description: course.description,
            categoryId: course.categoryId,
            level: course.level as CourseLevel,
            thumbnailUrl: course.thumbnailUrl ?? "",
          }}
        />
      </CardContent>
    </Card>
  );
}
