import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDurationFromSeconds } from "@/lib/format/duration";
import { getInstructorStudentTracking } from "@/server/queries/instructor";

export const dynamic = "force-dynamic";

export default async function CourseStudentDetailPage({ params }: { params: Promise<{ id: string; userId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/formateur");
  const { id, userId } = await params;
  const data = await getInstructorStudentTracking(id, session.user.id, session.user.role === "ADMIN", userId);
  if (!data) notFound();
  const enrollment = data.course.enrollments[0];
  const student = enrollment.user;
  const name = student.name || [student.firstName, student.lastName].filter(Boolean).join(" ") || student.email;
  const activeByLesson = new Map<string, number>();
  enrollment.learningSessions.forEach((item) => activeByLesson.set(item.lessonId, (activeByLesson.get(item.lessonId) ?? 0) + item.activeSeconds));

  return <div className="space-y-5">
    <Button asChild variant="link" size="sm" className="h-auto px-0"><Link href={`/formateur/cours/${id}/eleves`}><ArrowLeft className="h-4 w-4" />Retour aux élèves</Link></Button>
    <Card><CardHeader><CardTitle>{name}</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-4"><div><span className="text-muted-foreground">Email</span><p>{student.email}</p></div><div><span className="text-muted-foreground">Progression</span><p>{Math.round(enrollment.progressPercent)} %</p></div><div><span className="text-muted-foreground">Temps actif</span><p>{formatDurationFromSeconds(enrollment.learningSessions.reduce((sum, item) => sum + item.activeSeconds, 0))}</p></div><div><span className="text-muted-foreground">Dernière activité</span><p>{enrollment.lastAccessedAt ? enrollment.lastAccessedAt.toLocaleString("fr-FR") : "Jamais"}</p></div></CardContent></Card>
    {data.course.sections.map((section) => <Card key={section.id}><CardHeader><CardTitle className="text-lg">{section.title}</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b text-xs uppercase text-muted-foreground"><tr><th className="py-2">Leçon</th><th>Complétion</th><th>Regardé</th><th>Temps actif</th><th>Quiz</th></tr></thead><tbody className="divide-y">{section.lessons.map((lesson) => {
      const progress = data.progress.find((item) => item.lessonId === lesson.id);
      const attempts = lesson.quiz ? data.attempts.filter((item) => item.quizId === lesson.quiz?.id) : [];
      const latest = attempts[0]; const best = attempts.length ? Math.max(...attempts.map((item) => item.score)) : null;
      return <tr key={lesson.id}><th scope="row" className="py-3 font-medium">{lesson.title}<span className="ml-2 text-xs font-normal text-muted-foreground">{lesson.type}</span></th><td>{progress?.isCompleted ? <Badge>Terminée</Badge> : <Badge variant="outline">À faire</Badge>}</td><td>{lesson.type === "VIDEO" ? formatDurationFromSeconds(progress?.watchedSeconds ?? 0) : "—"}</td><td>{formatDurationFromSeconds(activeByLesson.get(lesson.id) ?? 0)}</td><td>{lesson.quiz ? attempts.length ? <span>{latest?.passed ? "Réussi" : "Échoué"} · meilleur {best} % · dernier {latest?.score} % · {attempts.length} tentative(s)</span> : "Non fait" : "—"}</td></tr>;
    })}</tbody></table></div></CardContent></Card>)}
    <Card><CardHeader><CardTitle>Questions ({data.questions.length})</CardTitle></CardHeader><CardContent>{data.questions.length ? <ul className="divide-y">{data.questions.map((question) => <li key={question.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-medium">{question.title}</p><p className="text-xs text-muted-foreground">{question.createdAt.toLocaleString("fr-FR")} · {question._count.answers} réponse(s)</p></div><Badge variant="outline">{question.isResolved ? "Résolue" : "Ouverte"}</Badge></li>)}</ul> : <p className="text-sm text-muted-foreground">Aucune question posée.</p>}</CardContent></Card>
  </div>;
}
