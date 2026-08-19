// Page publique d'un formateur — vitrine accessible via son lien
// d'affiliation (/formateurs/<affiliateCode>). Vue prospect : bio, photo,
// liens sociaux, stats agrégées (cours / élèves / note), liste des cours
// publiés. Le `?ref=<code>` est appliqué automatiquement sur tous les liens
// vers les cours pour que les achats soient correctement attribués au
// formateur (commission préférentielle 15 %).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Award, BookOpenText, Globe2, Star, Users } from "lucide-react";

import { JsonLd } from "@/components/seo/json-ld";
import { CourseCard } from "@/components/features/courses/course-card";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { BRAND } from "@/lib/brand";
import { Container } from "@/components/ui/container";
import { pluralize } from "@/lib/format/labels";
import { prisma } from "@/lib/prisma";
import { serializeCourseListItem } from "@/server/queries/courses";

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const instructor = await prisma.user.findUnique({
    where: { affiliateCode: code },
    select: { name: true, firstName: true, lastName: true, headline: true, bio: true },
  });
  if (!instructor) return { title: "Formateur introuvable" };

  const name =
    instructor.name ??
    ([instructor.firstName, instructor.lastName].filter(Boolean).join(" ") ||
      "Formateur");

  return {
    title: `${name} · Formateur`,
    description:
      instructor.headline ??
      instructor.bio?.slice(0, 160) ??
      `Découvrez les formations de ${name} sur Aiduca.`,
    alternates: { canonical: `/formateurs/${code}` },
    openGraph: {
      title: `${name} · Formateur sur Aiduca`,
      description:
        instructor.headline ??
        `Découvrez les formations de ${name}, formateur sur la plateforme francophone Aiduca.`,
      type: "profile",
    },
  };
}

export default async function PublicInstructorPage({ params }: PageProps) {
  const { code } = await params;

  // Tout en une seule requête : user + courses publiés. Les stats sont
  // calculées en JS (peu coûteux : limité aux cours du formateur).
  const instructor = await prisma.user.findUnique({
    where: { affiliateCode: code },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      image: true,
      headline: true,
      bio: true,
      websiteUrl: true,
      linkedinUrl: true,
      twitterUrl: true,
      youtubeUrl: true,
      affiliateCode: true,
      isInstructor: true,
      status: true,
      createdAt: true,
      coursesAuthored: {
        where: { status: "PUBLISHED" },
        orderBy: [{ totalEnrollments: "desc" }, { averageRating: "desc" }],
        include: {
          instructor: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              headline: true,
              image: true,
              affiliateCode: true,
            },
          },
          category: { select: { id: true, slug: true, name: true } },
        },
      },
    },
  });

  if (!instructor || !instructor.isInstructor || instructor.status === "DELETED") {
    notFound();
  }

  const name =
    instructor.name ??
    ([instructor.firstName, instructor.lastName].filter(Boolean).join(" ") ||
      "Formateur");
  const initials =
    `${instructor.firstName?.[0] ?? ""}${instructor.lastName?.[0] ?? ""}`.trim() ||
    name[0]?.toUpperCase() ||
    "?";

  // Stats agrégées depuis les cours déjà chargés.
  const totalCourses = instructor.coursesAuthored.length;
  const totalEnrollments = instructor.coursesAuthored.reduce(
    (acc, c) => acc + c.totalEnrollments,
    0,
  );
  const ratedCourses = instructor.coursesAuthored.filter((c) => c.totalRatings > 0);
  const totalRatings = ratedCourses.reduce((acc, c) => acc + c.totalRatings, 0);
  const weightedRating =
    totalRatings === 0
      ? null
      : ratedCourses.reduce((acc, c) => acc + c.averageRating * c.totalRatings, 0) /
        totalRatings;

  // JSON-LD Person pour les rich snippets.
  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    description: instructor.headline ?? instructor.bio?.slice(0, 200),
    image: instructor.image ?? undefined,
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? BRAND.website}/formateurs/${instructor.affiliateCode}`,
    sameAs: [
      instructor.websiteUrl,
      instructor.linkedinUrl,
      instructor.twitterUrl,
      instructor.youtubeUrl,
    ].filter(Boolean),
    jobTitle: instructor.headline ?? "Formateur",
  };

  return (
    <>
      <JsonLd id="instructor-jsonld" data={personJsonLd} />
      <SiteHeader />

      <main className="flex-1">
        <section className="border-b border-border bg-[color:var(--brand-primary)] py-10 text-primary-foreground">
          <Container>
            <Breadcrumbs
              items={[
                { label: "Accueil", href: "/" },
                { label: "Formateurs" },
                { label: name },
              ]}
              className="text-primary-foreground/70 [&_a]:text-primary-foreground/80 [&_a:hover]:text-primary-foreground [&_[aria-current=page]]:text-primary-foreground"
            />

            <div className="mt-6 grid gap-8 lg:grid-cols-[160px_1fr]">
              <div className="flex justify-start">
                <Avatar
                  src={instructor.image}
                  alt={name}
                  fallback={initials}
                  size={140}
                  className="ring-4 ring-white/20"
                />
              </div>

              <div>
                <Badge variant="secondary" className="bg-white/15 text-primary-foreground">
                  Formateur sur Aiduca
                </Badge>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {name}
                </h1>
                {instructor.headline ? (
                  <p className="mt-2 text-lg text-primary-foreground/85">
                    {instructor.headline}
                  </p>
                ) : null}

                {/* Stats inline */}
                <ul className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <li className="inline-flex items-center gap-2">
                    <BookOpenText className="h-4 w-4" aria-hidden />
                    <span className="font-semibold">{totalCourses}</span>
                    <span className="text-primary-foreground/70">
                      {pluralize(totalCourses, "formation", "formations")}
                    </span>
                  </li>
                  <li className="inline-flex items-center gap-2">
                    <Users className="h-4 w-4" aria-hidden />
                    <span className="font-semibold">
                      {totalEnrollments.toLocaleString("fr-FR")}
                    </span>
                    <span className="text-primary-foreground/70">
                      {pluralize(totalEnrollments, "élève")}
                    </span>
                  </li>
                  {weightedRating !== null ? (
                    <li className="inline-flex items-center gap-2">
                      <Star className="h-4 w-4 fill-current" aria-hidden />
                      <span className="font-semibold">{weightedRating.toFixed(1)}</span>
                      <span className="text-primary-foreground/70">
                        ({totalRatings.toLocaleString("fr-FR")}{" "}
                        {pluralize(totalRatings, "avis")})
                      </span>
                    </li>
                  ) : null}
                </ul>

                {/* Liens sociaux */}
                {(instructor.websiteUrl ||
                  instructor.linkedinUrl ||
                  instructor.twitterUrl ||
                  instructor.youtubeUrl) ? (
                  <ul className="mt-5 flex flex-wrap items-center gap-2">
                    {instructor.websiteUrl ? (
                      <SocialLink href={instructor.websiteUrl} label="Site web">
                        <Globe2 className="h-4 w-4" aria-hidden />
                      </SocialLink>
                    ) : null}
                    {instructor.linkedinUrl ? (
                      <SocialLink href={instructor.linkedinUrl} label="LinkedIn">
                        <LinkedinIcon />
                      </SocialLink>
                    ) : null}
                    {instructor.twitterUrl ? (
                      <SocialLink href={instructor.twitterUrl} label="Twitter / X">
                        <TwitterIcon />
                      </SocialLink>
                    ) : null}
                    {instructor.youtubeUrl ? (
                      <SocialLink href={instructor.youtubeUrl} label="YouTube">
                        <YoutubeIcon />
                      </SocialLink>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            </div>
          </Container>
        </section>

        <Container className="py-10">
          <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
            {/* Bio */}
            <aside className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                À propos
              </h2>
              {instructor.bio ? (
                <p className="whitespace-pre-line text-sm leading-6 text-foreground">
                  {instructor.bio}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ce formateur n&apos;a pas encore complété sa bio.
                </p>
              )}

              {totalCourses > 0 && weightedRating !== null && weightedRating >= 4.5 ? (
                <div className="rounded-md border border-[color:var(--brand-warning)]/30 bg-[color:var(--brand-warning)]/5 p-3">
                  <p className="flex items-center gap-2 text-xs font-semibold text-[color:var(--brand-warning)]">
                    <Award className="h-4 w-4" aria-hidden /> Formateur top noté
                  </p>
                  <p className="mt-1 text-xs text-foreground">
                    Plus de {weightedRating.toFixed(1)}/5 sur l&apos;ensemble de ses formations.
                  </p>
                </div>
              ) : null}
            </aside>

            {/* Cours du formateur */}
            <section aria-labelledby="courses-heading">
              <h2 id="courses-heading" className="text-xl font-semibold text-foreground">
                Formations de {name}
              </h2>

              {instructor.coursesAuthored.length === 0 ? (
                <div className="mt-4 rounded-md border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                  Ce formateur n&apos;a pas encore publié de formation.
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {instructor.coursesAuthored.map((course) => (
                    <CourseCard
                      key={course.id}
                      course={serializeCourseListItem(course)}
                      href={`/cours/${course.slug}`}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        {children}
      </a>
    </li>
  );
}

function LinkedinIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.37V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}
