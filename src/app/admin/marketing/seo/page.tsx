import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "SEO" };

export const dynamic = "force-dynamic";

export default async function SeoPage() {
  const courses = await prisma.course.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { totalEnrollments: "desc" },
    take: 50,
    select: {
      id: true,
      slug: true,
      title: true,
      metaTitle: true,
      metaDescription: true,
    },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          SEO
        </h1>
        <p className="text-sm text-muted-foreground">
          Vérification rapide des metadonnées des 50 formations les plus suivies.
          L&apos;intégration GSC (Google Search Console) viendra dans une
          version future.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Formations sans metaDescription</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {courses
              .filter((c) => !c.metaDescription || c.metaDescription.length < 50)
              .map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-md border border-border p-2"
                >
                  <span className="truncate font-medium">{c.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.metaDescription
                      ? `${c.metaDescription.length} caractères`
                      : "absente"}
                  </span>
                </li>
              ))}
            {courses.every((c) => c.metaDescription && c.metaDescription.length >= 50) ? (
              <li className="text-muted-foreground">
                Toutes les metadonnées sont renseignées correctement.
              </li>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
