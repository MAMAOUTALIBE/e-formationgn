import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, CalendarDays, Landmark, MapPin, Users, UsersRound } from "lucide-react";

import {
  CompanyForm,
  type CompanyFormValues,
} from "@/components/features/admin/company-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCompanyDetail } from "@/server/queries/admin-companies";

export const metadata: Metadata = { title: "Fiche société — CRM admin" };
export const dynamic = "force-dynamic";

const ACCOUNT_STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  ACTIVE: { label: "Actif", tone: "success" },
  SUSPENDED: { label: "Suspendu", tone: "warning" },
  PENDING_VERIFICATION: { label: "En attente", tone: "warning" },
  DELETED: { label: "Fermé", tone: "neutral" },
};

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await getCompanyDetail(id);
  if (!company) notFound();

  // La base stocke des NULL, le formulaire attend des chaînes.
  const values: CompanyFormValues = {
    name: company.name,
    siret: company.siret ?? "",
    siren: company.siren ?? "",
    vatNumber: company.vatNumber ?? "",
    addressLine1: company.addressLine1 ?? "",
    addressLine2: company.addressLine2 ?? "",
    postalCode: company.postalCode ?? "",
    city: company.city ?? "",
    country: company.country,
    contactName: company.contactName ?? "",
    contactEmail: company.contactEmail ?? "",
    contactPhone: company.contactPhone ?? "",
    opco: company.opco ?? "",
    opcoReference: company.opcoReference ?? "",
    notes: company.notes ?? "",
    status: company.status,
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Sociétés", href: "/admin/societes" }, { label: company.name }]}
      />

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Building2 className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{company.name}</h1>
              <StatusBadge tone={company.status === "ACTIVE" ? "success" : company.status === "INACTIVE" ? "warning" : "neutral"}>
                {company.status === "ACTIVE" ? "Active" : company.status === "INACTIVE" ? "Inactive" : "Archivée"}
              </StatusBadge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
            {company.students.length} élève{company.students.length > 1 ? "s" : ""} rattaché
            {company.students.length > 1 ? "s" : ""}
            {company.siret ? ` · SIRET ${company.siret}` : ""}
            </p>
          </div>
        </div>
      </header>

      <section aria-label="Résumé de la société" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<UsersRound />} label="Apprenants" value={String(company.students.length)} />
        <SummaryCard icon={<MapPin />} label="Localisation" value={[company.postalCode, company.city].filter(Boolean).join(" ") || "Non renseignée"} />
        <SummaryCard icon={<Landmark />} label="Financement" value={company.opco ?? "OPCO non renseigné"} />
        <SummaryCard icon={<CalendarDays />} label="Client depuis" value={new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(company.createdAt)} />
      </section>

      {/* Les élèves d'abord : c'est ce qu'on vient chercher en ouvrant une
          fiche société. Le formulaire de modification vient ensuite. */}
      <Card className="overflow-hidden rounded-2xl border-border/75 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        <CardHeader className="border-b border-border/60 bg-muted/20 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Apprenants rattachés</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Comptes et accès pédagogiques associés à cette société.</p>
            </div>
            <Link href={`/admin/utilisateurs?companyId=${company.id}`} className="text-xs font-semibold text-[color:var(--brand-primary)] hover:underline">Voir les apprenants</Link>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          {company.students.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" aria-hidden />}
              title="Aucun élève rattaché"
              description="Rattachez un élève depuis sa fiche, ou lors de la création de son compte."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">Nom</th>
                    <th className="px-2 py-2 font-medium">E-mail</th>
                    <th className="px-2 py-2 text-right font-medium">Accès</th>
                    <th className="px-2 py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {company.students.map((s) => {
                    const badge = ACCOUNT_STATUS[s.status] ?? {
                      label: s.status,
                      tone: "neutral" as const,
                    };
                    const displayName =
                      [s.firstName, s.lastName].filter(Boolean).join(" ") || s.name || "—";
                    return (
                      <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-2 py-2">
                          <Link
                            href={`/admin/utilisateurs/${s.id}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {displayName}
                          </Link>
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">{s.email}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{s._count.enrollments}</td>
                        <td className="px-2 py-2">
                          <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Modifier la société</h2>
          <p className="mt-1 text-sm text-muted-foreground">Mettez à jour les coordonnées, le financement et le statut de la relation.</p>
        </div>
        <CompanyForm
          companyId={company.id}
          defaultValues={values}
          cancelHref="/admin/societes"
        />
      </section>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/75 bg-card p-4 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[color:var(--brand-primary)] dark:bg-blue-500/10 [&_svg]:h-4 [&_svg]:w-4" aria-hidden>{icon}</span>
      <span className="min-w-0"><span className="block text-xs text-muted-foreground">{label}</span><span className="mt-0.5 block truncate text-sm font-semibold text-foreground">{value}</span></span>
    </div>
  );
}
