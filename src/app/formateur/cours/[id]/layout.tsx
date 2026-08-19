import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Eye } from "lucide-react";

import { auth } from "@/auth";
import { CourseReadinessChecklist } from "@/components/features/instructor/course-readiness-checklist";
import { CourseStatusBadge } from "@/components/features/instructor/course-status-badge";
import { CourseSubmissionPanel } from "@/components/features/instructor/course-submission-panel";
import { Button } from "@/components/ui/button";
import {
  computeCourseReadiness,
  getInstructorCourse,
} from "@/server/queries/instructor";

import { CourseEditorTabs } from "./_components/course-editor-tabs";
import { WizardFooter } from "./_components/wizard-footer";
import { getWizardState } from "./_components/wizard-state";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function CourseEditLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const course = await getInstructorCourse(
    id,
    session.user.id,
    session.user.role === "ADMIN",
  );
  if (!course) notFound();

  const { completedSlugs, unlockedMaxIndex } = await getWizardState(id);
  const readiness = computeCourseReadiness(course);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="link" size="sm" className="h-auto px-0 text-muted-foreground">
          <Link href="/formateur/cours">
            <ArrowLeft className="h-4 w-4" />
            Retour à mes formations
          </Link>
        </Button>
      </div>

      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {course.title}
          </h1>
          <CourseStatusBadge status={course.status} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {course.status === "PUBLISHED" ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/cours/${course.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Voir la page publique
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/cours/${course.slug}?preview=1`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Eye className="h-4 w-4" />
                Aperçu élève
              </Link>
            </Button>
          )}
          <CourseSubmissionPanel courseId={course.id} status={course.status} />
        </div>
      </div>

      {course.status === "REJECTED" && course.rejectionReason ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
          <p className="font-medium">Modération refusée</p>
          <p className="mt-1 text-muted-foreground">{course.rejectionReason}</p>
        </div>
      ) : null}

      {course.status !== "PUBLISHED" ? (
        <CourseReadinessChecklist courseId={course.id} readiness={readiness} />
      ) : null}

      <CourseEditorTabs
        courseId={course.id}
        completedSlugs={completedSlugs}
        unlockedMaxIndex={unlockedMaxIndex}
      />

      {children}

      <WizardFooter courseId={course.id} unlockedMaxIndex={unlockedMaxIndex} />
    </div>
  );
}
