import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  Gauge,
  ImageIcon,
  Layers3,
  Pencil,
  Tags,
  X,
} from "lucide-react";

import { BulkCourseGrant } from "@/components/features/admin/bulk-course-grant";
import { CourseDescription } from "@/components/features/admin/course-description";
import { CourseDetailActions } from "@/components/features/admin/course-detail-actions";
import { CourseDetailWorkspace } from "@/components/features/admin/course-detail-workspace";
import { CourseManagementPanel } from "@/components/features/admin/course-management-panel";
import { ModerationForm } from "@/components/features/admin/moderation-form";
import { CourseStatusBadge } from "@/components/features/instructor/course-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { COURSE_LEVEL_LABELS } from "@/lib/format/labels";
import { formatDurationFromSeconds } from "@/lib/format/duration";
import { isTrainingCenterMode } from "@/lib/platform-mode";
import { prisma } from "@/lib/prisma";
import { getPublishCriteria } from "@/lib/validators/course-publish";
import { getAdminCourse } from "@/server/queries/admin";
import { getCourseDeletionStatus } from "@/server/queries/course-deletion";

export const metadata: Metadata = {
  title: "Examiner un cours",
};

export const dynamic = "force-dynamic";

const GRANT_PAGE_SIZE = 50;

interface PageProps {
  params: Promise<{ id: string }>;
}

type AdminCourse = NonNullable<Awaited<ReturnType<typeof getAdminCourse>>>;

export default async function AdminCourseReviewPage({ params }: PageProps) {
  const { id } = await params;
  const course = await getAdminCourse(id);
  if (!course) notFound();

  const trainingCenter = isTrainingCenterMode();
  const [deletion, grantPage] = await Promise.all([
    getCourseDeletionStatus(course.id),
    trainingCenter
      ? Promise.all([
          prisma.user.findMany({
            where: { status: "ACTIVE", role: { in: ["STUDENT", "INSTRUCTOR"] } },
            orderBy: [{ lastName: "asc" }, { email: "asc" }],
            take: GRANT_PAGE_SIZE,
            select: {
              id: true,
              name: true,
              email: true,
              enrollments: {
                where: { courseId: course.id },
                select: { id: true },
                take: 1,
              },
            },
          }),
          prisma.user.count({
            where: { status: "ACTIVE", role: { in: ["STUDENT", "INSTRUCTOR"] } },
          }),
        ])
      : Promise.resolve([[], 0] as const),
  ]);

  const [candidateRows, totalCandidates] = grantPage;
  const grantCandidates = candidateRows.map((user) => ({
    id: user.id,
    name: user.name ?? user.email,
    email: user.email,
    alreadyEnrolled: user.enrollments.length > 0,
  }));
  const totalLessons = course.sections.reduce((total, section) => total + section.lessons.length, 0);
  const publishCriteria = getPublishCriteria(course);
  const completedCriteria = publishCriteria.filter((criterion) => criterion.ok).length;
  const publishable = completedCriteria === publishCriteria.length;
  const previewHref = `/cours/${course.slug}${course.status === "PUBLISHED" ? "" : "?preview=1"}`;

  return (
    <div
      className="page-course-detail flex min-h-0 flex-col gap-3 pb-16 sm:pb-0"
      data-testid="admin-course-detail"
    >
      <header className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0">
            <Link href="/admin/cours" aria-label="Retour à la liste des cours" title="Retour">
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
                {course.title}
              </h1>
              <CourseStatusBadge status={course.status} />
            </div>
            <p className="truncate text-xs text-muted-foreground">
              Par {course.instructor.name ?? course.instructor.email}
            </p>
          </div>
        </div>

        <div className="course-detail-primary-actions flex shrink-0 items-center gap-2 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-30 max-sm:border-t max-sm:border-border max-sm:bg-background/95 max-sm:px-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:pt-2 max-sm:shadow-[0_-8px_24px_rgb(15_23_42/0.08)] max-sm:backdrop-blur">
          <Button asChild variant="outline" size="sm" className="max-sm:flex-1">
            <Link href={previewHref} target="_blank" rel="noopener noreferrer" title="Ouvrir l’aperçu dans un nouvel onglet">
              <Eye className="h-4 w-4" aria-hidden />
              Aperçu
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="max-sm:flex-1">
            <Link href={`/formateur/cours/${course.id}`} title="Modifier le contenu du cours">
              <Pencil className="h-4 w-4" aria-hidden />
              Modifier
            </Link>
          </Button>
          <CourseDetailActions
            courseId={course.id}
            courseTitle={course.title}
            deletable={deletion.deletable}
            enrollments={deletion.enrollments}
          />
        </div>
      </header>

      <CourseDetailWorkspace
        information={
          <InformationCard course={course} totalLessons={totalLessons} />
        }
        program={<ProgramCard course={course} totalLessons={totalLessons} />}
        learners={
          trainingCenter ? (
            <Card className="flex h-full min-h-0 flex-col overflow-hidden">
              <CardHeader className="flex-row items-center justify-between gap-3 px-4 pb-2 pt-4">
                <CardTitle className="text-base">Ouvrir à une promotion</CardTitle>
                <span className="text-xs text-muted-foreground">{totalCandidates} comptes</span>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 px-4 pb-2.5 xl:pb-0">
                <BulkCourseGrant
                  courseId={course.id}
                  candidates={grantCandidates}
                  totalCandidates={totalCandidates}
                  pageSize={GRANT_PAGE_SIZE}
                />
              </CardContent>
            </Card>
          ) : undefined
        }
        quality={
          <QualityAndPublicationCard
            courseId={course.id}
            currentStatus={course.status}
            criteria={publishCriteria}
            completed={completedCriteria}
            publishable={publishable}
          />
        }
        management={
          <CourseManagementPanel
            courseId={course.id}
            isFeatured={course.isFeatured ?? false}
            notes={course.internalNotes ?? ""}
          />
        }
      />
    </div>
  );
}

function InformationCard({ course, totalLessons }: { course: AdminCourse; totalLessons: number }) {
  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="px-4 pb-2 pt-4">
        <CardTitle className="text-base">Informations du cours</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 px-4 pb-2.5">
        <dl className="grid grid-cols-2 overflow-hidden rounded-md border border-border sm:grid-cols-4 lg:grid-cols-7">
          <InformationItem icon={<Tags />} label="Catégorie" value={course.category.name} />
          <InformationItem icon={<Gauge />} label="Niveau" value={COURSE_LEVEL_LABELS[course.level]} />
          <InformationItem icon={<Clock3 />} label="Durée" value={formatDurationFromSeconds(course.durationSeconds)} />
          <InformationItem icon={<Layers3 />} label="Sections" value={String(course.sections.length)} />
          <InformationItem icon={<FileText />} label="Leçons" value={String(totalLessons)} />
          <InformationItem
            icon={<ImageIcon />}
            label="Couverture"
            value={course.thumbnailUrl ? "Présente" : "Absente"}
            danger={!course.thumbnailUrl}
            href={course.thumbnailUrl ?? undefined}
          />
        </dl>
        <CourseDescription description={course.description} />
      </CardContent>
    </Card>
  );
}

function InformationItem({
  icon,
  label,
  value,
  danger,
  href,
  title,
}: {
  icon: React.ReactElement<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  danger?: boolean;
  href?: string;
  title?: string;
}) {
  return (
    <div className="min-w-0 border-b border-r border-border px-3 py-1 last:border-r-0 lg:border-b-0" title={title}>
      <dt className="flex items-center gap-1.5 truncate text-[11px] leading-4 text-muted-foreground">
        {icon && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0">{icon}</span>}
        {label}
      </dt>
      <dd className={danger ? "mt-0.5 truncate text-sm font-medium leading-5 text-destructive" : "mt-0.5 truncate text-sm font-medium leading-5 text-foreground"}>
        {href ? (
          <Link href={href} target="_blank" rel="noopener noreferrer" className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {value}
          </Link>
        ) : value}
      </dd>
    </div>
  );
}

function ProgramCard({ course, totalLessons }: { course: AdminCourse; totalLessons: number }) {
  const published = course.status === "PUBLISHED";

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 px-4 pb-2 pt-4">
        <CardTitle className="text-base">Programme</CardTitle>
        <span className="text-xs text-muted-foreground">
          {course.sections.length} section{course.sections.length > 1 ? "s" : ""} · {totalLessons} leçon{totalLessons > 1 ? "s" : ""}
        </span>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-4 pb-2.5">
        {course.sections.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title="Programme vide"
            description="Ajoutez une première section depuis l’éditeur du cours."
            action={<Button asChild size="sm"><Link href={`/formateur/cours/${course.id}/programme`}>Créer le programme</Link></Button>}
            className="h-full p-5"
          />
        ) : (
          <div className="h-full min-h-0 overflow-y-auto overscroll-contain rounded-md border border-border">
            <div className="sticky top-0 z-10 hidden h-9 grid-cols-[minmax(0,1fr)_7rem_6rem_2.5rem] items-center border-b border-border bg-card px-3 text-xs font-medium text-muted-foreground sm:grid">
              <span>Contenu</span><span>Type</span><span>Statut</span><span className="sr-only">Actions</span>
            </div>
            {course.sections.map((section, sectionIndex) => (
              <details key={section.id} open={sectionIndex === 0} className="group border-b border-border last:border-b-0">
                <summary className="grid min-h-11 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-2 bg-muted/20 px-3 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_7rem_6rem_2.5rem] [&::-webkit-details-marker]:hidden">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                    <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
                    <span className="truncate">{section.title}</span>
                    <span className="text-xs font-normal text-muted-foreground">({section.lessons.length})</span>
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:block">Section</span>
                  <StatusBadge tone={published ? "success" : "neutral"} className="hidden w-fit sm:inline-flex">
                    {published ? "Publié" : "Non publié"}
                  </StatusBadge>
                  <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Modifier la section">
                    <Link href={`/formateur/cours/${course.id}/programme`} aria-label={`Modifier la section ${section.title}`}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </Button>
                </summary>
                {section.lessons.length === 0 ? (
                  <p className="px-9 py-3 text-xs text-muted-foreground">Cette section ne contient encore aucune leçon.</p>
                ) : (
                  <ul className="divide-y divide-border/70">
                    {section.lessons.map((lesson) => (
                      <li key={lesson.id} className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 pl-9 text-sm sm:grid-cols-[minmax(0,1fr)_7rem_6rem_2.5rem]">
                        <span className="truncate text-foreground">{lesson.title}</span>
                        <span className="hidden text-xs text-muted-foreground sm:block">{lessonTypeLabel(lesson.type)}</span>
                        <StatusBadge tone={published ? "success" : "neutral"} className="hidden w-fit sm:inline-flex">
                          {published ? "Publié" : "Non publié"}
                        </StatusBadge>
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Modifier la leçon">
                          <Link href={`/formateur/cours/${course.id}/lecons/${lesson.id}`} aria-label={`Modifier la leçon ${lesson.title}`}>
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QualityAndPublicationCard({
  courseId,
  currentStatus,
  criteria,
  completed,
  publishable,
}: {
  courseId: string;
  currentStatus: AdminCourse["status"];
  criteria: ReturnType<typeof getPublishCriteria>;
  completed: number;
  publishable: boolean;
}) {
  const percent = Math.round((completed / Math.max(criteria.length, 1)) * 100);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0 px-4 pb-2 pt-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Qualité et publication</CardTitle>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">{completed}/{criteria.length}</span>
        </div>
        <div
          role="progressbar"
          aria-label="Progression des critères qualité"
          aria-valuemin={0}
          aria-valuemax={criteria.length}
          aria-valuenow={completed}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <span className="block h-full rounded-full bg-[color:var(--brand-success)] transition-[width]" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">{completed} critères sur {criteria.length}</p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-2.5">
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain" aria-label="Checklist qualité">
          {criteria.map((criterion) => (
            <li key={criterion.key} className="flex items-start gap-2 text-sm">
              {criterion.ok ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-success)]" aria-label="Rempli" />
              ) : (
                <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-label="Manquant" />
              )}
              <span className={criterion.ok ? "text-muted-foreground" : "text-foreground"}>{criterion.label}</span>
            </li>
          ))}
        </ul>
        <div className="shrink-0 border-t border-border pt-3">
          <p className="mb-2 text-sm font-medium text-foreground">Décision de modération</p>
          <ModerationForm
            courseId={courseId}
            currentStatus={currentStatus}
            publishable={publishable}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function lessonTypeLabel(type: AdminCourse["sections"][number]["lessons"][number]["type"]): string {
  switch (type) {
    case "VIDEO": return "Vidéo";
    case "QUIZ": return "Quiz";
    case "RESOURCE": return "Ressource";
    case "TEXT": return "Texte";
  }
}
