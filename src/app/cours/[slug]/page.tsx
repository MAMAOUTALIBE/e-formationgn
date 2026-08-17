import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, Globe2, MessageSquare, Users } from "lucide-react";

import { auth } from "@/auth";
import { JsonLd } from "@/components/seo/json-ld";
import { CourseBadges } from "@/components/features/courses/course-badges";
import { CourseCard } from "@/components/features/courses/course-card";
import { CourseCurriculum } from "@/components/features/courses/course-curriculum";
import { CourseFaq } from "@/components/features/courses/course-faq";
import { CourseFeaturedReview } from "@/components/features/courses/course-featured-review";
import { CourseIncludes } from "@/components/features/courses/course-includes";
import { CourseInstructorCard } from "@/components/features/courses/course-instructor-card";
import { CourseAccessNotice } from "@/components/features/courses/course-access-notice";
import { CourseRatingDistribution } from "@/components/features/courses/course-rating-distribution";
import { CourseReviewsList } from "@/components/features/courses/course-reviews-list";
import { PromoVideoPlayer } from "@/components/features/courses/promo-video-player";
import { ReviewForm } from "@/components/features/reviews/review-form";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { Stars } from "@/components/ui/stars";
import { getCourseBadges } from "@/lib/courses/badges";
import { COURSE_LEVEL_LABELS, pluralize } from "@/lib/format/labels";
import { prisma } from "@/lib/prisma";
import { buildCourseJsonLd } from "@/lib/seo/json-ld";
import {
  getCourseRatingDistribution,
  getFeaturedReview,
  getPublishedCourseBySlug,
  getRelatedCourses,
} from "@/server/queries/courses";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await getPublishedCourseBySlug(slug);
  if (!course) return { title: "Cours introuvable" };

  const description =
    course.metaDescription ?? course.subtitle ?? course.description.slice(0, 160);

  const ogQs = new URLSearchParams({
    kind: "course",
    title: course.title,
    subtitle: course.subtitle ?? "",
    rating: course.averageRating.toFixed(1),
    totalRatings: String(course.totalRatings),
  });
  const ogImage = `/api/og?${ogQs.toString()}`;

  return {
    title: course.metaTitle ?? course.title,
    description,
    alternates: { canonical: `/cours/${course.slug}` },
    openGraph: {
      title: course.title,
      description,
      type: "website",
      url: `/cours/${course.slug}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: course.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: course.title,
      description,
      images: [ogImage],
    },
  };
}

export default async function CourseDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const session = await auth();

  // Aperçu propriétaire/admin : permet de voir un cours non publié.
  const previewCtx =
    preview === "1" && session?.user
      ? { viewerId: session.user.id, isAdmin: session.user.role === "ADMIN" }
      : undefined;

  const course = await getPublishedCourseBySlug(slug, previewCtx);
  if (!course) notFound();

  const isPreview = course.status !== "PUBLISHED";

  // État pédagogique de l'apprenant vis-à-vis du cours.
  let alreadyEnrolled = false;
  let myReview: { rating: number; title: string; comment: string } | null = null;
  if (session?.user) {
    const [enrollment, review] = await Promise.all([
      prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
        select: { id: true },
      }),
      prisma.review.findUnique({
        where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
        select: { rating: true, title: true, comment: true },
      }),
    ]);
    alreadyEnrolled = Boolean(enrollment);
    if (review) {
      myReview = {
        rating: review.rating,
        title: review.title ?? "",
        comment: review.comment ?? "",
      };
    }
  }

  const [related, ratingDistribution, featuredReview] = await Promise.all([
    getRelatedCourses(course.id, course.categoryId, 4),
    getCourseRatingDistribution(course.id),
    getFeaturedReview(course.id),
  ]);

  const totalLessons = course.sections.reduce((acc, s) => acc + s.lessons.length, 0);
  const resourceCount = course.sections.reduce(
    (acc, s) => acc + s.lessons.filter((l) => l.type === "RESOURCE").length,
    0,
  );

  const instructorName =
    course.instructor.name ??
    ([course.instructor.firstName, course.instructor.lastName].filter(Boolean).join(" ") ||
      "Formateur");

  const badges = getCourseBadges({
    totalEnrollments: course.totalEnrollments,
    averageRating: course.averageRating,
    totalRatings: course.totalRatings,
    publishedAt: course.publishedAt,
    isFeatured: course.isFeatured,
  });

  // Card prix : extraite en fragment pour être réutilisée dans la sticky
  // desktop ET dans la version inline mobile (sous le hero).
  const accessCard = (
    <div className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-md">
      {course.promoVideoPlaybackId || course.promoVideoUrl ? (
        <PromoVideoPlayer
          playbackId={course.promoVideoPlaybackId}
          videoUrl={course.promoVideoUrl}
          title={course.title}
          thumbnailUrl={course.thumbnailUrl}
        />
      ) : course.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={course.thumbnailUrl}
          alt={`Aperçu du cours ${course.title}`}
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-[color:var(--brand-primary)]/10 via-muted to-[color:var(--brand-accent)]/10 text-xs uppercase tracking-wide text-muted-foreground">
          Gandal
        </div>
      )}
      <div className="space-y-5 p-5">
        <CourseAccessNotice alreadyEnrolled={alreadyEnrolled} slug={course.slug} />

        <div className="border-t border-border pt-5">
          <CourseIncludes
            durationSeconds={course.durationSeconds}
            lessonCount={totalLessons}
            resourceCount={resourceCount}
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <JsonLd id="course-jsonld" data={buildCourseJsonLd(course)} />
      <SiteHeader />

      {isPreview ? (
        <div className="border-b border-amber-300 bg-amber-50 py-2 text-amber-900">
          <Container className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              👁️ <strong>Mode aperçu</strong> — voici comment les élèves verront
              ce cours. Il n&apos;est pas encore public.
            </span>
            <Link
              href={`/formateur/cours/${course.id}`}
              className="font-medium underline underline-offset-2"
            >
              Retour à l&apos;édition
            </Link>
          </Container>
        </div>
      ) : null}

      <main className="flex-1 pb-24 lg:pb-0">
        {/* Hero — fond plein largeur ; la sticky card de droite (desktop)
            est positionnée par-dessus via le grid du bloc suivant avec
            marge négative `lg:-mt-72`. */}
        <section className="border-b border-border bg-[color:var(--brand-primary)] py-8 text-primary-foreground">
          <Container className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <div>
              <Breadcrumbs
                items={[
                  { label: "Accueil", href: "/" },
                  { label: "Catalogue", href: "/cours" },
                  {
                    label: course.category.name,
                    href: `/categories/${course.category.slug}`,
                  },
                  { label: course.title },
                ]}
                className="text-primary-foreground/70 [&_a]:text-primary-foreground/80 [&_a:hover]:text-primary-foreground [&_[aria-current=page]]:text-primary-foreground"
              />

              {badges.length > 0 ? (
                <div className="mt-4">
                  <CourseBadges badges={badges} />
                </div>
              ) : null}

              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                {course.title}
              </h1>
              {course.subtitle ? (
                <p className="mt-3 text-base text-primary-foreground/80">{course.subtitle}</p>
              ) : null}

              {/* Trust signals : rating + count élèves (gros, mis en avant) */}
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Stars
                    rating={course.averageRating}
                    size="sm"
                    totalRatings={course.totalRatings}
                  />
                  <span className="font-medium">{course.averageRating.toFixed(1)}</span>
                  <span className="text-primary-foreground/70">
                    ({course.totalRatings.toLocaleString("fr-FR")}{" "}
                    {pluralize(course.totalRatings, "avis")})
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-primary-foreground/80">
                  <Users className="h-4 w-4" aria-hidden />
                  {course.totalEnrollments.toLocaleString("fr-FR")}{" "}
                  {pluralize(course.totalEnrollments, "élève")}
                </span>
              </div>

              {/* Meta enrichi (pattern Udemy) : dernière mise à jour, langue
                  audio, sous-titres. updatedAt vs publishedAt = signal de
                  fraîcheur (le cours est-il maintenu ?). */}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-primary-foreground/70">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                  Dernière mise à jour :{" "}
                  {new Intl.DateTimeFormat("fr-FR", {
                    month: "long",
                    year: "numeric",
                  }).format(course.updatedAt)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Globe2 className="h-3.5 w-3.5" aria-hidden />
                  Audio : Français
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                  Sous-titres : Français
                </span>
              </div>

              <p className="mt-3 text-sm text-primary-foreground/80">
                Créé par{" "}
                <Link
                  href={`/cours?q=${encodeURIComponent(instructorName)}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {instructorName}
                </Link>
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <Badge variant="accent">{COURSE_LEVEL_LABELS[course.level]}</Badge>
                <Badge variant="secondary" className="bg-white/10 text-primary-foreground">
                  {course.category.name}
                </Badge>
                {course.tags.slice(0, 3).map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="border-white/20 text-primary-foreground"
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Slot vide à droite du hero — la sticky card est rendue dans
                la section suivante avec marge négative. */}
            <div aria-hidden className="hidden lg:block" />
          </Container>
        </section>

        {/* Contenu principal et état d'accès */}
        <Container className="grid gap-8 py-8 lg:grid-cols-[1fr_360px]">
          {/* Colonne principale */}
          <div className="space-y-8">
            {/* Card prix inline mobile/tablette (sous le hero) */}
            <div className="lg:hidden">{accessCard}</div>

            {course.whatYouWillLearn && course.whatYouWillLearn.length > 0 ? (
              <section
                aria-labelledby="objectives"
                className="rounded-lg border border-border bg-card p-6"
              >
                <h2 id="objectives" className="text-xl font-semibold text-foreground">
                  Ce que vous allez apprendre
                </h2>
                <ul className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {course.whatYouWillLearn.map((item, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-foreground"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-success)]"
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="curriculum">
              <h2 id="curriculum" className="text-xl font-semibold text-foreground">
                Programme du cours
              </h2>
              <div className="mt-4">
                <CourseCurriculum sections={course.sections} courseSlug={course.slug} />
              </div>
            </section>

            {course.requirements && course.requirements.length > 0 ? (
              <section aria-labelledby="requirements">
                <h2 id="requirements" className="text-xl font-semibold text-foreground">
                  Pré-requis
                </h2>
                <ul className="mt-4 list-disc space-y-1 pl-6 text-sm text-muted-foreground">
                  {course.requirements.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="description">
              <h2 id="description" className="text-xl font-semibold text-foreground">
                Description
              </h2>
              <div className="prose prose-sm mt-4 max-w-none whitespace-pre-line text-muted-foreground">
                {course.description}
              </div>
            </section>

            {course.targetAudience && course.targetAudience.length > 0 ? (
              <section aria-labelledby="audience">
                <h2 id="audience" className="text-xl font-semibold text-foreground">
                  À qui s&apos;adresse ce cours
                </h2>
                <ul className="mt-4 list-disc space-y-1 pl-6 text-sm text-muted-foreground">
                  {course.targetAudience.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="instructor-section">
              <h2 id="instructor-section" className="text-xl font-semibold text-foreground">
                Votre formateur
              </h2>
              <div className="mt-4">
                <CourseInstructorCard instructor={course.instructor} />
              </div>
            </section>

            {alreadyEnrolled ? (
              <section aria-labelledby="leave-review">
                <h2 id="leave-review" className="text-xl font-semibold text-foreground">
                  {myReview ? "Modifier mon avis" : "Donner mon avis"}
                </h2>
                <div className="mt-4 rounded-lg border border-border bg-card p-5">
                  <ReviewForm courseId={course.id} initial={myReview ?? undefined} />
                </div>
              </section>
            ) : null}

            <section aria-labelledby="reviews">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="reviews" className="text-xl font-semibold text-foreground">
                  Avis des élèves
                </h2>
                <Link
                  href={`/cours/${course.slug}/questions`}
                  className="text-sm text-[color:var(--brand-secondary)] hover:underline"
                >
                  Questions & réponses →
                </Link>
              </div>
              {course.totalRatings > 0 ? (
                <div className="mt-4 rounded-lg border border-border bg-card p-6">
                  <CourseRatingDistribution
                    buckets={ratingDistribution}
                    averageRating={course.averageRating}
                    totalRatings={course.totalRatings}
                  />
                </div>
              ) : null}
              {featuredReview ? (
                <div className="mt-6">
                  <CourseFeaturedReview review={featuredReview} />
                </div>
              ) : null}
              <div className="mt-6">
                <CourseReviewsList
                  reviews={course.reviews}
                  averageRating={course.averageRating}
                  totalRatings={course.totalRatings}
                />
              </div>
            </section>

            <CourseFaq />
          </div>

          {/* Carte d'accès desktop — chevauche le hero via marge négative.
              `lg:-mt-72` (≈18 rem) fait remonter la card sur le bandeau bleu,
              `lg:sticky lg:top-24` la garde visible pendant tout le scroll. */}
          <aside className="hidden lg:block lg:-mt-72">
            <div className="sticky top-24">{accessCard}</div>
          </aside>
        </Container>

        {/* Cours similaires */}
        {related.length > 0 ? (
          <section className="border-t border-border bg-muted/30 py-8">
            <Container>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Vous aimerez aussi
              </h2>
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {related.map((relatedCourse) => (
                  <CourseCard
                    key={relatedCourse.id}
                    course={relatedCourse}
                  />
                ))}
              </div>
            </Container>
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}
