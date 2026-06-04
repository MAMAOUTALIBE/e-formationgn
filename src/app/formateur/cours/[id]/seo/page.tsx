import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { CourseSeoForm } from "@/components/features/instructor/course-seo-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isSeoAiConfigured } from "@/lib/ai/seo-suggestions";
import { getInstructorCourse } from "@/server/queries/instructor";

import { assertStepUnlocked } from "../_components/wizard-state";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseSeoPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const course = await getInstructorCourse(
    id,
    session.user.id,
    session.user.role === "ADMIN",
  );
  if (!course) notFound();

  // Mode strict : accès verrouillé tant que Général/Programme ne sont pas complets.
  await assertStepUnlocked(id, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle>SEO et objectifs pédagogiques</CardTitle>
      </CardHeader>
      <CardContent>
        <CourseSeoForm
          courseId={course.id}
          aiAvailable={isSeoAiConfigured()}
          defaults={{
            metaTitle: course.metaTitle ?? "",
            metaDescription: course.metaDescription ?? "",
            whatYouWillLearn: course.whatYouWillLearn.join("\n"),
            requirements: course.requirements.join("\n"),
            targetAudience: course.targetAudience.join("\n"),
          }}
        />
      </CardContent>
    </Card>
  );
}
