import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { listCompanies } from "@/server/queries/admin-companies";

export const metadata: Metadata = { title: "Sociétés — CRM admin" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ARCHIVED: "Archivée",
};

interface PageProps {
  searchParams: Promise<{ q?: string; statut?: string; page?: string }>;
}

export default async function CompaniesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status =
    params.statut === "ACTIVE" || params.statut === "INACTIVE" || params.statut === "ARCHIVED"
      ? params.statut
      : undefined;

  const { rows, total, page, pageSize } = await listCompanies({
    search: params.q,
    status,
    page: Number(params.page) || 1,
  });

  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sociétés</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clients auxquels les élèves sont rattachés. Une société doit exister
            avant qu&apos;un élève puisse lui être associé.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/societes/nouvelle">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Nouvelle société
          </Link>
        </Button>
      </header>

      {/* Recherche en GET : l'URL porte la requête, donc un résultat se
          partage et se met en favori. */}
      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-muted-foreground">
            Rechercher
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Raison sociale, SIRET, ville…"
          />
        </div>
        <div>
          <label htmlFor="statut" className="mb-1 block text-xs font-medium text-muted-foreground">
            Statut
          </label>
          <select
            id="statut"
            name="statut"
            defaultValue={params.statut ?? ""}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Tous</option>
            <option value="ACTIVE">Actives</option>
            <option value="INACTIVE">Inactives</option>
            <option value="ARCHIVED">Archivées</option>
          </select>
        </div>
        <Button type="submit" variant="outline">
          <Search className="mr-1.5 h-4 w-4" aria-hidden />
          Filtrer
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" aria-hidden />}
          title={params.q ? "Aucune société trouvée" : "Aucune société enregistrée"}
          description={
            params.q
              ? "Aucun résultat pour cette recherche. Essayez avec la raison sociale ou le SIRET."
              : "Créez une première société : c'est le préalable au rattachement des élèves."
          }
          action={
            <Button asChild>
              <Link href="/admin/societes/nouvelle">Créer une société</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Raison sociale</th>
                <th className="px-4 py-3 font-medium">SIRET</th>
                <th className="px-4 py-3 font-medium">Ville</th>
                <th className="px-4 py-3 font-medium">OPCO</th>
                <th className="px-4 py-3 text-right font-medium">Élèves</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/societes/${c.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{c.siret ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.city ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.opco ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.studentCount}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      tone={
                        c.status === "ACTIVE"
                          ? "success"
                          : c.status === "ARCHIVED"
                            ? "neutral"
                            : "warning"
                      }
                    >
                      {STATUS_LABEL[c.status] ?? c.status}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastPage > 1 ? (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">
            {total} société{total > 1 ? "s" : ""} · page {page} / {lastPage}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildPageHref(params, page - 1)}>Précédente</Link>
              </Button>
            ) : null}
            {page < lastPage ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildPageHref(params, page + 1)}>Suivante</Link>
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function buildPageHref(params: { q?: string; statut?: string }, page: number): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.statut) sp.set("statut", params.statut);
  sp.set("page", String(page));
  return `/admin/societes?${sp.toString()}`;
}
