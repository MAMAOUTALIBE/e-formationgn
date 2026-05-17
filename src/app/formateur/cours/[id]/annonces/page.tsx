import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Megaphone } from "lucide-react";

import { auth } from "@/auth";
import { AnnouncementDeleteButton } from "@/components/features/instructor/announcement-delete-button";
import { AnnouncementForm } from "@/components/features/instructor/announcement-form";
import { Avatar } from "@/components/ui/avatar";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import {
  getInstructorCourse,
  listCourseAnnouncements,
} from "@/server/queries/instructor";

export const metadata: Metadata = {
  title: "Annonces — Formateur",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function CourseAnnouncementsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/formateur");

  const { id } = await params;
  const course = await getInstructorCourse(id, session.user.id);
  if (!course) notFound();

  const announcements = await listCourseAnnouncements(id, session.user.id);
  const enrollmentsCount = await prisma.enrollment.count({
    where: { courseId: id },
  });

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Formateur", href: "/formateur" },
          { label: "Mes cours", href: "/formateur/cours" },
          { label: course.title, href: `/formateur/cours/${id}` },
          { label: "Annonces" },
        ]}
      />

      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Megaphone
            className="h-6 w-6 text-[color:var(--brand-primary)]"
            aria-hidden
          />
          Annonces
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Communiquez avec les{" "}
          <strong className="text-foreground">
            {enrollmentsCount.toLocaleString("fr-FR")}
          </strong>{" "}
          élèves inscrits à {course.title}.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nouvelle annonce</CardTitle>
        </CardHeader>
        <CardContent>
          <AnnouncementForm courseId={id} />
        </CardContent>
      </Card>

      <section aria-labelledby="annonces-list">
        <h2 id="annonces-list" className="text-lg font-semibold text-foreground">
          Historique
        </h2>
        {!announcements || announcements.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Aucune annonce publiée pour le moment.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {announcements.map((a) => {
              const authorName = a.author.name ?? a.author.firstName ?? "Formateur";
              const initials = authorName[0]?.toUpperCase() ?? "?";
              return (
                <li key={a.id}>
                  <Card>
                    <CardContent className="space-y-3 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar
                            src={a.author.image}
                            alt={authorName}
                            fallback={initials}
                            size={36}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {authorName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {dateFormatter.format(a.createdAt)}
                            </p>
                          </div>
                        </div>
                        <AnnouncementDeleteButton id={a.id} />
                      </div>
                      <h3 className="text-base font-semibold text-foreground">
                        {a.title}
                      </h3>
                      <p className="whitespace-pre-line text-sm text-muted-foreground">
                        {a.body}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
