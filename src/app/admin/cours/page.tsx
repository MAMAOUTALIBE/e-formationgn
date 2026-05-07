import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { listAdminCourses } from "@/server/queries/admin-courses";
import { listFeaturedCategories } from "@/server/queries/categories";
import type { CourseStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = {
  title: "Cours — CRM admin",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: CourseStatus;
    categoryId?: string;
    featured?: string;
    page?: string;
  }>;
}

export default async function AdminCoursesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = {
    q: params.q,
    status: params.status,
    categoryId: params.categoryId,
    featured:
      params.featured === "1" ? true : params.featured === "0" ? false : undefined,
    page: params.page ? Number(params.page) : 1,
    pageSize: 50,
  };
  const [{ rows, total, page, pageSize }, categories] = await Promise.all([
    listAdminCourses(filters),
    listFeaturedCategories(50),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Cours
          </h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString("fr-FR")} cours · page {page} / {totalPages}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/cours/moderation">File de modération</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/cours/featured">Cours en vedette</Link>
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 sm:grid-cols-5">
            <Input
              name="q"
              placeholder="Titre ou slug…"
              defaultValue={params.q ?? ""}
              className="sm:col-span-2"
            />
            <Select name="status" defaultValue={params.status ?? ""} aria-label="Statut">
              <option value="">Tous statuts</option>
              <option value="DRAFT">Brouillon</option>
              <option value="PENDING_REVIEW">En modération</option>
              <option value="PUBLISHED">Publié</option>
              <option value="REJECTED">Rejeté</option>
              <option value="ARCHIVED">Archivé</option>
            </Select>
            <Select
              name="categoryId"
              defaultValue={params.categoryId ?? ""}
              aria-label="Catégorie"
            >
              <option value="">Toutes catégories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select
              name="featured"
              defaultValue={params.featured ?? ""}
              aria-label="Mis en avant"
            >
              <option value="">Vitrine : tous</option>
              <option value="1">Vitrine uniquement</option>
              <option value="0">Hors vitrine</option>
            </Select>
            <div className="sm:col-span-5">
              <Button type="submit">Filtrer</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Cours</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Formateur</th>
                <th className="hidden px-4 py-3 sm:table-cell">Catégorie</th>
                <th className="hidden px-4 py-3 lg:table-cell">Élèves</th>
                <th className="hidden px-4 py-3 lg:table-cell">Note</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    Aucun cours.
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {c.title}
                        {c.isFeatured ? (
                          <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Vedette
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{c.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <CourseStatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {c.instructor.name ?? c.instructor.email}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      {c.category.name}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                      {c.totalEnrollments}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                      {c.averageRating.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/cours/${c.id}`}
                        className="text-sm font-medium text-[color:var(--brand-secondary)] hover:underline"
                      >
                        Détail →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function CourseStatusBadge({ status }: { status: CourseStatus }) {
  if (status === "PUBLISHED") return <StatusBadge tone="success">Publié</StatusBadge>;
  if (status === "PENDING_REVIEW") return <StatusBadge tone="warning">À valider</StatusBadge>;
  if (status === "REJECTED") return <StatusBadge tone="danger">Rejeté</StatusBadge>;
  if (status === "ARCHIVED") return <StatusBadge tone="neutral">Archivé</StatusBadge>;
  return <StatusBadge tone="neutral">Brouillon</StatusBadge>;
}
