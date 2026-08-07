import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  CompanyForm,
  EMPTY_COMPANY,
} from "@/components/features/admin/company-form";

export const metadata: Metadata = { title: "Nouvelle société — CRM admin" };

export default function NewCompanyPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <Breadcrumbs
        items={[
          { label: "Sociétés", href: "/admin/societes" },
          { label: "Nouvelle société" },
        ]}
      />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Nouvelle société
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seule la raison sociale est obligatoire. Le SIRET est facultatif mais
          recommandé : c&apos;est lui qui permet de détecter deux fiches du même
          client.
        </p>
      </header>

      <CompanyForm defaultValues={EMPTY_COMPANY} cancelHref="/admin/societes" />
    </div>
  );
}
