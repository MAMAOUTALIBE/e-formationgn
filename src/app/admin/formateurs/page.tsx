import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Plus, Search, UsersRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Select } from "@/components/ui/select";
import type { Prisma } from "@/generated/prisma/client";
import { AccountStatus } from "@/generated/prisma/enums";
import { parseListFilter } from "@/lib/admin/list-filters";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Formateurs — Administration" };
export const dynamic = "force-dynamic";

export default async function AdminInstructorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status: rawStatus } = await searchParams;
  const status = parseListFilter(rawStatus, Object.values(AccountStatus));
  const search = q?.trim();

  const where: Prisma.UserWhereInput = {
    isInstructor: true,
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [instructors, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        _count: { select: { coursesAuthored: true } },
        coursesAuthored: { select: { totalEnrollments: true, status: true } },
      },
    }),
    // Le même `where` que la liste. Il comptait auparavant tous les
    // formateurs quel que soit le filtre : chercher un nom affichait une
    // ligne sous un compteur qui en annonçait quarante.
    prisma.user.count({ where }),
  ]);
  const hasFilters = Boolean(search || status);
  const published = instructors.reduce(
    (sum, user) =>
      sum +
      user.coursesAuthored.filter((course) => course.status === "PUBLISHED")
        .length,
    0,
  );
  const learners = instructors.reduce(
    (sum, user) =>
      sum +
      user.coursesAuthored.reduce(
        (count, course) => count + course.totalEnrollments,
        0,
      ),
    0,
  );
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Gestion des formateurs</h1>
          <p className="text-sm text-muted-foreground">
            Suivez les formations publiées et les apprenants accompagnés.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/equipe?role=INSTRUCTOR#create-staff">
            <Plus className="h-4 w-4" />
            Ajouter un formateur
          </Link>
        </Button>
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label={hasFilters ? "Formateurs filtrés" : "Formateurs"}
          value={total}
          icon={<UsersRound className="h-5 w-5" />}
          tone="blue"
          appearance="crm"
        />
        <KpiCard
          label="Formations publiées"
          value={published}
          icon={<GraduationCap className="h-5 w-5" />}
          tone="emerald"
          appearance="crm"
        />
        <KpiCard
          label="Inscriptions aux formations"
          value={learners}
          icon={<UsersRound className="h-5 w-5" />}
          tone="sky"
          appearance="crm"
        />
      </section>
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <form className="flex flex-wrap items-center gap-2 border-b border-border p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              aria-label="Rechercher un formateur"
              defaultValue={search ?? ""}
              placeholder="Email ou nom du formateur…"
              className="pl-9"
            />
          </div>
          <Select
            name="status"
            aria-label="Statut"
            defaultValue={status ?? ""}
            className="h-10 min-w-40"
          >
            <option value="">Statut · Tous</option>
            <option value="ACTIVE">Actifs</option>
            <option value="PENDING_VERIFICATION">En attente</option>
            <option value="SUSPENDED">Suspendus</option>
            <option value="DELETED">Archivés</option>
          </Select>
          <Button type="submit" variant="outline" size="sm" className="h-10">
            Filtrer
          </Button>
          {hasFilters ? (
            <Button asChild variant="ghost" size="sm" className="h-10">
              <Link href="/admin/formateurs">Réinitialiser</Link>
            </Button>
          ) : null}
        </form>
        {instructors.length ? (
          <ul className="divide-y divide-border">
            {instructors.map((user) => {
              const enrollments = user.coursesAuthored.reduce(
                (sum, course) => sum + course.totalEnrollments,
                0,
              );
              return (
                <li key={user.id}>
                  <Link
                    href={`/admin/utilisateurs/${user.id}`}
                    className="flex items-center gap-3 p-4 hover:bg-muted/35"
                  >
                <Avatar
                  src={user.image}
                  alt={user.name ?? user.email}
                  fallback={user.name ?? user.email}
                />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate">
                        {user.name ?? user.email}
                      </strong>
                      <span className="block text-xs text-muted-foreground">
                        {user._count.coursesAuthored} formation{user._count.coursesAuthored !== 1 ? "s" : ""} · {enrollments}{" "}
                        inscriptions
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState
              icon={<GraduationCap className="h-6 w-6" />}
              title="Aucun formateur trouvé"
              description="Modifiez la recherche ou ajoutez un formateur."
            />
          </div>
        )}
      </section>
    </div>
  );
}
