import type { Metadata } from "next";
import { Building2, CheckCircle2, FileCheck2, ShieldCheck, UsersRound } from "lucide-react";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  CompanyForm,
  EMPTY_COMPANY,
} from "@/components/features/admin/company-form";

export const metadata: Metadata = { title: "Nouvelle société — CRM admin" };

export default function NewCompanyPage() {
  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: "Sociétés", href: "/admin/societes" },
          { label: "Nouvelle société" },
        ]}
      />
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Building2 className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Nouvelle société</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Créez la fiche partenaire qui permettra ensuite de rattacher ses apprenants.
          </p>
        </div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <CompanyForm defaultValues={EMPTY_COMPANY} cancelHref="/admin/societes" />
        </div>
        <aside className="rounded-2xl border border-border/75 bg-card p-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)] xl:sticky xl:top-4">
          <h2 className="font-semibold">Avant de commencer</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Seule la raison sociale est obligatoire. Le SIRET reste recommandé pour éviter les doublons.
          </p>
          <ul className="mt-5 space-y-4 text-sm">
            <GuideLine icon={<FileCheck2 />} title="Identité vérifiable" text="SIRET, SIREN et TVA" />
            <GuideLine icon={<UsersRound />} title="Contact opérationnel" text="Nom, e-mail et téléphone" />
            <GuideLine icon={<ShieldCheck />} title="Données protégées" text="Notes réservées au CRM" />
            <GuideLine icon={<CheckCircle2 />} title="Brouillon automatique" text="Votre saisie est conservée" />
          </ul>
        </aside>
      </div>
    </div>
  );
}

function GuideLine({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[color:var(--brand-primary)] dark:bg-blue-500/10 [&_svg]:h-4 [&_svg]:w-4" aria-hidden>{icon}</span>
      <span><span className="block font-semibold text-foreground">{title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{text}</span></span>
    </li>
  );
}
