import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { CourseGeneralForm } from "@/components/features/instructor/course-general-form";
import { MuxPromoUploader } from "@/components/features/instructor/mux-promo-uploader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isMuxConfigured } from "@/lib/mux";
import { listCategories } from "@/server/queries/categories";
import { getInstructorCourse } from "@/server/queries/instructor";
import type { CourseLevel } from "@/generated/prisma/enums";

import { stepHref } from "./_components/wizard";

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent>
          <CourseGeneralForm
            courseId={course.id}
            nextHref={stepHref(course.id, "programme")}
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

      <Card>
        <CardHeader>
          <CardTitle>Vidéo de présentation</CardTitle>
          <CardDescription>
            Court teaser (1–2 min recommandé) montré aux visiteurs sur la fiche du
            cours, avant achat. Optionnel mais fortement recommandé pour
            convertir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MuxPromoUploader
            courseId={course.id}
            initialPlaybackId={course.promoVideoPlaybackId}
            isMuxConfigured={isMuxConfigured()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
