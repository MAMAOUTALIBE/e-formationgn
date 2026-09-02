import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  Globe2,
  GraduationCap,
  Home,
  Layers3,
  ListTree,
  MessageSquare,
  Star,
  Target,
  Users,
} from "lucide-react";

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

/**
 * Métadonnées d'une ressource absente.
 *
 * Le layout racine déclare `robots: { index: true, follow: true }` pour tout le
 * site. Une page qui ne trouve pas sa ressource en hérite, et se retrouve avec
 * deux directives contradictoires : celle du layout et le `noindex` que Next
 * injecte avec `notFound()`. Google retient la plus restrictive, mais tous les
 * robots ne le garantissent pas — et sur `/cours/[slug]`, dont le segment
 * possède un `loading.tsx`, la réponse part en streaming avec un statut 200 :
 * le `noindex` est alors la seule chose qui empêche l'indexation d'une page
 * fantôme. Il doit donc être affirmé, pas seulement injecté.
 */
const MISSING_ROBOTS = { robots: { index: false, follow: false } } as const;

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { preview } = await searchParams;
  const session = preview === "1" ? await auth() : null;
  const previewCtx =
    preview === "1" && session?.user
      ? { viewerId: session.user.id, isAdmin: session.user.role === "ADMIN" }
      : undefined;
  const course = await getPublishedCourseBySlug(slug, previewCtx);
  if (!course) return { title: "Formation introuvable", ...MISSING_ROBOTS };

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
    <div className="overflow-hidden rounded-xl border border-[#d8e4df] bg-card text-card-foreground shadow-[0_14px_36px_rgba(15,45,30,0.12)]">
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
          alt={`Aperçu de la formation ${course.title}`}
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-[color:var(--brand-primary)]/10 via-muted to-[color:var(--brand-accent)]/10 text-xs uppercase tracking-wide text-muted-foreground">
          Aiduca
        </div>
      )}
      <div className="space-y-5 p-6">
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
              👁️ <strong>Mode aperçu</strong> — voici comment les apprenants verront
              cette formation. Elle n&apos;est pas encore publique.
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
        <section className="border-b border-[#d8e4df] bg-[linear-gradient(125deg,#f1faf6_0%,#f8fcfa_72%,#edf8f2_100%)] py-6 text-foreground sm:py-8">
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
                className="[&_a]:text-[#405168] [&_a:hover]:text-[#07883f] [&_[aria-current=page]]:text-[#405168]"
              />

              {badges.length > 0 ? (
                <div className="mt-4">
                  <CourseBadges badges={badges} />
                </div>
              ) : null}

              <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#cae7d6] bg-[#eaf7ef] px-3 py-2 text-sm font-semibold text-[#08763a]">
                <BookOpen className="h-4 w-4" aria-hidden />
                {course.category.name}
              </div>

              <h1 className="mt-4 max-w-5xl text-3xl font-bold leading-tight tracking-tight text-[#10213d] sm:text-4xl xl:text-[2.65rem]">
                {course.title}
              </h1>
              {course.subtitle ? (
                <p className="mt-3 max-w-4xl text-base leading-7 text-[#3f5068] sm:text-lg">{course.subtitle}</p>
              ) : null}

              {/* Trust signals : rating + count élèves (gros, mis en avant) */}
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#405168]">
                <span className="inline-flex items-center gap-1.5">
                  <Stars
                    rating={course.averageRating}
                    size="sm"
                    totalRatings={course.totalRatings}
                  />
                  <span className="font-medium">{course.averageRating.toFixed(1)}</span>
                  <span className="text-[#5a6a7f]">
                    ({course.totalRatings.toLocaleString("fr-FR")}{" "}
                    {pluralize(course.totalRatings, "avis")})
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" aria-hidden />
                  {course.totalEnrollments.toLocaleString("fr-FR")}{" "}
                  {pluralize(course.totalEnrollments, "apprenant")}
                </span>
              </div>

              {/* Meta enrichi (pattern Udemy) : dernière mise à jour, langue
                  audio, sous-titres. updatedAt vs publishedAt = signal de
                  fraîcheur (le cours est-il maintenu ?). */}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5a6a7f]">
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

              <p className="mt-3 text-sm text-[#405168]">
                Créé par{" "}
                <Link
                  href={`/cours?q=${encodeURIComponent(instructorName)}`}
                  className="font-semibold text-[#07883f] underline-offset-2 hover:underline"
                >
                  {instructorName}
                </Link>
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-[#405168]">
                <span className="inline-flex items-center gap-2 rounded-md border border-[#d7e4df] bg-white/85 px-3 py-2"><GraduationCap className="h-5 w-5 text-[#07883f]" aria-hidden />{COURSE_LEVEL_LABELS[course.level]}</span>
                <span className="inline-flex items-center gap-2 rounded-md border border-[#d7e4df] bg-white/85 px-3 py-2"><Globe2 className="h-5 w-5 text-[#07883f]" aria-hidden />Français</span>
                <span className="inline-flex items-center gap-2"><Layers3 className="h-5 w-5 text-[#07883f]" aria-hidden />{course.sections.length} {pluralize(course.sections.length, "section")}</span>
                <span className="inline-flex items-center gap-2"><ListTree className="h-5 w-5 text-[#07883f]" aria-hidden />{totalLessons} {pluralize(totalLessons, "leçon")}</span>
                <span className="inline-flex items-center gap-2 rounded-md border border-[#d7e4df] bg-white/85 px-3 py-2"><Award className="h-5 w-5 text-[#07883f]" aria-hidden />Attestation de fin de formation</span>
              </div>

              <nav aria-label="Navigation de la formation" className="mt-6 overflow-x-auto border-b border-[#d8e4df]">
                <ul className="flex min-w-max items-center gap-1">
                  {[
                    { href: "#apercu", label: "Aperçu", icon: Home },
                    { href: "#programme", label: "Programme", icon: ListTree },
                    { href: "#formateur", label: "Formateur", icon: GraduationCap },
                    { href: "#avis", label: "Avis", icon: Star },
                    { href: "#faq", label: "FAQ", icon: CircleHelp },
                  ].map(({ href, label, icon: Icon }, index) => (
                    <li key={href}><a href={href} className={`inline-flex h-14 items-center gap-2 border-b-2 px-4 text-sm font-medium transition-colors hover:text-[#07883f] ${index === 0 ? "border-[#07883f] text-[#07883f]" : "border-transparent text-[#42526a]"}`}><Icon className="h-5 w-5" aria-hidden />{label}</a></li>
                  ))}
                </ul>
              </nav>
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
                id="apercu"
                aria-labelledby="objectives"
                className="scroll-mt-28 rounded-xl border border-[#d6e3de] bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#e8f7ee] text-[#07883f]"><Target className="h-7 w-7" aria-hidden /></div>
                  <div className="min-w-0">
                <h2 id="objectives" className="text-lg font-semibold text-[#13213a]">Ce que vous allez apprendre</h2>
                <ul className="mt-2 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {course.whatYouWillLearn.map((item, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-foreground"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#07883f]"
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                  </div>
                </div>
              </section>
            ) : null}

            <section id="programme" aria-labelledby="curriculum" className="scroll-mt-28">
              <h2 id="curriculum" className="text-xl font-semibold text-foreground">
                Programme de la formation
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
                  À qui s&apos;adresse cette formation
                </h2>
                <ul className="mt-4 list-disc space-y-1 pl-6 text-sm text-muted-foreground">
                  {course.targetAudience.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section id="formateur" aria-labelledby="instructor-section" className="scroll-mt-28">
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

            <section id="avis" aria-labelledby="reviews" className="scroll-mt-28">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="reviews" className="text-xl font-semibold text-foreground">
                  Avis des apprenants
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
          <aside className="hidden lg:block lg:-mt-[27rem]">
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
