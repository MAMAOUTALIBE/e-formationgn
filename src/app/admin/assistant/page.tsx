import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  HelpCircle,
  MessageSquare,
  UserPlus,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { isAiducaAssistantConfigured } from "@/lib/ai/assistant";
import { getAssistantConsoleStats } from "@/server/queries/admin-assistant-console";

export const metadata: Metadata = { title: "Aiduca-IA" };
export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    href: "/admin/assistant/sources",
    title: "Base documentaire",
    description:
      "Ce que l'assistant a le droit de dire. Toute réponse s'appuie sur ces documents et sur le catalogue publié.",
  },
  {
    href: "/admin/assistant/conversations",
    title: "Conversations",
    description:
      "Les échanges des visiteurs, pour voir ce qui est réellement demandé au centre.",
  },
  {
    href: "/admin/assistant/questions",
    title: "Questions sans réponse",
    description:
      "Les questions auxquelles l'assistant n'a pas su répondre avec certitude. C'est la liste des documents qui manquent.",
  },
  {
    href: "/admin/assistant/prospects",
    title: "Prospects",
    description:
      "Les demandes de rappel déposées depuis l'assistant, avec leur suivi.",
  },
];

export default async function AdminAssistantPage() {
  const stats = await getAssistantConsoleStats();
  const configured = isAiducaAssistantConfigured();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Aiduca-IA
        </h1>
        <p className="text-sm text-muted-foreground">
          L&apos;assistant public du site. Il ne répond qu&apos;à partir du
          catalogue publié et de la base documentaire ci-dessous — il n&apos;a
          aucun accès aux données des apprenants.
        </p>
      </header>

      {!configured ? (
        <div
          role="status"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200"
        >
          <p className="font-semibold">Assistant désactivé</p>
          <p className="mt-1">
            La variable <code>GROQ_API_KEY</code> n&apos;est pas
            configurée : le widget n&apos;apparaît pas sur le site. La base
            documentaire reste modifiable, elle sera utilisée dès l&apos;activation.
          </p>
        </div>
      ) : null}

      <section
        aria-label="Indicateurs de l'assistant"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KpiCard
          label="Conversations (7 j)"
          value={stats.conversations7d}
          icon={<MessageSquare className="h-5 w-5" aria-hidden />}
          tone="blue"
          appearance="crm"
        />
        <KpiCard
          label="Taux de réponse (7 j)"
          value={`${stats.answerRate} %`}
          hint={`${stats.questions7d} réponse(s)`}
          icon={<HelpCircle className="h-5 w-5" aria-hidden />}
          tone={stats.answerRate >= 80 ? "emerald" : "amber"}
          appearance="crm"
        />
        <KpiCard
          label="Questions sans réponse"
          value={stats.unanswered}
          href="/admin/assistant/questions"
          icon={<HelpCircle className="h-5 w-5" aria-hidden />}
          tone={stats.unanswered > 0 ? "rose" : "slate"}
          appearance="crm"
        />
        <KpiCard
          label="Prospects à traiter"
          value={stats.openLeads}
          href="/admin/assistant/prospects"
          icon={<UserPlus className="h-5 w-5" aria-hidden />}
          tone={stats.openLeads > 0 ? "amber" : "slate"}
          appearance="crm"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gérer l&apos;assistant</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {SECTIONS.map((section) => (
              <li key={section.href}>
                <Link
                  href={section.href}
                  className="block h-full rounded-xl border border-border p-4 transition-colors hover:border-[color:var(--brand-secondary)] hover:bg-muted/40"
                >
                  <span className="block text-sm font-semibold text-foreground">
                    {section.title}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {section.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
            {stats.publishedDocuments} document(s) publié(s) dans la base
            documentaire.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
