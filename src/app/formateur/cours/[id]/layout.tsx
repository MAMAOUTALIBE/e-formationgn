import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { auth } from "@/auth";
import { CourseStatusBadge } from "@/components/features/instructor/course-status-badge";
import { CourseSubmissionPanel } from "@/components/features/instructor/course-submission-panel";
import { Button } from "@/components/ui/button";
import { getInstructorCourse } from "@/server/queries/instructor";

import { CourseEditorTabs } from "./_components/course-editor-tabs";

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

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="link" size="sm" className="h-auto px-0 text-muted-foreground">
          <Link href="/formateur/cours">
            <ArrowLeft className="h-4 w-4" />
            Retour à mes cours
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
          ) : null}
          <CourseSubmissionPanel courseId={course.id} status={course.status} />
        </div>
      </div>

      {course.status === "REJECTED" && course.rejectionReason ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
          <p className="font-medium">Modération refusée</p>
          <p className="mt-1 text-muted-foreground">{course.rejectionReason}</p>
        </div>
      ) : null}

      <CourseEditorTabs courseId={course.id} />

      {children}
    </div>
  );
}
