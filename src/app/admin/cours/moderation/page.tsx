import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { approveCourse, rejectCourse } from "@/server/actions/admin-courses";
import { listPendingCourses } from "@/server/queries/admin";

export const metadata: Metadata = {
  title: "File de modération",
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function AdminCourseModerationPage() {
  const courses = await listPendingCourses();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          File de modération
        </h1>
        <p className="text-sm text-muted-foreground">
          {courses.length} cours en attente de validation. Approuvez ou rejetez
          avec un commentaire qui sera transmis au formateur.
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
          {courses.map((c) => (
            <li key={c.id}>
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{c.title}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Soumis le {dateFormatter.format(c.updatedAt)} ·{" "}
                      {c.category.name} · {c.instructor.name ?? c.instructor.email}
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <Link href={`/admin/cours/${c.id}`}>Examiner en détail</Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {c.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
                    <form
                      action={async () => {
                        "use server";
                        await approveCourse(c.id);
                      }}
                    >
                      <Button type="submit" size="sm">
                        Approuver
                      </Button>
                    </form>
                    <form
                      action={async (formData: FormData) => {
                        "use server";
                        await rejectCourse(
                          c.id,
                          String(formData.get("reason") ?? ""),
                        );
                      }}
                      className="flex flex-1 flex-wrap items-center gap-2"
                    >
                      <input
                        type="text"
                        name="reason"
                        required
                        minLength={10}
                        placeholder="Motif de rejet (min. 10 caractères)"
                        className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                      />
                      <Button type="submit" size="sm" variant="outline">
                        Rejeter
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
