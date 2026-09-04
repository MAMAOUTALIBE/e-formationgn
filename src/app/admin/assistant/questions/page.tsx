import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { listUnansweredQuestions } from "@/server/queries/admin-assistant-console";

export const metadata: Metadata = { title: "Questions sans réponse — Aiduca-IA" };
export const dynamic = "force-dynamic";

const CERTAINTY_LABEL: Record<string, string> = {
  PARTIELLE: "Réponse partielle",
  INCONNUE: "Information absente",
};

function slugify(question: string): string {
  return question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default async function AssistantQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const { rows, total, page, pageSize } = await listUnansweredQuestions(
    Number(params.page) || 1,
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Aiduca-IA", href: "/admin/assistant" },
          { label: "Questions sans réponse" },
        ]}
      />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Questions sans réponse
        </h1>
        <p className="text-sm text-muted-foreground">
          Ce que les visiteurs demandent et que la base documentaire ne couvre
          pas encore. C&apos;est la liste de travail : documenter une question
          ici, c&apos;est y répondre pour tous les suivants.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{total} question(s) en attente</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              title="Rien à documenter"
              description="L'assistant a répondu avec certitude à toutes les questions reçues."
            />
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li key={row.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {CERTAINTY_LABEL[row.certainty ?? ""] ?? "Sans réponse"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {row.createdAt.toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {row.question}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{row.content}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/admin/assistant/sources?question=${encodeURIComponent(row.question)}&slug=${encodeURIComponent(slugify(row.question))}`}
                      className="rounded-lg border border-[color:var(--brand-secondary)]/40 px-3 py-1.5 text-sm font-medium text-[color:var(--brand-secondary)] transition-colors hover:bg-[color:var(--brand-secondary)]/10"
                    >
                      Documenter cette question
                    </Link>
                    <Link
                      href={`/admin/assistant/conversations?conversation=${row.conversationId}`}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Voir la conversation
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {total > pageSize ? (
            <nav aria-label="Pagination" className="mt-4 flex items-center gap-3">
              {page > 1 ? (
                <Link
                  href={`/admin/assistant/questions?page=${page - 1}`}
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
                  href={`/admin/assistant/questions?page=${page + 1}`}
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
