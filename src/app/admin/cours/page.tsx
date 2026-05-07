import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listPendingCourses } from "@/server/queries/admin";

export const metadata: Metadata = {
  title: "Modération des cours",
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function AdminCoursesPage() {
  const courses = await listPendingCourses();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Modération des cours
        </h1>
        <p className="text-sm text-muted-foreground">
          {courses.length.toLocaleString("fr-FR")} cours en attente de validation.
        </p>
      </header>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Aucun cours en attente. ✓
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {courses.map((course) => (
            <li key={course.id}>
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{course.title}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Soumis le {dateFormatter.format(course.updatedAt)} ·{" "}
                      {course.category.name} · {course.instructor.name ?? "Formateur"}
                    </p>
                  </div>
                  <Button asChild>
                    <Link href={`/admin/cours/${course.id}`}>Examiner</Link>
                  </Button>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="line-clamp-2">{course.description}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
