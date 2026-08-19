import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BarChart3, CheckCircle2, ClipboardList, Users, XCircle } from "lucide-react";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { computeQuizResultMetrics } from "@/lib/quiz-results";
import { getInstructorQuizResults } from "@/server/queries/instructor";

export const dynamic = "force-dynamic";

export default async function CourseQuizResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/formateur");
  const { id } = await params;
  const course = await getInstructorQuizResults(id, session.user.id, session.user.role === "ADMIN");
  if (!course) notFound();

  const quizzes = course.sections.flatMap((section) => section.lessons.flatMap((lesson) =>
    lesson.quiz ? [{ ...lesson.quiz, lessonTitle: lesson.title, sectionTitle: section.title }] : [],
  ));
  const metrics = computeQuizResultMetrics(course.enrollments.length, quizzes);
  const attemptsByUser = new Map<string, typeof quizzes[number]["attempts"]>();
  for (const quiz of quizzes) for (const attempt of quiz.attempts) {
    const current = attemptsByUser.get(attempt.userId) ?? [];
    current.push(attempt);
    attemptsByUser.set(attempt.userId, current);
  }

  return <div className="space-y-6">
    <Breadcrumbs items={[{ label: "Formateur", href: "/formateur" }, { label: "Mes formations", href: "/formateur/cours" }, { label: course.title, href: `/formateur/cours/${id}` }, { label: "Résultats quiz" }]} />
    <header>
      <h2 className="flex items-center gap-2 text-2xl font-semibold"><BarChart3 className="h-6 w-6" aria-hidden />Résultats des quiz</h2>
      <p className="mt-1 text-sm text-muted-foreground">Suivez les acquis et repérez rapidement les élèves à accompagner.</p>
    </header>
    <section aria-label="Indicateurs quiz" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard label="Élèves inscrits" value={metrics.enrollmentCount} icon={<Users className="h-5 w-5" />} tone="blue" />
      <KpiCard label="Tentatives" value={metrics.attemptCount} icon={<ClipboardList className="h-5 w-5" />} tone="slate" />
      <KpiCard label="Réussite élèves × quiz" value={`${metrics.passRate} %`} hint="parmi les quiz commencés" icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
      <KpiCard label="Score moyen" value={`${metrics.averageScore} %`} icon={<BarChart3 className="h-5 w-5" />} tone="sky" />
      <KpiCard label="Quiz non commencés" value={metrics.notStartedCount} hint="élève × quiz" icon={<XCircle className="h-5 w-5" />} tone="amber" />
    </section>

    <section aria-labelledby="quiz-heading" className="space-y-3">
      <h2 id="quiz-heading" className="text-lg font-semibold">Par quiz</h2>
      {quizzes.length === 0 ? <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Aucun quiz dans cette formation. Ajoutez-en depuis le programme.</CardContent></Card> :
        <div className="grid gap-3 lg:grid-cols-2">{quizzes.map((quiz) => {
          const learners = new Set(quiz.attempts.map((a) => a.userId)).size;
          const passedLearners = new Set(quiz.attempts.filter((a) => a.passed).map((a) => a.userId));
          const passed = passedLearners.size;
          const failed = new Set(quiz.attempts.filter((a) => !passedLearners.has(a.userId)).map((a) => a.userId)).size;
          const average = quiz.attempts.length ? Math.round(quiz.attempts.reduce((s, a) => s + a.score, 0) / quiz.attempts.length) : 0;
          return <Card key={quiz.id}><CardHeader><CardTitle>{quiz.title}</CardTitle><p className="text-xs text-muted-foreground">{quiz.sectionTitle} · {quiz.lessonTitle}</p></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <p><span className="block text-muted-foreground">Commencé</span><strong>{learners}</strong></p><p><span className="block text-muted-foreground">Réussi</span><strong>{passed}</strong></p><p><span className="block text-muted-foreground">Échoué</span><strong>{failed}</strong></p><p><span className="block text-muted-foreground">Score moyen</span><strong>{average} %</strong></p>
          </div>{quiz.attempts.length ? <div className="border-t pt-3"><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Tentatives récentes</p><ul className="space-y-1 text-sm">{quiz.attempts.slice(0, 5).map((attempt) => { const enrolled = course.enrollments.find(({ user }) => user.id === attempt.userId)?.user; const label = enrolled?.name || enrolled?.firstName || enrolled?.email || "Élève"; return <li key={attempt.id} className="flex items-center justify-between gap-2"><span className="truncate">{label} · {attempt.score} %</span><Link className="shrink-0 font-medium text-[color:var(--brand-primary)] underline-offset-4 hover:underline" href={`/formateur/cours/${id}/resultats/tentatives/${attempt.id}`}>Voir</Link></li>; })}</ul></div> : null}</CardContent></Card>;
        })}</div>}
    </section>

    <section aria-labelledby="students-heading" className="space-y-3">
      <h2 id="students-heading" className="text-lg font-semibold">Par élève</h2>
      {course.enrollments.length === 0 ? <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Aucun élève inscrit pour le moment.</CardContent></Card> :
      <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/60 text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Élève</th><th className="px-4 py-3 font-medium">Faits</th><th className="px-4 py-3 font-medium">Non faits</th><th className="px-4 py-3 font-medium">Échoués</th><th className="px-4 py-3 font-medium">Tentatives</th><th className="px-4 py-3 font-medium">Meilleur / dernier</th><th className="px-4 py-3 font-medium">Détails</th></tr></thead><tbody className="divide-y">{course.enrollments.map(({ user }) => {
        const attempts = attemptsByUser.get(user.id) ?? [];
        const done = new Set(attempts.map((a) => quizzes.find((q) => q.attempts.some((candidate) => candidate.id === a.id))?.id).filter(Boolean)).size;
        const failed = new Set(quizzes.filter((q) => q.attempts.some((a) => a.userId === user.id) && !q.attempts.some((a) => a.userId === user.id && a.passed)).map((q) => q.id)).size;
        const latest = [...attempts].sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))[0];
        const name = user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
        return <tr key={user.id}><th scope="row" className="px-4 py-3 font-medium"><span className="block">{name}</span><span className="text-xs font-normal text-muted-foreground">{user.email}</span></th><td className="px-4 py-3">{done}/{quizzes.length}</td><td className="px-4 py-3">{Math.max(0, quizzes.length - done)}</td><td className="px-4 py-3">{failed ? <Badge variant="outline" className="border-red-300 text-red-700">{failed}</Badge> : "0"}</td><td className="px-4 py-3">{attempts.length}</td><td className="px-4 py-3">{attempts.length ? `${Math.max(...attempts.map((a) => a.score))} % / ${latest?.score ?? 0} %` : "—"}</td><td className="px-4 py-3">{attempts.length ? <details className="min-w-40"><summary className="cursor-pointer font-medium text-[color:var(--brand-primary)]">Toutes ({attempts.length})</summary><ul className="mt-2 space-y-2">{[...attempts].sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)).map((attempt) => { const quiz = quizzes.find((item) => item.attempts.some((candidate) => candidate.id === attempt.id)); return <li key={attempt.id}><Link className="block rounded border p-2 hover:bg-muted" href={`/formateur/cours/${id}/resultats/tentatives/${attempt.id}`}><span className="block truncate font-medium">{quiz?.title ?? "Quiz"}</span><span className="text-xs text-muted-foreground">Tentative {attempt.attemptNumber} · {attempt.score} % · {attempt.passed ? "réussie" : "échouée"}</span></Link></li>; })}</ul></details> : "—"}</td></tr>;
      })}</tbody></table></div>}
    </section>
  </div>;
}
