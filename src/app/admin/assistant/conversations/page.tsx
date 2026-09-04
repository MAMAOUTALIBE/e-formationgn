import type { Metadata } from "next";
import Link from "next/link";

import { AssistantConversationsTable } from "@/components/features/admin/assistant/assistant-conversations-table";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAssistantConversations } from "@/server/queries/admin-assistant-console";

export const metadata: Metadata = { title: "Conversations — Aiduca-IA" };
export const dynamic = "force-dynamic";

export default async function AssistantConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filtre?: string }>;
}) {
  const params = await searchParams;
  const { rows, total, page, pageSize } = await listAssistantConversations({
    page: Number(params.page) || 1,
    escalatedOnly: params.filtre === "escalade",
    unansweredOnly: params.filtre === "sans-reponse",
  });

  const filters = [
    { value: "", label: "Toutes" },
    { value: "escalade", label: "Escaladées" },
    { value: "sans-reponse", label: "Avec question sans réponse" },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Aiduca-IA", href: "/admin/assistant" },
          { label: "Conversations" },
        ]}
      />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Conversations
        </h1>
        <p className="text-sm text-muted-foreground">
          Les échanges conservés 90 jours, puis purgés automatiquement. Les
          adresses IP ne sont stockées que sous forme hachée.
        </p>
      </header>

      <nav aria-label="Filtres" className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const active = (params.filtre ?? "") === filter.value;
          return (
            <Link
              key={filter.label}
              href={
                filter.value
                  ? `/admin/assistant/conversations?filtre=${filter.value}`
                  : "/admin/assistant/conversations"
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
          <CardTitle className="text-base">{total} conversation(s)</CardTitle>
        </CardHeader>
        <CardContent>
          <AssistantConversationsTable rows={rows} />

          {total > pageSize ? (
            <nav aria-label="Pagination" className="mt-4 flex items-center gap-3">
              {page > 1 ? (
                <Link
                  href={`/admin/assistant/conversations?page=${page - 1}${params.filtre ? `&filtre=${params.filtre}` : ""}`}
                  className="text-sm underline underline-offset-4"
                >
                  Précédent
                </Link>
              ) : null}
              <span className="text-sm text-muted-foreground">
                Page {page} sur {Math.ceil(total / pageSize)}
              </span>
              {page * pageSize < total ? (
                <Link
                  href={`/admin/assistant/conversations?page=${page + 1}${params.filtre ? `&filtre=${params.filtre}` : ""}`}
                  className="text-sm underline underline-offset-4"
                >
                  Suivant
                </Link>
              ) : null}
            </nav>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
