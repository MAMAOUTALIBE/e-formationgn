import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { auth } from "@/auth";
import { CourseStatusBadge } from "@/components/features/instructor/course-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pluralize } from "@/lib/format/labels";
import { formatPrice } from "@/lib/money";
import { listInstructorCourses } from "@/server/queries/instructor";

export const metadata: Metadata = {
  title: "Mes cours",
};

export default async function InstructorCoursesPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion");

  const courses = await listInstructorCourses(session.user.id);

  return (
    <div className="space-y-6">
      <header className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Mes cours</h1>
          <p className="text-sm text-muted-foreground">
            {courses.length.toLocaleString("fr-FR")} {pluralize(courses.length, "cours", "cours")}
          </p>
        </div>
        <Button asChild>
          <Link href="/formateur/cours/nouveau">
            <Plus className="h-4 w-4" />
            Nouveau cours
          </Link>
        </Button>
      </header>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <p className="text-base font-medium text-foreground">
              Vous n&apos;avez pas encore créé de cours.
            </p>
            <p className="text-sm text-muted-foreground">
              Lancez-vous : un cours commence par un titre et une catégorie.
            </p>
            <Button asChild>
              <Link href="/formateur/cours/nouveau">Créer mon premier cours</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Cours</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Élèves</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Prix</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Sections</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {courses.map((course) => (
                <tr key={course.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/formateur/cours/${course.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {course.title}
                    </Link>
                    {course.subtitle ? (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {course.subtitle}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <CourseStatusBadge status={course.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {course.category.name}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {course._count.enrollments}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {Number(course.priceEUR) === 0
                      ? "Gratuit"
                      : formatPrice(Number(course.priceEUR), "EUR")}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {course._count.sections}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="link" size="sm" className="h-auto px-0">
                      <Link href={`/formateur/cours/${course.id}`}>Modifier</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
