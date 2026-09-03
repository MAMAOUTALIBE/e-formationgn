import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";

import { auth } from "@/auth";
import { ConfirmAction } from "@/components/features/instructor/confirm-action";
import { LessonAiTools } from "@/components/features/instructor/lesson-ai-tools";
import { LessonEditForm } from "@/components/features/instructor/lesson-edit-form";
import { LessonResourcesManager } from "@/components/features/instructor/lesson-resources-manager";
import { LessonVideoSource } from "@/components/features/instructor/lesson-video-source";
import { QuizEditor } from "@/components/features/instructor/quiz-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isLessonSummaryConfigured } from "@/lib/ai/lesson-summary";
import { isMuxConfigured } from "@/lib/mux";
import { deleteLesson } from "@/server/actions/curriculum";
import { getLessonForInstructor } from "@/server/queries/instructor";

interface PageProps {
  params: Promise<{ id: string; lessonId: string }>;
}

export default async function LessonEditPage({ params }: PageProps) {
  const { id, lessonId } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const lesson = await getLessonForInstructor(
    lessonId,
    session.user.id,
    session.user.role === "ADMIN",
  );
  if (!lesson || lesson.section.course.id !== id) notFound();

  return (
    <div className="space-y-6">
      <Button asChild variant="link" size="sm" className="h-auto px-0 text-muted-foreground">
        <Link href={`/formateur/cours/${id}/programme`}>
          <ArrowLeft className="h-4 w-4" />
          Retour au programme
        </Link>
      </Button>

      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Modifier la leçon
          </h2>
          <p className="text-sm text-muted-foreground">{lesson.title}</p>
        </div>
        <ConfirmAction
          variant="outline"
          message={`Supprimer la leçon « ${lesson.title} » ?`}
          onConfirm={async () => {
            "use server";
            await deleteLesson(lesson.id);
          }}
          pendingLabel="Suppression…"
        >
          <Trash2 className="h-4 w-4" />
          Supprimer la leçon
        </ConfirmAction>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Détails de la leçon</CardTitle>
            <CardDescription>
              Modifiez le titre, le type et le contenu de la leçon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LessonEditForm
              lessonId={lesson.id}
              returnHref={`/formateur/cours/${id}/programme`}
              defaults={{
                title: lesson.title,
                type: lesson.type,
                description: lesson.description ?? "",
                textContent: lesson.textContent ?? "",
                resourceUrl: lesson.resourceUrl ?? "",
                resourceFileName: lesson.resourceFileName ?? "",
                isFreePreview: lesson.isFreePreview,
              }}
            />
          </CardContent>
        </Card>

        {lesson.type === "VIDEO" ? (
          <Card>
            <CardHeader>
              <CardTitle>Vidéo</CardTitle>
              <CardDescription>
                Choisissez la source : Mux (encodage adaptatif), téléversement
                d&apos;un fichier, ou lien direct vers une vidéo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LessonVideoSource
                lessonId={lesson.id}
                muxPlaybackId={lesson.muxPlaybackId}
                externalVideoUrl={lesson.externalVideoUrl}
                durationSeconds={lesson.videoDurationSeconds}
                isMuxConfigured={isMuxConfigured()}
                isUploadAvailable={true}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>

      {lesson.type === "QUIZ" ? (
        <Card>
          <CardHeader>
            <CardTitle>Quiz de la leçon</CardTitle>
            <CardDescription>
              Configurez le seuil de réussite, les tentatives et les réponses attendues.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuizEditor
              lessonId={lesson.id}
              lessonTitle={lesson.title}
              returnHref={`/formateur/cours/${id}/programme`}
              quiz={lesson.quiz}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Ressource téléchargeable</CardTitle>
          <CardDescription>
            Ajoutez au maximum un support à cette leçon : PDF, diaporama,
            tableur, image ou archive. L&apos;élève le télécharge directement
            sous la leçon dans le programme.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LessonResourcesManager
            lessonId={lesson.id}
            resources={lesson.resources.map((resource) => ({
              id: resource.id,
              title: resource.title,
              url: resource.url,
              fileSizeBytes: resource.fileSizeBytes,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outils IA</CardTitle>
          <CardDescription>
            Génération automatique de résumé pédagogique et de questions de
            quiz à partir du contenu de la leçon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LessonAiTools
            lessonId={lesson.id}
            courseId={id}
            initialSummary={lesson.aiSummary}
            initialUpdatedAt={lesson.aiSummaryUpdatedAt}
            aiAvailable={isLessonSummaryConfigured()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
