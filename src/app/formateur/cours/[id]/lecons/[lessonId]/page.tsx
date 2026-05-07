import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";

import { auth } from "@/auth";
import { ConfirmAction } from "@/components/features/instructor/confirm-action";
import { LessonEditForm } from "@/components/features/instructor/lesson-edit-form";
import { MuxUploader } from "@/components/features/instructor/mux-uploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
              Modifiez le titre, le type et le contenu textuel ou la ressource.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LessonEditForm
              lessonId={lesson.id}
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
                Téléversez une vidéo. L&apos;encodage et le streaming sont gérés par Mux.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MuxUploader
                lessonId={lesson.id}
                initialPlaybackId={lesson.muxPlaybackId}
                initialDurationSeconds={lesson.videoDurationSeconds}
                isMuxConfigured={isMuxConfigured()}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
