import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { auth } from "@/auth";
import { AskQuestionForm } from "@/components/features/qa/ask-question-form";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Avatar } from "@/components/ui/avatar";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { pluralize } from "@/lib/format/labels";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Questions & réponses",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function CourseQAPage({ params }: PageProps) {
  const { slug } = await params;
  const course = await prisma.course.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true, instructorId: true },
  });
  if (!course) notFound();

  const session = await auth();
  const enrolled = session?.user
    ? Boolean(
        await prisma.enrollment.findUnique({
          where: {
            userId_courseId: { userId: session.user.id, courseId: course.id },
          },
          select: { id: true },
        }),
      )
    : false;

  const questions = await prisma.question.findMany({
    where: { courseId: course.id },
    include: {
      user: { select: { id: true, name: true, firstName: true, image: true } },
      _count: { select: { answers: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-muted/20 py-8">
        <Container className="space-y-6">
          <Breadcrumbs
            items={[
              { label: "Accueil", href: "/" },
              { label: "Catalogue", href: "/cours" },
              { label: course.title, href: `/cours/${course.slug}` },
              { label: "Questions" },
            ]}
          />

          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" /> Questions des élèves
                </CardTitle>
              </CardHeader>
              <CardContent>
                {questions.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                    Aucune question pour le moment. Soyez le premier à poser une question.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {questions.map((question) => {
                      const name =
                        question.user.name ?? question.user.firstName ?? "Élève";
                      return (
                        <li key={question.id} className="py-3">
                          <Link
                            href={`/cours/${course.slug}/questions/${question.id}`}
                            className="flex items-start gap-3 hover:underline"
                          >
                            <Avatar
                              src={question.user.image}
                              alt={name}
                              fallback={name[0]?.toUpperCase() ?? "?"}
                              size={36}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">
                                {question.title}
                              </p>
                              <p className="line-clamp-2 text-xs text-muted-foreground">
                                {question.body}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {name} · {dateFormatter.format(question.createdAt)} ·{" "}
                                {question._count.answers}{" "}
                                {pluralize(question._count.answers, "réponse")}
                              </p>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Poser une question</CardTitle>
                </CardHeader>
                <CardContent>
                  {enrolled ? (
                    <AskQuestionForm courseId={course.id} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Inscrivez-vous au cours pour poser une question au formateur.
                    </p>
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
