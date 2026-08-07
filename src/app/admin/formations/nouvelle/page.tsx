import type { Metadata } from "next";

import {
  EMPTY_PROGRAM,
  ProgramForm,
} from "@/components/features/admin/program-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export const metadata: Metadata = { title: "Nouvelle formation — CRM admin" };

export default function NewProgramPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <Breadcrumbs
        items={[
          { label: "Formations", href: "/admin/formations" },
          { label: "Nouvelle formation" },
        ]}
      />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Nouvelle formation
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Créez d&apos;abord la formation, puis composez son parcours en y
          ajoutant des cours et créez ses sessions.
        </p>
      </header>

      <ProgramForm defaultValues={EMPTY_PROGRAM} cancelHref="/admin/formations" />
    </div>
  );
}
