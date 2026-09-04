import type { Metadata } from "next";
import Link from "next/link";

import { AssistantLeadsTable } from "@/components/features/admin/assistant/assistant-leads-table";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAssistantLeads } from "@/server/queries/admin-assistant-console";

export const metadata: Metadata = { title: "Prospects — Aiduca-IA" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { value: "", label: "Tous" },
  { value: "NEW", label: "Nouveaux" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "CLOSED", label: "Clôturés" },
] as const;

export default async function AssistantLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const params = await searchParams;
  const status =
    params.statut === "NEW" || params.statut === "IN_PROGRESS" || params.statut === "CLOSED"
      ? params.statut
      : undefined;
  const rows = await listAssistantLeads(status);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Aiduca-IA", href: "/admin/assistant" },
          { label: "Prospects" },
        ]}
      />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Prospects
        </h1>
        <p className="text-sm text-muted-foreground">
          Les demandes de rappel déposées depuis l&apos;assistant. Le fil de
          discussion complet est joint à la notification envoyée à l&apos;équipe.
        </p>
      </header>

      <nav aria-label="Filtres" className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const active = (params.statut ?? "") === filter.value;
          return (
            <Link
              key={filter.label}
              href={
                filter.value
                  ? `/admin/assistant/prospects?statut=${filter.value}`
                  : "/admin/assistant/prospects"
              }
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-lg bg-[color:var(--brand-secondary)] px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
              }
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{rows.length} demande(s)</CardTitle>
        </CardHeader>
        <CardContent>
          <AssistantLeadsTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
