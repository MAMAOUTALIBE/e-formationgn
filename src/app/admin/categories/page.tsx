import type { Metadata } from "next";

import { SortableCategories } from "@/components/features/admin/sortable-categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/prisma";
import { deleteCategory, upsertCategory } from "@/server/actions/admin";

export const metadata: Metadata = {
  title: "Catégories",
};

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { courses: true } } },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Catégories</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Liste</CardTitle>
            <p className="text-xs text-muted-foreground">
              Glissez-déposez pour réorganiser. L&apos;ordre est utilisé sur la
              page publique des catégories.
            </p>
          </CardHeader>
          <CardContent>
            <SortableCategories
              initial={categories.map((c) => ({
                id: c.id,
                name: c.name,
                slug: c.slug,
                isActive: c.isActive,
                coursesCount: c._count.courses,
              }))}
              onDelete={async (id) => {
                "use server";
                await deleteCategory(id);
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouvelle catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={async (formData: FormData) => {
                "use server";
                await upsertCategory(formData);
              }}
              className="space-y-4"
            >
              <FormField id="name" label="Nom" required>
                <Input id="name" name="name" required maxLength={80} />
              </FormField>
              <FormField id="slug" label="Slug" required hint="lettres minuscules + tirets">
                <Input
                  id="slug"
                  name="slug"
                  required
                  maxLength={60}
                  pattern="[a-z0-9-]+"
                />
              </FormField>
              <FormField id="iconName" label="Icône Lucide" hint="Ex: Code, Palette, Briefcase">
                <Input id="iconName" name="iconName" maxLength={40} defaultValue="Folder" />
              </FormField>
              <FormField id="displayOrder" label="Ordre">
                <Input id="displayOrder" name="displayOrder" type="number" defaultValue={0} />
              </FormField>
              <FormField id="description" label="Description courte">
                <Textarea id="description" name="description" rows={3} maxLength={500} />
              </FormField>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isActive" defaultChecked /> Active
              </label>
              <Button type="submit" className="w-full">
                Créer
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
