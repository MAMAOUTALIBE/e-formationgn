import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";

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

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{company.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {company.students.length} élève{company.students.length > 1 ? "s" : ""} rattaché
            {company.students.length > 1 ? "s" : ""}
            {company.siret ? ` · SIRET ${company.siret}` : ""}
          </p>
        </div>
      </header>

      {/* Les élèves d'abord : c'est ce qu'on vient chercher en ouvrant une
          fiche société. Le formulaire de modification vient ensuite. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Élèves rattachés</CardTitle>
        </CardHeader>
        <CardContent>
          {company.students.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" aria-hidden />}
              title="Aucun élève rattaché"
              description="Rattachez un élève depuis sa fiche, ou lors de la création de son compte."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
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
                      <tr key={s.id} className="border-b border-border last:border-0">
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

      <section className="max-w-3xl space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Informations</h2>
        <CompanyForm
          companyId={company.id}
          defaultValues={values}
          cancelHref="/admin/societes"
        />
      </section>
    </div>
  );
}
