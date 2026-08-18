import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { z } from "zod";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInstructorQuizAttempt } from "@/server/queries/instructor";

const snapshotSchema = z.object({ title: z.string(), passingScore: z.number(), questions: z.array(z.object({ id: z.string(), prompt: z.string(), explanation: z.string().nullable().optional(), options: z.array(z.object({ id: z.string(), label: z.string(), isCorrect: z.boolean() })) })) });

export const dynamic = "force-dynamic";

export default async function QuizAttemptDetailPage({ params }: { params: Promise<{ id: string; attemptId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/formateur");
  const { id, attemptId } = await params;
  const attempt = await getInstructorQuizAttempt(id, attemptId, session.user.id, session.user.role === "ADMIN");
  if (!attempt) notFound();
  const parsedSnapshot = snapshotSchema.safeParse(attempt.snapshot);
  const questions = parsedSnapshot.success ? parsedSnapshot.data.questions : attempt.quiz.questions.map((question) => ({ id: question.id, prompt: question.prompt, explanation: question.explanation, options: question.options.map((option) => ({ id: option.id, label: option.label, isCorrect: option.isCorrect })) }));
  const answerOptionIds = new Set(attempt.answers.map((answer) => answer.optionId).filter((id): id is string => Boolean(id)));
  const learner = attempt.user.name || [attempt.user.firstName, attempt.user.lastName].filter(Boolean).join(" ") || attempt.user.email;

  return <div className="space-y-6">
    <Button asChild variant="link" size="sm" className="h-auto px-0"><Link href={`/formateur/cours/${id}/resultats`}><ArrowLeft className="h-4 w-4" />Retour aux résultats</Link></Button>
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-semibold">Tentative {attempt.attemptNumber} · {parsedSnapshot.success ? parsedSnapshot.data.title : attempt.quiz.title}</h2><p className="mt-1 text-sm text-muted-foreground">{learner} · {attempt.user.email}</p></div><Badge variant={attempt.passed ? "success" : "outline"} className={attempt.passed ? undefined : "border-red-300 text-red-700"}>{attempt.passed ? "Réussi" : "Échoué"} · {attempt.score} %</Badge></header>
    {!parsedSnapshot.success ? <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Cette ancienne tentative ne possède pas de snapshot exploitable. La correction actuelle est affichée et peut différer de celle présentée lors du passage.</p> : null}
    <ol className="space-y-4">{questions.map((question, index) => <li key={question.id}><Card><CardHeader><CardTitle className="text-base">{index + 1}. {question.prompt}</CardTitle></CardHeader><CardContent className="space-y-2">{question.options.map((option) => {
      const selected = answerOptionIds.has(option.id);
      return <div key={option.id} className={`flex items-start gap-2 rounded-md border p-3 text-sm ${option.isCorrect ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20" : selected ? "border-red-300 bg-red-50 dark:bg-red-950/20" : ""}`}>
        {option.isCorrect ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Bonne réponse" /> : selected ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-label="Réponse incorrecte" /> : <span className="h-4 w-4 shrink-0" />}
        <span>{option.label}{selected ? <strong className="ml-2">(réponse de l’élève)</strong> : null}</span>
      </div>;
    })}{question.explanation ? <p className="pt-2 text-sm text-muted-foreground"><strong className="text-foreground">Explication :</strong> {question.explanation}</p> : null}</CardContent></Card></li>)}</ol>
  </div>;
}
