import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { AnswerForm } from "@/components/features/qa/answer-form";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { prisma } from "@/lib/prisma";
import { canAnswerQuestion, canReadQuestion } from "@/lib/qa-access";

export const metadata: Metadata = {
  title: "Question",
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

interface PageProps {
  params: Promise<{ slug: string; questionId: string }>;
}

export default async function QuestionThreadPage({ params }: PageProps) {
  const { slug, questionId } = await params;

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      user: { select: { id: true, name: true, firstName: true, image: true } },
      course: { select: { slug: true, title: true, instructorId: true } },
      answers: {
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: { id: true, name: true, firstName: true, image: true },
          },
        },
      },
    },
  });
  if (!question || question.course.slug !== slug) notFound();

  const session = await auth();
  if (
    !canReadQuestion({
      viewerId: session?.user?.id ?? null,
      viewerRole: session?.user?.role,
      authorId: question.userId,
      instructorId: question.course.instructorId,
      visibility: question.visibility,
    })
  ) {
    notFound();
  }
  const enrolled = session?.user
    ? Boolean(
        await prisma.enrollment.findUnique({
          where: {
            userId_courseId: {
              userId: session.user.id,
              courseId: question.courseId,
            },
          },
          select: { id: true },
        }),
      )
    : false;
  const canAnswer = canAnswerQuestion({
    viewerId: session?.user?.id ?? null,
    viewerRole: session?.user?.role,
    authorId: question.userId,
    instructorId: question.course.instructorId,
    visibility: question.visibility,
    isEnrolled: enrolled,
  });

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-muted/20 py-8">
        <Container className="max-w-3xl space-y-6">
          <Breadcrumbs
            items={[
              { label: "Accueil", href: "/" },
              { label: "Catalogue", href: "/cours" },
              { label: question.course.title, href: `/cours/${slug}` },
              { label: "Questions", href: `/cours/${slug}/questions` },
              { label: question.title },
            ]}
          />

          <Card>
            <CardHeader>
              <CardTitle>{question.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Avatar
                  src={question.user.image}
                  alt={question.user.name ?? "Élève"}
                  fallback={(question.user.name ?? "?")[0].toUpperCase()}
                  size={40}
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {question.user.name ?? question.user.firstName ?? "Élève"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dateFormatter.format(question.createdAt)}
                  </p>
                </div>
              </div>
              <div className="whitespace-pre-line text-sm leading-6 text-foreground">
                {question.body}
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="mb-3 text-base font-semibold text-foreground">
              {question.answers.length} réponse{question.answers.length > 1 ? "s" : ""}
            </h2>
            <ul className="space-y-3">
              {question.answers.map((answer) => {
                const isAuthor = answer.user.id === question.course.instructorId;
                const name = answer.user.name ?? answer.user.firstName ?? "Élève";
                return (
                  <li key={answer.id}>
                    <Card>
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3">
                            <Avatar
                              src={answer.user.image}
                              alt={name}
                              fallback={name[0].toUpperCase()}
                              size={36}
                            />
                            <div>
                              <p className="text-sm font-medium text-foreground">{name}</p>
                              <p className="text-xs text-muted-foreground">
                                {dateFormatter.format(answer.createdAt)}
                              </p>
                            </div>
                          </div>
                          {isAuthor ? <Badge>Formateur</Badge> : null}
                        </div>
                        <p className="whitespace-pre-line text-sm leading-6 text-foreground">
                          {answer.body}
                        </p>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </div>

          {canAnswer ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Répondre</CardTitle>
              </CardHeader>
              <CardContent>
                <AnswerForm questionId={question.id} />
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">
              Inscrivez-vous au cours pour pouvoir répondre.
            </p>
          )}
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
