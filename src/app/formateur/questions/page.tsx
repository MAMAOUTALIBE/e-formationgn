import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleHelp, Lock, MessageCircle } from "lucide-react";

import { auth } from "@/auth";
import { AnswerForm } from "@/components/features/qa/answer-form";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { setQuestionResolved } from "@/server/actions/qa";
import { listInstructorQuestions } from "@/server/queries/instructor";

export const metadata: Metadata = {
  title: "Centre Q&A — Formateur",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ filter?: string; lesson?: string }>;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function InstructorQuestionsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/formateur/questions");

  const { filter, lesson } = await searchParams;
  const onlyUnanswered = filter === "unanswered";

  const [all, unanswered] = await Promise.all([
    listInstructorQuestions(session.user.id, { limit: 100 }),
    listInstructorQuestions(session.user.id, { onlyUnanswered: true, limit: 100 }),
  ]);

  const baseList = onlyUnanswered ? unanswered : all;
  const list = lesson ? baseList.filter((question) => question.lesson?.id === lesson) : baseList;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Formateur", href: "/formateur" },
          { label: "Q&A" },
        ]}
      />

      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <CircleHelp className="h-6 w-6 text-[color:var(--brand-primary)]" aria-hidden />
          Centre Q&amp;A
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toutes les questions posées par vos élèves, sur toutes vos formations.
        </p>
      </header>

      {/* Tabs filtre — toutes vs non répondues */}
      <nav aria-label="Filtres" className="flex gap-1 border-b border-border">
        <TabLink href="/formateur/questions" active={!onlyUnanswered}>
          Toutes
          <span className="ml-1.5 text-xs text-muted-foreground">({all.length})</span>
        </TabLink>
        <TabLink
          href="/formateur/questions?filter=unanswered"
          active={onlyUnanswered}
        >
          Sans réponse
          <span className="ml-1.5 text-xs text-muted-foreground">
            ({unanswered.length})
          </span>
        </TabLink>
      </nav>

      <form className="flex flex-wrap items-end gap-2" method="get">
        {onlyUnanswered ? <input type="hidden" name="filter" value="unanswered" /> : null}
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Filtrer par leçon</span>
          <select
            name="lesson"
            defaultValue={lesson ?? ""}
            className="h-9 rounded-md border border-input bg-background px-3"
          >
            <option value="">Toutes les leçons</option>
            {Array.from(
              new Map(
                [...all, ...unanswered]
                  .filter((question) => question.lesson)
                  .map((question) => [question.lesson!.id, question.lesson!]),
              ).values(),
            ).map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline" size="sm">Appliquer</Button>
      </form>

      {list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center text-sm text-muted-foreground">
            {onlyUnanswered ? (
              <>
                <CircleHelp className="h-8 w-8 text-[color:var(--brand-success)]" aria-hidden />
                <p>Bravo ! Toutes les questions ont reçu une réponse.</p>
              </>
            ) : (
              <>
                <CircleHelp className="h-8 w-8" aria-hidden />
                <p>Aucune question pour le moment.</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {list.map((q) => {
            const userName = q.user.name ?? "Élève";
            const initials = userName[0]?.toUpperCase() ?? "?";
            return (
              <li key={q.id}>
                <Card>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar
                          src={q.user.image}
                          alt={userName}
                          fallback={initials}
                          size={36}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {userName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {dateFormatter.format(q.createdAt)} ·{" "}
                            <Link
                              href={`/cours/${q.course.slug}`}
                              className="hover:underline"
                            >
                              {q.course.title}
                            </Link>
                            {q.lesson ? ` · Leçon : ${q.lesson.title}` : " · Formation entière"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {q.visibility === "PRIVATE" ? (
                          <Badge variant="secondary"><Lock className="h-3 w-3" /> Privée</Badge>
                        ) : null}
                        {q.isResolved ? (
                          <Badge variant="default" className="bg-[color:var(--brand-success)]/15 text-[color:var(--brand-success)]">
                            Résolu
                          </Badge>
                        ) : null}
                        {q.hasInstructorAnswer ? (
                          <Badge
                            variant="secondary"
                            className="bg-[color:var(--brand-secondary)]/15 text-[color:var(--brand-secondary)]"
                          >
                            <MessageCircle className="h-3 w-3" aria-hidden />
                            Vous avez répondu
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-[color:var(--brand-warning)]/40 text-[color:var(--brand-warning)]">
                            En attente
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {q.title}
                      </h3>
                      <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">
                        {q.body}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                      <span className="text-muted-foreground">
                        {q.answersCount}{" "}
                        {q.answersCount === 1 ? "réponse" : "réponses"}
                      </span>
                      <div className="flex items-center gap-3">
                        <form
                          action={setQuestionResolved.bind(
                            null,
                            q.id,
                            !q.isResolved,
                          )}
                        >
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="h-auto px-2 text-xs"
                          >
                            {q.isResolved
                              ? "Rouvrir"
                              : "Marquer comme résolu"}
                          </Button>
                        </form>
                        <Link
                          href={`/cours/${q.course.slug}/questions/${q.id}`}
                          className="font-medium text-[color:var(--brand-secondary)] hover:underline"
                        >
                          {q.hasInstructorAnswer ? "Voir / éditer" : "Répondre →"}
                        </Link>
                      </div>
                    </div>
                    {!q.hasInstructorAnswer ? (
                      <div className="border-t border-border pt-3">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Réponse officielle du formateur</p>
                        <AnswerForm questionId={q.id} />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px inline-flex items-center border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-[color:var(--brand-secondary)] text-foreground"
          : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
