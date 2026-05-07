import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ModerationForm } from "@/components/features/admin/moderation-form";
import { CourseStatusBadge } from "@/components/features/instructor/course-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDurationFromSeconds } from "@/lib/format/duration";
import { formatPrice } from "@/lib/money";
import { getAdminCourse } from "@/server/queries/admin";

export const metadata: Metadata = {
  title: "Examiner un cours",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCourseReviewPage({ params }: PageProps) {
  const { id } = await params;
  const course = await getAdminCourse(id);
  if (!course) notFound();

  const totalLessons = course.sections.reduce((acc, s) => acc + s.lessons.length, 0);

  return (
    <div className="space-y-6">
      <Button asChild variant="link" size="sm" className="h-auto px-0 text-muted-foreground">
        <Link href="/admin/cours">← Retour</Link>
      </Button>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {course.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Par {course.instructor.name ?? course.instructor.email}
          </p>
        </div>
        <CourseStatusBadge status={course.status} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Détails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Catégorie : </span>
                {course.category.name}
              </p>
              <p>
                <span className="text-muted-foreground">Niveau : </span>
                {course.level}
              </p>
              <p>
                <span className="text-muted-foreground">Prix : </span>
                {formatPrice(Number(course.priceEUR), "EUR")} ·{" "}
                {formatPrice(Number(course.priceUSD), "USD")}
              </p>
              <p>
                <span className="text-muted-foreground">Durée : </span>
                {formatDurationFromSeconds(course.durationSeconds)} ·{" "}
                {course.sections.length} sections · {totalLessons} leçons
              </p>
              <p>
                <span className="text-muted-foreground">Image : </span>
                {course.thumbnailUrl ? (
                  <Link
                    href={course.thumbnailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[color:var(--brand-secondary)] hover:underline"
                  >
                    Voir
                  </Link>
                ) : (
                  <span className="text-destructive">absente</span>
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
              {course.description}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Programme</CardTitle>
              <CardDescription>
                {course.sections.length} sections · {totalLessons} leçons
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {course.sections.map((section) => (
                  <li key={section.id}>
                    <p className="font-medium text-foreground">{section.title}</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                      {section.lessons.map((lesson) => (
                        <li key={lesson.id}>
                          {lesson.title}
                          {lesson.muxPlaybackId ? " · vidéo prête" : ""}
                          {lesson.isFreePreview ? " · aperçu" : ""}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Décision de modération</CardTitle>
            </CardHeader>
            <CardContent>
              <ModerationForm courseId={course.id} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
