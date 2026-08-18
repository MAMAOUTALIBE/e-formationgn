import { Lock, MessageCircle } from "lucide-react";

import { AnswerForm } from "@/components/features/qa/answer-form";
import { AskQuestionForm } from "@/components/features/qa/ask-question-form";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type LessonQuestion = {
  id: string;
  title: string;
  body: string;
  visibility: "PUBLIC" | "PRIVATE";
  createdAt: Date;
  lesson: { id: string; title: string } | null;
  user: { id: string; name: string | null; firstName: string | null; image: string | null };
  answers: Array<{
    id: string;
    body: string;
    createdAt: Date;
    user: { id: string; name: string | null; firstName: string | null; image: string | null };
  }>;
};

const formatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export function LessonQuestions({
  courseId,
  lessonId,
  instructorId,
  questions,
}: {
  courseId: string;
  lessonId: string;
  instructorId: string;
  questions: LessonQuestion[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Poser une question au formateur</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          La question sera automatiquement rattachée à cette leçon.
        </p>
      </div>
      <AskQuestionForm courseId={courseId} lessonId={lessonId} />

      <div className="border-t border-border pt-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <MessageCircle className="h-4 w-4" aria-hidden /> Questions de la leçon
        </h2>
        {questions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Aucune question visible pour le moment.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {questions.map((question) => {
              const author = question.user.name ?? question.user.firstName ?? "Élève";
              return (
                <li key={question.id}>
                  <Card>
                    <CardContent className="space-y-4 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium">{question.title}</h3>
                          <p className="text-xs text-muted-foreground">
                            {author} · {formatter.format(question.createdAt)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {question.lesson?.id !== lessonId ? <Badge variant="outline">Cours entier</Badge> : null}
                          {question.visibility === "PRIVATE" ? (
                            <Badge variant="secondary"><Lock className="h-3 w-3" /> Privée</Badge>
                          ) : null}
                        </div>
                      </div>
                      <p className="whitespace-pre-line text-sm">{question.body}</p>
                      {question.answers.length > 0 ? (
                        <ul className="space-y-3 border-l-2 border-border pl-4">
                          {question.answers.map((answer) => {
                            const name = answer.user.name ?? answer.user.firstName ?? "Élève";
                            const official = answer.user.id === instructorId;
                            return (
                              <li key={answer.id} className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Avatar src={answer.user.image} alt={name} fallback={name[0] ?? "?"} size={28} />
                                  <span className="text-xs font-medium">{name}</span>
                                  {official ? <Badge>Réponse officielle du formateur</Badge> : null}
                                </div>
                                <p className="whitespace-pre-line text-sm">{answer.body}</p>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                      <AnswerForm questionId={question.id} />
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
