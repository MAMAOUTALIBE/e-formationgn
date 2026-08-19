import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDurationFromSeconds } from "@/lib/format/duration";
import { derivePedagogicalStatus, PEDAGOGICAL_STATUS_LABELS } from "@/lib/learning-tracking";
import { getInstructorStudentTracking } from "@/server/queries/instructor";

export const dynamic = "force-dynamic";

export default async function CourseStudentsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/formateur");
  const { id } = await params;
  const data = await getInstructorStudentTracking(id, session.user.id, session.user.role === "ADMIN");
  if (!data) notFound();
  const lessons = data.course.sections.flatMap((section) => section.lessons);
  const videos = lessons.filter((lesson) => lesson.type === "VIDEO");
  const quizzes = lessons.flatMap((lesson) => lesson.quiz ? [lesson.quiz] : []);

  return <Card><CardHeader><CardTitle>Suivi des élèves ({data.course.enrollments.length})</CardTitle></CardHeader><CardContent>
    {data.course.enrollments.length === 0 ? <p className="text-sm text-muted-foreground">Aucun élève inscrit à cette formation.</p> :
      <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="border-b text-xs uppercase text-muted-foreground"><tr>
        <th className="px-3 py-3">Élève</th><th className="px-3 py-3">Progression</th><th className="px-3 py-3">Dernière activité</th><th className="px-3 py-3">Temps actif</th><th className="px-3 py-3">Leçons / vidéos</th><th className="px-3 py-3">Quiz R / É / NF</th><th className="px-3 py-3">Score moyen</th><th className="px-3 py-3">Questions ouvertes</th><th className="px-3 py-3">Statut</th>
      </tr></thead><tbody className="divide-y">{data.course.enrollments.map((enrollment) => {
        const progress = data.progress.filter((item) => item.userId === enrollment.userId);
        const attempts = data.attempts.filter((item) => item.userId === enrollment.userId);
        const completed = new Set(progress.filter((item) => item.isCompleted).map((item) => item.lessonId));
        const passedQuizIds = new Set(attempts.filter((item) => item.passed).map((item) => item.quizId));
        const attemptedQuizIds = new Set(attempts.map((item) => item.quizId));
        const failed = [...attemptedQuizIds].filter((quizId) => !passedQuizIds.has(quizId)).length;
        const bestScores = [...attemptedQuizIds].map((quizId) => Math.max(...attempts.filter((item) => item.quizId === quizId).map((item) => item.score)));
        const score = bestScores.length ? Math.round(bestScores.reduce((sum, value) => sum + value, 0) / bestScores.length) : null;
        const status = derivePedagogicalStatus({ progressPercent: enrollment.progressPercent, lastAccessedAt: enrollment.lastAccessedAt, failedQuizCount: failed });
        const name = enrollment.user.name || [enrollment.user.firstName, enrollment.user.lastName].filter(Boolean).join(" ") || enrollment.user.email;
        return <tr key={enrollment.id} className="align-top hover:bg-muted/40"><th scope="row" className="px-3 py-3"><Link className="font-medium text-[color:var(--brand-primary)] hover:underline" href={`/formateur/cours/${id}/eleves/${enrollment.userId}`}>{name}</Link><span className="block text-xs font-normal text-muted-foreground">{enrollment.user.email}</span></th>
          <td className="px-3 py-3">{Math.round(enrollment.progressPercent)} %</td>
          <td className="px-3 py-3">{enrollment.lastAccessedAt ? enrollment.lastAccessedAt.toLocaleDateString("fr-FR") : "Jamais"}</td>
          <td className="px-3 py-3">{formatDurationFromSeconds(enrollment.learningSessions.reduce((sum, item) => sum + item.activeSeconds, 0))}</td>
          <td className="px-3 py-3">{completed.size}/{lessons.length} · {videos.filter((video) => completed.has(video.id)).length}/{videos.length}</td>
          <td className="px-3 py-3">{passedQuizIds.size} / {failed} / {Math.max(0, quizzes.length - attemptedQuizIds.size)}</td>
          <td className="px-3 py-3">{score === null ? "—" : `${score} %`}</td>
          <td className="px-3 py-3">{data.questions.filter((question) => question.userId === enrollment.userId && !question.isResolved).length}</td>
          <td className="px-3 py-3"><Badge variant="outline">{PEDAGOGICAL_STATUS_LABELS[status]}</Badge></td></tr>;
      })}</tbody></table></div>}
  </CardContent></Card>;
}
