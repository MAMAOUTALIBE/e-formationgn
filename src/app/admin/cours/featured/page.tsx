import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toggleFeaturedCourse } from "@/server/actions/admin-courses";
import { listFeaturedCoursesAdmin } from "@/server/queries/admin-courses";

export const metadata: Metadata = {
  title: "Cours en vedette",
};

export const dynamic = "force-dynamic";

export default async function FeaturedCoursesPage() {
  const courses = await listFeaturedCoursesAdmin();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Cours en vedette
        </h1>
        <p className="text-sm text-muted-foreground">
          Les cours mis en avant sont affichés en priorité sur la page
          d&apos;accueil. {courses.length} cours actuellement en vedette.
        </p>
      </header>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Aucun cours en vedette. Ajoutez-en depuis la fiche détail d&apos;un cours.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {courses.map((c, idx) => (
            <li key={c.id}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {idx + 1}
                    </span>
                    <div>
                      <CardTitle className="text-base">{c.title}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {c.category.name} · {c.instructor.name ?? c.instructor.email}
                      </p>
                    </div>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await toggleFeaturedCourse(c.id, false);
                    }}
                  >
                    <Button type="submit" size="sm" variant="outline">
                      Retirer de la vitrine
                    </Button>
                  </form>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
