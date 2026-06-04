import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquare, Star } from "lucide-react";

import { auth } from "@/auth";
import { CourseRatingDistribution } from "@/components/features/courses/course-rating-distribution";
import { InstructorReplyForm } from "@/components/features/instructor/instructor-reply-form";
import { ReportReviewButton } from "@/components/features/instructor/report-review-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { Stars } from "@/components/ui/stars";
import { cn } from "@/lib/utils";
import { listInstructorReviews } from "@/server/queries/instructor";

export const metadata: Metadata = {
  title: "Centre Avis — Formateur",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ filter?: string; rating?: string }>;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function InstructorReviewsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/formateur/avis");

  const { filter, rating } = await searchParams;
  const minRating = rating ? Number(rating) : undefined;
  const onlyUnanswered = filter === "unanswered";

  const [all, unanswered] = await Promise.all([
    listInstructorReviews(session.user.id, {
      limit: 100,
      minRating: minRating,
    }),
    listInstructorReviews(session.user.id, {
      limit: 100,
      onlyUnanswered: true,
    }),
  ]);

  const list = onlyUnanswered ? unanswered : all;

  // Stats résumé
  const totalReviews = all.length;
  const avgRating =
    totalReviews > 0
      ? all.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;
  const ratingBuckets = ([5, 4, 3, 2, 1] as const).map((rating) => {
    const count = all.filter((r) => r.rating === rating).length;
    return {
      rating,
      count,
      percent: totalReviews ? Math.round((count / totalReviews) * 100) : 0,
    };
  });

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Formateur", href: "/formateur" }, { label: "Avis" }]}
      />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Star
              className="h-6 w-6 text-[color:var(--brand-warning)]"
              aria-hidden
            />
            Centre Avis
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Réponses publiques aux avis de vos élèves — gagnez en confiance.
          </p>
        </div>
        {totalReviews > 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <div className="text-right">
              <p className="text-2xl font-semibold text-foreground tabular-nums">
                {avgRating.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">moyenne</p>
            </div>
            <div className="border-l border-border pl-3">
              <Stars rating={avgRating} size="sm" />
              <p className="text-xs text-muted-foreground">
                {totalReviews.toLocaleString("fr-FR")} avis
              </p>
            </div>
          </div>
        ) : null}
      </header>

      {totalReviews > 0 ? (
        <Card>
          <CardContent className="p-5">
            <CourseRatingDistribution
              buckets={ratingBuckets}
              averageRating={avgRating}
              totalRatings={totalReviews}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Tabs */}
      <nav aria-label="Filtres" className="flex flex-wrap gap-1 border-b border-border">
        <TabLink href="/formateur/avis" active={!onlyUnanswered && !minRating}>
          Tous
          <span className="ml-1.5 text-xs text-muted-foreground">({all.length})</span>
        </TabLink>
        <TabLink
          href="/formateur/avis?filter=unanswered"
          active={onlyUnanswered}
        >
          Sans réponse
          <span className="ml-1.5 text-xs text-muted-foreground">
            ({unanswered.length})
          </span>
        </TabLink>
        <div className="ml-auto flex gap-1">
          {[5, 4, 3, 2, 1].map((n) => (
            <Link
              key={n}
              href={`/formateur/avis?rating=${n}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                minRating === n
                  ? "bg-[color:var(--brand-warning)]/15 text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {n}★+
            </Link>
          ))}
        </div>
      </nav>

      {list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center text-sm text-muted-foreground">
            {onlyUnanswered ? (
              <>
                <MessageSquare
                  className="h-8 w-8 text-[color:var(--brand-success)]"
                  aria-hidden
                />
                <p>Tous les avis ont reçu une réponse. Excellent travail !</p>
              </>
            ) : (
              <>
                <Star className="h-8 w-8" aria-hidden />
                <p>Aucun avis pour le moment.</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => {
            const userName = r.user.name ?? r.user.firstName ?? "Élève";
            const initials = userName[0]?.toUpperCase() ?? "?";
            return (
              <li key={r.id}>
                <Card>
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar
                          src={r.user.image}
                          alt={userName}
                          fallback={initials}
                          size={40}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {userName}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <Stars rating={r.rating} size="sm" />
                            <span className="text-xs text-muted-foreground">
                              {dateFormatter.format(r.createdAt)}
                            </span>
                          </div>
                          <Link
                            href={`/cours/${r.course.slug}`}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            {r.course.title}
                          </Link>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.instructorReply ? (
                          <Badge
                            variant="secondary"
                            className="bg-[color:var(--brand-secondary)]/15 text-[color:var(--brand-secondary)]"
                          >
                            Répondu
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-[color:var(--brand-warning)]/40 text-[color:var(--brand-warning)]"
                          >
                            À répondre
                          </Badge>
                        )}
                        <ReportReviewButton reviewId={r.id} />
                      </div>
                    </div>

                    <div>
                      {r.title ? (
                        <p className="text-sm font-semibold text-foreground">
                          {r.title}
                        </p>
                      ) : null}
                      {r.comment ? (
                        <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                          {r.comment}
                        </p>
                      ) : null}
                    </div>

                    <InstructorReplyForm
                      reviewId={r.id}
                      initialReply={r.instructorReply}
                      initialRepliedAt={r.instructorRepliedAt}
                    />
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px inline-flex items-center border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-[color:var(--brand-secondary)] text-foreground"
          : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
