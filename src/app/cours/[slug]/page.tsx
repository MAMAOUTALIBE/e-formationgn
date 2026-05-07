import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, Globe2, Layers, Users } from "lucide-react";

import { auth } from "@/auth";
import { AddToCartButton } from "@/components/features/cart/add-to-cart-button";
import { CourseCard } from "@/components/features/courses/course-card";
import { CourseCurriculum } from "@/components/features/courses/course-curriculum";
import { CourseInstructorCard } from "@/components/features/courses/course-instructor-card";
import { CoursePrice } from "@/components/features/courses/course-price";
import { CourseReviewsList } from "@/components/features/courses/course-reviews-list";
import { ReviewForm } from "@/components/features/reviews/review-form";
import { WishlistButton } from "@/components/features/wishlist/wishlist-button";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { Stars } from "@/components/ui/stars";
import { getCurrentCurrency } from "@/lib/currency";
import { COURSE_LEVEL_LABELS, pluralize } from "@/lib/format/labels";
import { formatDurationFromSeconds } from "@/lib/format/duration";
import { prisma } from "@/lib/prisma";
import {
  getPublishedCourseBySlug,
  getRelatedCourses,
} from "@/server/queries/courses";
import { isCourseInWishlist } from "@/server/actions/wishlist";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await getPublishedCourseBySlug(slug);
  if (!course) return { title: "Cours introuvable" };

  return {
    title: course.metaTitle ?? course.title,
    description: course.metaDescription ?? course.subtitle ?? course.description.slice(0, 160),
    openGraph: {
      title: course.title,
      description: course.subtitle ?? course.description.slice(0, 160),
      images: course.thumbnailUrl ? [{ url: course.thumbnailUrl }] : undefined,
      type: "website",
    },
  };
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const course = await getPublishedCourseBySlug(slug);
  if (!course) notFound();

  const session = await auth();
  const currency = await getCurrentCurrency(session?.user.preferredCurrency ?? "EUR");

  // État de l'élève vis-à-vis du cours (inscrit ? au panier ? wishlist ?)
  let alreadyEnrolled = false;
  let alreadyInCart = false;
  let inWishlist = false;
  let myReview: { rating: number; title: string; comment: string } | null = null;
  if (session?.user) {
    const [enrollment, cartItem, wishlist, review] = await Promise.all([
      prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
        select: { id: true },
      }),
      prisma.cartItem.findUnique({
        where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
        select: { id: true },
      }),
      isCourseInWishlist(course.id),
      prisma.review.findUnique({
        where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
        select: { rating: true, title: true, comment: true },
      }),
    ]);
    alreadyEnrolled = Boolean(enrollment);
    alreadyInCart = Boolean(cartItem);
    inWishlist = wishlist;
    if (review) {
      myReview = {
        rating: review.rating,
        title: review.title ?? "",
        comment: review.comment ?? "",
      };
    }
  }

  const related = await getRelatedCourses(course.id, course.categoryId, 4);
  const totalLessons = course.sections.reduce((acc, s) => acc + s.lessons.length, 0);

  const instructorName =
    course.instructor.name ??
    ([course.instructor.firstName, course.instructor.lastName].filter(Boolean).join(" ") ||
      "Formateur");

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border bg-[color:var(--brand-primary)] py-10 text-primary-foreground">
          <Container className="grid gap-10 lg:grid-cols-[1fr_360px]">
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

              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                {course.title}
              </h1>
              {course.subtitle ? (
                <p className="mt-3 text-base text-primary-foreground/80">{course.subtitle}</p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Stars rating={course.averageRating} size="sm" />
                  <span className="font-medium">{course.averageRating.toFixed(1)}</span>
                  <span className="text-primary-foreground/70">
                    ({course.totalRatings.toLocaleString("fr-FR")} {pluralize(course.totalRatings, "avis")})
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-primary-foreground/80">
                  <Users className="h-4 w-4" aria-hidden />
                  {course.totalEnrollments.toLocaleString("fr-FR")}{" "}
                  {pluralize(course.totalEnrollments, "élève")}
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

            {/* Sidebar achat — sticky desktop */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-md">
                {course.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={course.thumbnailUrl}
                    alt=""
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-[color:var(--brand-primary)]/10 via-muted to-[color:var(--brand-accent)]/10 text-xs uppercase tracking-wide text-muted-foreground">
                    E-FormationGN
                  </div>
                )}
                <div className="p-5">
                  <CoursePrice
                    priceEUR={Number(course.priceEUR)}
                    priceUSD={Number(course.priceUSD)}
                    discountPriceEUR={course.discountPriceEUR != null ? Number(course.discountPriceEUR) : null}
                    discountPriceUSD={course.discountPriceUSD != null ? Number(course.discountPriceUSD) : null}
                    currency={currency}
                    size="lg"
                  />

                  <div className="mt-5 space-y-2">
                    <AddToCartButton
                      courseId={course.id}
                      fullWidth
                      size="lg"
                      alreadyEnrolled={alreadyEnrolled}
                      alreadyInCart={alreadyInCart}
                    />
                    <WishlistButton
                      courseId={course.id}
                      fullWidth
                      initialActive={inWishlist}
                    />
                  </div>

                  <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Clock className="h-4 w-4" aria-hidden />
                      {formatDurationFromSeconds(course.durationSeconds)} de contenu
                    </li>
                    <li className="flex items-center gap-2">
                      <Layers className="h-4 w-4" aria-hidden />
                      {course.sections.length} {pluralize(course.sections.length, "section")} ·{" "}
                      {totalLessons} {pluralize(totalLessons, "leçon")}
                    </li>
                    <li className="flex items-center gap-2">
                      <Globe2 className="h-4 w-4" aria-hidden />
                      Cours en français
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                      Certificat de fin de cours
                    </li>
                  </ul>
                </div>
              </div>
            </aside>
          </Container>
        </section>

        {/* Contenu */}
        <Container className="grid gap-10 py-12 lg:grid-cols-[1fr_360px]">
          <div className="space-y-12">
            {course.whatYouWillLearn && course.whatYouWillLearn.length > 0 ? (
              <section aria-labelledby="objectives">
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
                <CourseCurriculum sections={course.sections} />
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
              <div className="mt-4">
                <CourseReviewsList
                  reviews={course.reviews}
                  averageRating={course.averageRating}
                  totalRatings={course.totalRatings}
                />
              </div>
            </section>
          </div>

          {/* Colonne sticky vide pour réserver l'espace de la sidebar */}
          <div aria-hidden className="hidden lg:block" />
        </Container>

        {/* Cours similaires */}
        {related.length > 0 ? (
          <section className="border-t border-border bg-muted/30 py-12">
            <Container>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Vous aimerez aussi
              </h2>
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {related.map((relatedCourse) => (
                  <CourseCard
                    key={relatedCourse.id}
                    course={relatedCourse}
                    currency={currency}
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
