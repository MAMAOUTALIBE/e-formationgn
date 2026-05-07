import type { Metadata } from "next";
import Link from "next/link";

import { CreateCourseForm } from "@/components/features/instructor/create-course-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listCategories } from "@/server/queries/categories";

export const metadata: Metadata = {
  title: "Nouveau cours",
};

export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  const categories = await listCategories();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href="/formateur/cours"
        className="text-sm text-[color:var(--brand-secondary)] hover:underline"
      >
        ← Retour à mes cours
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Créer un nouveau cours</CardTitle>
          <CardDescription>
            Donnez un titre et choisissez une catégorie pour démarrer. Vous pourrez tout
            modifier ensuite, et le cours restera en brouillon jusqu&apos;à la soumission.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateCourseForm
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
