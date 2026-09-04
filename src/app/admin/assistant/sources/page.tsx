import type { Metadata } from "next";

import { AssistantSourcesManager } from "@/components/features/admin/assistant/assistant-sources-manager";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  listAssistantCategories,
  listAssistantDocuments,
} from "@/server/queries/admin-assistant-console";

export const metadata: Metadata = { title: "Base documentaire — Aiduca-IA" };
export const dynamic = "force-dynamic";

export default async function AssistantSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; question?: string; slug?: string }>;
}) {
  const params = await searchParams;
  const [documents, categories] = await Promise.all([
    listAssistantDocuments(params.q),
    listAssistantCategories(),
  ]);

  // Arrivée depuis « Documenter cette question » : l'éditeur s'ouvre pré-rempli
  // plutôt que d'obliger à recopier la question d'un écran à l'autre.
  const initialDraft = params.question
    ? {
        slug: (params.slug ?? "").slice(0, 120),
        title: params.question.slice(0, 200),
        category: "Essentiels",
        body: `${params.question}\n\n`,
        sourceLabel: null,
        sourceUrl: null,
        isPublished: true,
        position: 0,
      }
    : null;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Aiduca-IA", href: "/admin/assistant" },
          { label: "Base documentaire" },
        ]}
      />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Base documentaire
        </h1>
        <p className="text-sm text-muted-foreground">
          Ce que l&apos;assistant a le droit de dire. Chaque document est
          découpé en fragments et indexé en recherche plein-texte française.
        </p>
      </header>

      <AssistantSourcesManager
        documents={documents}
        categories={categories}
        initialDraft={initialDraft}
      />
    </div>
  );
}
