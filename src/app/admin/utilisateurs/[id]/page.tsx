import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountCredentials } from "@/components/features/admin/account-credentials";
import { AccountIdentityForm } from "@/components/features/admin/account-identity-form";
import { toDateInputValue } from "@/lib/date-input";
import { DeleteAccountButton } from "@/components/features/admin/delete-account-button";
import { CourseAccessManager } from "@/components/features/admin/course-access-manager";
import { StudentRegistrations } from "@/components/features/admin/student-registrations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { STAFF_ROLE_LABELS, STAFF_ROLES, type StaffRole } from "@/lib/account-audience";
import { joinFullName } from "@/lib/identity-name";
import { isTrainingCenterMode } from "@/lib/platform-mode";
import { prisma } from "@/lib/prisma";
import {
  addAdminNoteOnUser,
  banUser,
  changeUserRole,
  deleteUserGdpr,
  exportUserGdprData,
  forceVerifyEmail,
  reactivateUser,
  suspendUser,
} from "@/server/actions/admin-users";
import { startImpersonation } from "@/server/actions/admin-impersonation";
import { getAdminUserDetail } from "@/server/queries/admin-users";
import {
  getStudentRegistrations,
  listOpenSessions,
} from "@/server/queries/admin-registrations";

export const metadata: Metadata = {
  title: "Fiche utilisateur — CRM admin",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getAdminUserDetail(id);
  if (!data) notFound();
  const isLearner = data.user.role === "STUDENT";
  const backHref = isLearner ? "/admin/utilisateurs" : "/admin/equipe";

  // Catalogue attribuable : uniquement les formations publiées — attribuer un
  // brouillon donnerait un accès à un contenu incomplet.
  const assignableCourses = isTrainingCenterMode() && isLearner
    ? await prisma.course.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { title: "asc" },
        select: { id: true, title: true },
      })
    : [];

  // Inscriptions : seuls les élèves en ont. Les deux lectures sont
  // indépendantes, donc en parallèle.
  //
  // Les tableaux vides sont annotés explicitement : sans ça le ternaire
  // produit une union de types tableau, et TypeScript refuse d'appeler `.map`
  // sur une union de signatures.
  const [registrations, openSessions]: [
    Awaited<ReturnType<typeof getStudentRegistrations>>,
    Awaited<ReturnType<typeof listOpenSessions>>,
  ] =
    isLearner
      ? await Promise.all([getStudentRegistrations(id), listOpenSessions()])
      : [[], []];

  const {
    user,
    enrollments,
    recentAudit,
    notes,
    engagement,
    lastSessionExpires,
  } = data;

  const completionRate =
    engagement.lessonsStarted > 0
      ? (engagement.lessonsCompleted / engagement.lessonsStarted) * 100
      : 0;

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Retour {isLearner ? "aux apprenants" : "à l’équipe"}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {user.name ?? user.email}
          </h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge tone={user.status === "ACTIVE" ? "success" : user.status === "SUSPENDED" ? "warning" : "neutral"}>
              {user.status}
            </StatusBadge>
            <StatusBadge tone="info">{user.role}</StatusBadge>
            {user.bannedAt ? (
              <StatusBadge tone="danger">Banni</StatusBadge>
            ) : null}
            {user.country ? (
              <Badge variant="outline">{user.country}</Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {user.status === "PENDING_VERIFICATION" ? (
            <ServerActionButton
              action={async () => {
                "use server";
                await forceVerifyEmail(user.id);
              }}
              label="Vérifier email"
            />
          ) : null}
          {user.status === "ACTIVE" ? (
            <ServerActionButton
              action={async () => {
                "use server";
                await suspendUser(user.id, "Action admin");
              }}
              label="Suspendre"
            />
          ) : (
            <ServerActionButton
              action={async () => {
                "use server";
                await reactivateUser(user.id);
              }}
              label="Réactiver"
            />
          )}
          <ServerActionButton
            action={async () => {
              "use server";
              await startImpersonation(user.id, "Debug admin");
            }}
            label="Impersonate"
            variant="outline"
          />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLearner ? (
          <>
            <MiniStat label="Inscriptions" value={user._count.enrollments} />
            <MiniStat label="Certificats" value={user._count.certificates} />
            <MiniStat label="Avis" value={user._count.reviews} />
          </>
        ) : (
          <>
            <MiniStat label="Formations créées" value={user._count.coursesAuthored} />
            <MiniStat label="Avis" value={user._count.reviews} />
            <MiniStat label="Questions" value={user._count.questions} />
            <MiniStat
              label="Dernière connexion"
              value={user.lastLoginAt?.toLocaleDateString("fr-FR") ?? "Jamais"}
            />
          </>
        )}
      </section>

      {isLearner ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Inscriptions — formations et sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Le statut d'inscription pilote les accès réels : activer ouvre
                les formations du programme, suspendre les retire. */}
            <StudentRegistrations
              studentId={user.id}
              registrations={registrations.map((r) => ({
                id: r.id,
                status: r.status,
                programTitle: r.session.program.title,
                sessionReference: r.session.reference,
                startDate: r.session.startDate.toLocaleDateString("fr-FR"),
                endDate: r.session.endDate.toLocaleDateString("fr-FR"),
                courseCount: r.session.program._count.courses,
              }))}
              sessions={openSessions.map((s) => ({
                id: s.id,
                label: s.label,
                full: s.full,
                seatsLeft: s.seatsLeft,
              }))}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {user.identityLockedAt ? (
            <p className="text-xs text-muted-foreground">
              Identité verrouillée depuis le{" "}
              {user.identityLockedAt.toLocaleDateString("fr-FR")} : le titulaire
              la voit en lecture seule dans son espace. Elle ne se corrige que
              d&apos;ici.
            </p>
          ) : null}
          <AccountIdentityForm
            userId={user.id}
            certificatesCount={user._count.certificates}
            values={{
              fullName: joinFullName(user),
              birthDate: toDateInputValue(user.birthDate),
              birthPlace: user.birthPlace ?? "",
              gender: user.gender ?? "",
              phone: user.phone ?? "",
              country: user.country ?? "",
              address: user.address ?? "",
            }}
          />
        </CardContent>
      </Card>

      {isTrainingCenterMode() ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identifiants</CardTitle>
          </CardHeader>
          <CardContent>
            {/* On ne transmet au client que l'identifiant et la date : le reste
                de `user` contient l'empreinte du mot de passe, qui n'a rien à
                faire dans la charge utile envoyée au navigateur. */}
            <AccountCredentials
              userId={user.id}
              email={user.email}
              passwordChangedAt={
                user.passwordChangedAt
                  ? user.passwordChangedAt.toLocaleString("fr-FR")
                  : null
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {isLearner ? (
        <>
          {/* Engagement apprentissage — pattern Udemy student profile */}
          <section
        aria-labelledby="engagement-heading"
        className="rounded-lg border border-border bg-card p-5"
      >
        <h2
          id="engagement-heading"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Engagement apprentissage
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat
            label="Leçons commencées"
            value={engagement.lessonsStarted}
          />
          <MiniStat
            label="Leçons terminées"
            value={engagement.lessonsCompleted}
          />
          <MiniStat
            label="Taux de complétion"
            value={`${completionRate.toFixed(0)}%`}
          />
          <MiniStat
            label="Temps de visionnage"
            value={formatDuration(engagement.totalWatchedSeconds)}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {user.lastLoginAt
            ? `Dernière connexion : ${user.lastLoginAt.toLocaleString("fr-FR")}`
            : "Aucune connexion récente enregistrée"}
          {lastSessionExpires
            ? ` · Session active jusqu'au ${lastSessionExpires.toLocaleString("fr-FR")}`
            : ""}
        </p>
          </section>

          {isTrainingCenterMode() ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accès aux formations</CardTitle>
          </CardHeader>
          <CardContent>
            <CourseAccessManager
              userId={user.id}
              granted={enrollments.map((e) => ({
                id: e.id,
                courseId: e.course.id,
                title: e.course.title,
                progressPercent: e.progressPercent,
                source: e.source,
              }))}
              assignable={assignableCourses}
            />
          </CardContent>
        </Card>
          ) : null}

          <Card>
        <CardHeader>
          <CardTitle className="text-base">Apprentissage</CardTitle>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune inscription.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {enrollments.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    href={`/cours/${e.course.slug}`}
                    className="min-w-0 flex-1 truncate font-medium text-foreground hover:underline"
                  >
                    {e.course.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {e.progressPercent.toFixed(0)} %{" "}
                    {e.completedAt ? "· Terminé" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
          </Card>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes internes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async (formData: FormData) => {
              "use server";
              await addAdminNoteOnUser(user.id, String(formData.get("body") ?? ""));
            }}
            className="flex flex-col gap-2"
          >
            {/* Étiquette masquée à l'œil, présente pour les technologies
                d'assistance : un texte de substitution ne tient pas lieu
                d'étiquette (RGAA 11.1). */}
            <label htmlFor="admin-note-body" className="sr-only">
              Note interne sur cet apprenant
            </label>
            <textarea
              id="admin-note-body"
              name="body"
              placeholder="Ajoutez une note (visible uniquement par l'équipe)…"
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" size="sm" className="self-end">
              Ajouter
            </Button>
          </form>
          <ul className="space-y-2 text-sm">
            {notes.length === 0 ? (
              <li className="text-muted-foreground">Aucune note pour le moment.</li>
            ) : (
              notes.map((n) => (
                <li key={n.id} className="rounded-md border border-border p-2">
                  <p className="whitespace-pre-wrap text-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.author.name ?? n.author.email} ·{" "}
                    {n.createdAt.toLocaleString("fr-FR")}
                  </p>
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activité (audit)</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAudit.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune entrée d&apos;audit.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {recentAudit.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <span>{a.action}</span>
                  <time className="text-xs text-muted-foreground">
                    {a.createdAt.toLocaleString("fr-FR")}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-red-300/60 bg-red-50/40 dark:border-red-900/30 dark:bg-red-950/20">
        <CardHeader>
          <CardTitle className="text-base text-red-900 dark:text-red-200">
            Zone à risque
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            action={async () => {
              "use server";
              await banUser(user.id, "Bannissement admin");
            }}
            className="flex items-center justify-between gap-3"
          >
            <span className="text-sm text-foreground">
              Bannir le compte (suspend + bloque la reconnexion)
            </span>
            <Button type="submit" size="sm" variant="outline">
              Bannir
            </Button>
          </form>
          {!isLearner ? (
            <StaffRoleChangeForm currentRole={user.role as StaffRole} userId={user.id} />
          ) : (
            <p className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              Ce compte reste un apprenant. Pour donner un accès interne à cette
              personne, créez un compte séparé depuis « Équipe &amp; accès ».
            </p>
          )}
          <form
            action={async () => {
              "use server";
              await exportUserGdprData(user.id);
            }}
            className="flex items-center justify-between gap-3"
          >
            <span className="text-sm text-foreground">
              Demander l&apos;export RGPD complet
            </span>
            <Button type="submit" size="sm" variant="outline">
              Export RGPD
            </Button>
          </form>
          <form
            action={async () => {
              "use server";
              await deleteUserGdpr(user.id);
            }}
            className="flex items-center justify-between gap-3"
          >
            <span className="text-sm text-foreground">
              Archiver le compte (demande RGPD) — réversible
            </span>
            <Button type="submit" size="sm" variant="outline">
              Archiver
            </Button>
          </form>
          {isLearner ? (
            <DeleteAccountButton
              userId={user.id}
              email={user.email}
              certificatesCount={user._count.certificates}
              enrollmentsCount={user._count.enrollments}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds === 0) return "—";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function ServerActionButton({
  action,
  label,
  variant,
}: {
  action: () => Promise<void>;
  label: string;
  variant?: "outline";
}) {
  return (
    <form action={action}>
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
    </form>
  );
}

function StaffRoleChangeForm({
  currentRole,
  userId,
}: {
  currentRole: StaffRole;
  userId: string;
}) {
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        const role = formData.get("role") as StaffRole;
        await changeUserRole(userId, role);
      }}
      className="flex items-center justify-between gap-3"
    >
      <span className="text-sm text-foreground">Changer le rôle</span>
      <div className="flex gap-2">
        <select
          name="role"
          defaultValue={currentRole}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        >
          {STAFF_ROLES.map((role) => (
            <option key={role} value={role}>
              {STAFF_ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="outline">
          Appliquer
        </Button>
      </div>
    </form>
  );
}
