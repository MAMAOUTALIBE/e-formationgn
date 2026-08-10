import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeCheck,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  UsersRound,
} from "lucide-react";

import { auth } from "@/auth";
import {
  CreateStaffAccountForm,
  RoleAssignForm,
  StaffAccessButton,
} from "@/components/features/admin/role-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Prisma } from "@/generated/prisma/client";
import type { AccountStatus, UserRole } from "@/generated/prisma/enums";
import {
  isStaffRole,
  STAFF_ROLE_LABELS,
  STAFF_ROLES,
  type StaffRole,
} from "@/lib/account-audience";
import { ACCOUNT_STATUSES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Équipe & accès — CRM admin" };
export const dynamic = "force-dynamic";

interface StaffSearchParams {
  q?: string;
  role?: UserRole | "ALL";
  status?: AccountStatus | "ALL";
}

const ROLE_SCOPES: Record<StaffRole, string> = {
  INSTRUCTOR: "Crée et anime ses cours dans l’espace formateur.",
  MANAGER: "Suit les sociétés, apprenants, formations et inscriptions.",
  MODERATOR: "Contrôle les cours, avis, questions et signalements.",
  SUPPORT: "Traite les tickets, litiges et demandes des utilisateurs.",
  FINANCE: "Accède aux transactions, remboursements et rapports.",
  ADMIN: "Dispose de tous les accès, rôles et paramètres de sécurité.",
};

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<StaffSearchParams>;
}) {
  const params = await searchParams;
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/admin");
  const selectedRole =
    params.role && params.role !== "ALL" && isStaffRole(params.role)
      ? params.role
      : undefined;
  const selectedStatus =
    params.status &&
    params.status !== "ALL" &&
    ACCOUNT_STATUSES.includes(params.status)
      ? params.status
      : undefined;
  const q = params.q?.trim();

  const audience: Prisma.UserWhereInput = {
    role: { in: [...STAFF_ROLES] },
  };
  const where: Prisma.UserWhereInput = {
    ...audience,
    ...(selectedRole ? { role: selectedRole } : {}),
    ...(selectedStatus ? { status: selectedStatus } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [members, total, active, instructors, privileged] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { name: "asc" }, { createdAt: "desc" }],
      take: 500,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    prisma.user.count({ where: audience }),
    prisma.user.count({ where: { ...audience, status: "ACTIVE" } }),
    prisma.user.count({ where: { role: "INSTRUCTOR" } }),
    prisma.user.count({
      where: { role: { in: ["ADMIN", "MANAGER", "MODERATOR", "SUPPORT", "FINANCE"] } },
    }),
  ]);

  const hasFilters = Boolean(q || selectedRole || selectedStatus);

  return (
    <div className="space-y-5" data-testid="staff-workspace">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Équipe &amp; accès</h1>
            <p className="text-sm text-muted-foreground">
              Comptes internes séparés des apprenants et droits associés.
            </p>
          </div>
        </div>
      </header>

      <section className="grid overflow-hidden rounded-xl border border-border/75 bg-card shadow-sm sm:grid-cols-3">
        <CompactStat icon={<UsersRound />} label="Comptes internes" value={total} />
        <CompactStat icon={<BadgeCheck />} label="Actifs" value={active} />
        <CompactStat
          icon={<ShieldCheck />}
          label="Formateurs / autres rôles"
          value={`${instructors} / ${privileged}`}
        />
      </section>

      <section id="create-staff" className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" /> Créer un compte interne
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CreateStaffAccountForm defaultRole={selectedRole ?? "INSTRUCTOR"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modifier un rôle interne</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <RoleAssignForm />
            <div className="grid gap-2 sm:grid-cols-2">
              {STAFF_ROLES.map((role) => (
                <div key={role} className="rounded-lg border border-border/70 p-3">
                  <StatusBadge tone={role === "ADMIN" ? "danger" : "info"}>
                    {STAFF_ROLE_LABELS[role]}
                  </StatusBadge>
                  <p className="mt-2 text-xs text-muted-foreground">{ROLE_SCOPES[role]}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <form
        className="flex flex-wrap items-center gap-2 rounded-xl border border-border/75 bg-card p-2.5 shadow-sm"
        role="search"
      >
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            aria-label="Rechercher un compte interne"
            defaultValue={q ?? ""}
            placeholder="Nom ou email professionnel…"
            className="h-9 pl-9"
          />
        </div>
        <Select
          name="role"
          aria-label="Rôle interne"
          defaultValue={selectedRole ?? "ALL"}
          className="h-9 min-w-44"
        >
          <option value="ALL">Tous les rôles internes</option>
          {STAFF_ROLES.map((role) => (
            <option key={role} value={role}>{STAFF_ROLE_LABELS[role]}</option>
          ))}
        </Select>
        <Select
          name="status"
          aria-label="Statut du compte interne"
          defaultValue={selectedStatus ?? "ALL"}
          className="h-9 min-w-36"
        >
          <option value="ALL">Tous les statuts</option>
          <option value="ACTIVE">Actifs</option>
          <option value="SUSPENDED">Désactivés</option>
          <option value="PENDING_VERIFICATION">En attente</option>
        </Select>
        <Button type="submit" variant="outline" size="sm" className="h-9">
          <SlidersHorizontal className="h-4 w-4" /> Filtrer
        </Button>
        {hasFilters ? (
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <Link href="/admin/equipe" aria-label="Réinitialiser les filtres">
              <RotateCcw className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </form>

      <Card>
        <CardContent className="p-0">
          {members.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-border bg-muted/35 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Compte interne</th>
                    <th className="px-4 py-3">Rôle</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Dernière connexion</th>
                    <th className="px-4 py-3">Créé le</th>
                    <th className="px-4 py-3 text-right">Accès</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/utilisateurs/${member.id}`}
                          className="font-semibold hover:underline"
                        >
                          {member.name ?? member.email}
                        </Link>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={member.role === "ADMIN" ? "danger" : "info"}>
                          {STAFF_ROLE_LABELS[member.role as StaffRole]}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={member.status === "ACTIVE" ? "success" : "warning"}>
                          {member.status === "ACTIVE" ? "Actif" : "Désactivé"}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {member.lastLoginAt?.toLocaleString("fr-FR") ?? "Jamais"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {member.createdAt.toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <StaffAccessButton
                          userId={member.id}
                          email={member.email}
                          status={member.status}
                          isSelf={member.id === session?.user?.id}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8">
              <EmptyState
                icon={<UsersRound className="h-6 w-6" />}
                title="Aucun compte interne trouvé"
                description={
                  hasFilters
                    ? "Modifiez les filtres pour élargir la recherche."
                    : "Créez le premier compte interne avec le formulaire ci-dessus."
                }
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CompactStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 border-r border-border/70 px-4 last:border-r-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300 [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <strong className="text-lg tabular-nums">{value}</strong>
      </div>
    </div>
  );
}
