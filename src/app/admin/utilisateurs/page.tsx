import type { Metadata } from "next";
import Link from "next/link";

import { CreateAccountForm } from "@/components/features/admin/create-account-form";
import { listSelectableCompanies } from "@/server/queries/admin-companies";
import { ImportStudentsForm } from "@/components/features/admin/import-students-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isTrainingCenterMode } from "@/lib/platform-mode";
import { prisma } from "@/lib/prisma";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import {
  exportUsersCsv,
  listAdminUsers,
} from "@/server/actions/admin-users";
import type { AccountStatus, UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = {
  title: "Utilisateurs — CRM admin",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    /** `ALL` élargit à tous les comptes ; absent = apprenants. */
    role?: UserRole | "ALL";
    companyId?: string;
    status?: AccountStatus;
    banned?: string;
    page?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = {
    q: params.q,
    // L'écran s'appelle « Apprenants » : il montre donc des élèves par défaut,
    // sinon le compteur annoncerait un effectif incluant formateurs et
    // administrateurs. `role=ALL` élargit explicitement à tous les comptes.
    role: params.role === "ALL" ? undefined : ((params.role as UserRole) ?? "STUDENT"),
    companyId: params.companyId,
    status: params.status,
    banned:
      params.banned === "1" ? true : params.banned === "0" ? false : undefined,
    page: params.page ? Number(params.page) : 1,
    pageSize: 50,
  };
  // Les deux lectures sont indépendantes : en parallèle plutôt qu'en série.
  const [{ rows, total, page, pageSize }, companies] = await Promise.all([
    listAdminUsers(filters),
    listSelectableCompanies(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Le mot suit le filtre : « apprenants » quand on regarde des élèves,
  // « comptes » quand la liste mélange les rôles.
  const isLearnerView = !params.role || params.role === "STUDENT";

  const countLabel = isLearnerView
    ? `apprenant${total > 1 ? "s" : ""}`
    : `compte${total > 1 ? "s" : ""}`;
  const companyLabel = params.companyId
    ? (companies.find((c) => c.id === params.companyId)?.name ?? null)
    : null;

  // Formations proposées à l'import : publiées uniquement — ouvrir un
  // brouillon donnerait accès à un programme vide.
  const publishedCourses = isTrainingCenterMode()
    ? await prisma.course.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { title: "asc" },
        select: { id: true, title: true },
      })
    : [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Apprenants
          </h1>
          <p className="text-sm text-muted-foreground">
            {/* Le compteur reflète le filtre courant : « 12 apprenants » après
                avoir choisi une société, c'est l'effectif de cette société —
                l'information qu'on vient chercher. */}
            <span className="font-medium text-foreground">
              {total.toLocaleString("fr-FR")}
            </span>{" "}
            {countLabel}
            {companyLabel ? ` chez ${companyLabel}` : ""} — page {page} /{" "}
            {totalPages}
          </p>
        </div>
        <ExportButton action={exportUsersCsv} />
      </header>

      {isTrainingCenterMode() ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Créer un compte</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              L&apos;inscription publique est fermée : les comptes élèves et
              formateurs sont créés ici. Le mot de passe provisoire s&apos;affiche
              une seule fois, à vous de le transmettre.
            </p>
            <CreateAccountForm companies={companies} />
          </CardContent>
        </Card>
      ) : null}

      {isTrainingCenterMode() ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Importer une promotion</CardTitle>
          </CardHeader>
          <CardContent>
            <ImportStudentsForm courses={publishedCourses} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <Input
                name="q"
                placeholder="Email, nom, prénom…"
                defaultValue={params.q ?? ""}
              />
            </div>
            <Select
              name="companyId"
              defaultValue={params.companyId ?? ""}
              aria-label="Société"
            >
              <option value="">Toutes les sociétés</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.city ? ` — ${c.city}` : ""}
                </option>
              ))}
            </Select>
            <Select
              name="role"
              defaultValue={params.role ?? "STUDENT"}
              aria-label="Rôle"
            >
              <option value="ALL">Tous les comptes</option>
              <option value="STUDENT">Élève</option>
              <option value="INSTRUCTOR">Formateur</option>
              <option value="ADMIN">Administrateur</option>
              <option value="MODERATOR">Modérateur</option>
              <option value="SUPPORT">Support</option>
              <option value="FINANCE">Finance</option>
              <option value="MANAGER">Gestionnaire</option>
            </Select>
            <Select
              name="status"
              defaultValue={params.status ?? ""}
              aria-label="Statut"
            >
              <option value="">Tous les statuts</option>
              <option value="ACTIVE">Actif</option>
              <option value="PENDING_VERIFICATION">En attente vérif.</option>
              <option value="SUSPENDED">Suspendu</option>
              <option value="DELETED">Supprimé</option>
            </Select>
            <Select
              name="banned"
              defaultValue={params.banned ?? ""}
              aria-label="Banni"
            >
              <option value="">Bannis : tous</option>
              <option value="1">Bannis uniquement</option>
              <option value="0">Non-bannis uniquement</option>
            </Select>
            <div className="sm:col-span-6">
              <Button type="submit">Filtrer</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Apprenant</th>
                <th className="px-4 py-3">Société</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Statut</th>
                <th className="hidden px-4 py-3 sm:table-cell">Pays</th>
                <th className="hidden px-4 py-3 lg:table-cell">Achats</th>
                <th className="hidden px-4 py-3 lg:table-cell">Inscrit</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    Aucun apprenant ne correspond à ces filtres.
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {u.name ?? u.email}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {u.companyId && u.companyName ? (
                        <Link
                          href={`/admin/societes/${u.companyId}`}
                          className="text-foreground hover:underline"
                        >
                          {u.companyName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3">
                      <UserStatusBadge status={u.status} banned={!!u.bannedAt} />
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      {u.country ?? "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                      {u.ordersCount}{" "}
                      <span className="text-xs">
                        ({(u.totalSpentCentsEur / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €)
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                      {u.createdAt.toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/utilisateurs/${u.id}`}
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

      {totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          searchParams={params}
        />
      ) : null}
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  if (role === "ADMIN") return <StatusBadge tone="danger">Admin</StatusBadge>;
  if (role === "MODERATOR") return <StatusBadge tone="warning">Modérateur</StatusBadge>;
  if (role === "SUPPORT") return <StatusBadge tone="info">Support</StatusBadge>;
  if (role === "FINANCE") return <StatusBadge tone="info">Finance</StatusBadge>;
  if (role === "INSTRUCTOR") return <StatusBadge tone="success">Formateur</StatusBadge>;
  return <StatusBadge tone="neutral">Élève</StatusBadge>;
}

function UserStatusBadge({
  status,
  banned,
}: {
  status: AccountStatus;
  banned: boolean;
}) {
  if (banned) return <StatusBadge tone="danger">Banni</StatusBadge>;
  if (status === "SUSPENDED") return <StatusBadge tone="warning">Suspendu</StatusBadge>;
  if (status === "DELETED") return <StatusBadge tone="neutral">Supprimé</StatusBadge>;
  if (status === "PENDING_VERIFICATION") return <StatusBadge tone="warning">En attente</StatusBadge>;
  return <StatusBadge tone="success">Actif</StatusBadge>;
}

function Pagination({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}) {
  function buildHref(p: number) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && k !== "page") sp.set(k, v);
    }
    sp.set("page", String(p));
    return `?${sp.toString()}`;
  }
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <Link
        href={buildHref(Math.max(1, page - 1))}
        className="rounded-md border border-border bg-background px-3 py-1 hover:bg-muted aria-disabled:pointer-events-none aria-disabled:opacity-50"
        aria-disabled={page === 1}
      >
        ← Précédent
      </Link>
      <span className="text-muted-foreground">
        Page {page} / {totalPages}
      </span>
      <Link
        href={buildHref(Math.min(totalPages, page + 1))}
        className="rounded-md border border-border bg-background px-3 py-1 hover:bg-muted aria-disabled:pointer-events-none aria-disabled:opacity-50"
        aria-disabled={page === totalPages}
      >
        Suivant →
      </Link>
    </div>
  );
}
