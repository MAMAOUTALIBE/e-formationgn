import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { Archive, ArchiveRestore, Copy } from "lucide-react";

import { auth } from "@/auth";
import { ConfirmAction } from "@/components/features/instructor/confirm-action";
import { CourseListFilters } from "@/components/features/instructor/course-list-filters";
import { CourseStatusBadge } from "@/components/features/instructor/course-status-badge";
import { Button } from "@/components/ui/button";
import {
  archiveCourse,
  duplicateCourse,
  restoreArchivedCourse,
} from "@/server/actions/instructor";
import { Card, CardContent } from "@/components/ui/card";
import { pluralize } from "@/lib/format/labels";
import {
  computeCourseReadiness,
  listInstructorCourses,
} from "@/server/queries/instructor";

export const metadata: Metadata = {
  title: "Mes cours",
};

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; sort?: string }>;
}

export default async function InstructorCoursesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");

  const { q = "", status = "ALL", sort = "recent" } = await searchParams;
  const allCourses = await listInstructorCourses(session.user.id);

  // Filtrage + tri en mémoire (catalogue formateur = volume modéré).
  const query = q.trim().toLowerCase();
  let courses = allCourses.filter((c) => {
    if (status !== "ALL" && c.status !== status) return false;
    if (query && !c.title.toLowerCase().includes(query)) return false;
    return true;
  });
  if (sort === "title") {
    courses = [...courses].sort((a, b) => a.title.localeCompare(b.title, "fr"));
  } else if (sort === "enrollments") {
    courses = [...courses].sort(
      (a, b) => b._count.enrollments - a._count.enrollments,
    );
  }
  // "recent" : déjà trié par updatedAt desc côté requête.

  const hasFilters = query !== "" || status !== "ALL" || sort !== "recent";

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-clip">
      <header className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Mes cours</h1>
          <p className="text-sm text-muted-foreground">
            {courses.length.toLocaleString("fr-FR")} {pluralize(courses.length, "cours", "cours")}
            {hasFilters ? ` · ${allCourses.length} au total` : ""}
          </p>
        </div>
        <Button asChild>
          <Link href="/formateur/cours/nouveau">
            <Plus className="h-4 w-4" />
            Nouveau cours
          </Link>
        </Button>
      </header>

      {allCourses.length > 0 ? <CourseListFilters /> : null}

      {allCourses.length === 0 ? (
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
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <p className="text-base font-medium text-foreground">
              Aucun cours ne correspond à votre recherche.
            </p>
            <Button asChild variant="link">
              <Link href="/formateur/cours">Réinitialiser les filtres</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="min-w-0 max-w-full overflow-x-auto rounded-lg border border-border bg-card [contain:paint]">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Cours</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Élèves</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Sections</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Prêt</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {courses.map((course) => {
                const readiness = computeCourseReadiness(course);
                return (
                <tr key={course.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="hidden h-10 w-[71px] shrink-0 overflow-hidden rounded border border-border bg-muted sm:block">
                        {course.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={course.thumbnailUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
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
                      </div>
                    </div>
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
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {course._count.sections}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {course.status === "PUBLISHED" ? (
                      <span className="text-xs text-muted-foreground">Publié</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${readiness.percent}%`,
                              backgroundColor: readiness.ready
                                ? "var(--brand-success)"
                                : "var(--brand-primary)",
                            }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {readiness.percent}%
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Button asChild variant="link" size="sm" className="h-auto px-0">
                        <Link href={`/formateur/cours/${course.id}`}>Modifier</Link>
                      </Button>
                      <form action={duplicateCourse.bind(null, course.id)}>
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="h-auto px-2 text-muted-foreground"
                          title="Dupliquer ce cours"
                        >
                          <Copy className="h-4 w-4" />
                          <span className="sr-only">Dupliquer</span>
                        </Button>
                      </form>
                      {course.status === "ARCHIVED" ? (
                        <form
                          action={async () => {
                            "use server";
                            await restoreArchivedCourse(course.id);
                          }}
                        >
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="h-auto px-2 text-muted-foreground"
                            title="Restaurer en brouillon"
                          >
                            <ArchiveRestore className="h-4 w-4" />
                            <span className="sr-only">Restaurer</span>
                          </Button>
                        </form>
                      ) : (
                        <ConfirmAction
                          variant="ghost"
                          size="sm"
                          className="h-auto px-2 text-muted-foreground"
                          message={`Archiver « ${course.title} » ? Il ne sera plus visible publiquement.`}
                          onConfirm={async () => {
                            "use server";
                            await archiveCourse(course.id);
                          }}
                        >
                          <Archive className="h-4 w-4" />
                          <span className="sr-only">Archiver</span>
                        </ConfirmAction>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
