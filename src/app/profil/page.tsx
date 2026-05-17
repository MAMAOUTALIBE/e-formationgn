import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Award,
  Clock,
  GraduationCap,
  KeyRound,
  Settings2,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";

import { auth } from "@/auth";
import { AvatarUploader } from "@/components/features/auth/avatar-uploader";
import { ProfileForm } from "@/components/features/auth/profile-form";
import { CurrencyToggle } from "@/components/features/preferences/currency-toggle";
import { LocaleToggle } from "@/components/features/i18n/locale-toggle";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { formatDurationFromSeconds } from "@/lib/format/duration";
import { getDictionary } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Mon profil",
};

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  STUDENT: "Élève",
  INSTRUCTOR: "Formateur",
  ADMIN: "Administrateur",
  MODERATOR: "Modérateur",
  SUPPORT: "Support",
  FINANCE: "Finance",
};

const fullDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion?callbackUrl=/profil");
  }

  const userId = session.user.id;
  const { locale } = await getDictionary();

  // Toutes les queries en parallèle — stats personnelles + sessions
  // actives + dernière connexion.
  const [
    user,
    enrollmentStats,
    watchedAgg,
    certificatesCount,
    activeSessionsCount,
    completedCoursesCount,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.enrollment.aggregate({
      where: { userId },
      _count: { _all: true },
      _avg: { progressPercent: true },
    }),
    prisma.lessonProgress.aggregate({
      where: { userId },
      _sum: { watchedSeconds: true },
    }),
    prisma.certificate.count({ where: { userId } }),
    prisma.session.count({ where: { userId } }),
    prisma.enrollment.count({
      where: { userId, completedAt: { not: null } },
    }),
  ]);

  if (!user) {
    redirect("/connexion");
  }

  const initials =
    `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.trim() ||
    user.email[0].toUpperCase();

  const watchedSeconds = watchedAgg._sum.watchedSeconds ?? 0;
  const enrollmentsCount = enrollmentStats._count._all;
  const avgProgress = Math.round(enrollmentStats._avg.progressPercent ?? 0);

  return (
    <>
      <SiteHeader />

      <main className="flex-1 bg-muted/20 py-8">
        <Container className="space-y-6">
          <Breadcrumbs
            items={[{ label: "Accueil", href: "/" }, { label: "Mon profil" }]}
          />

          {/* En-tête : avatar + nom + rôle + dates */}
          <div className="flex flex-col items-start gap-4 rounded-lg border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar
                src={user.image}
                alt={user.name ?? user.email}
                fallback={initials}
                size={64}
              />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {user.name ?? user.email}
                </h1>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Inscrit le {fullDateFormatter.format(user.createdAt)}
                  {user.lastLoginAt
                    ? ` · dernière connexion ${fullDateFormatter.format(user.lastLoginAt)}`
                    : ""}
                </p>
              </div>
            </div>
            <Badge variant="secondary">{ROLE_LABELS[user.role] ?? user.role}</Badge>
          </div>

          {/* Stats personnelles — vue d'ensemble immédiate de l'activité */}
          <section
            aria-labelledby="stats-heading"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <h2 id="stats-heading" className="sr-only">
              Mes statistiques
            </h2>
            <StatCard
              icon={<GraduationCap className="h-4 w-4" aria-hidden />}
              label="Cours suivis"
              value={enrollmentsCount.toLocaleString("fr-FR")}
              hint={`${avgProgress} % de progression moyenne`}
            />
            <StatCard
              icon={<Award className="h-4 w-4" aria-hidden />}
              label="Cours terminés"
              value={completedCoursesCount.toLocaleString("fr-FR")}
              hint={`${certificatesCount} certificat${certificatesCount > 1 ? "s" : ""}`}
            />
            <StatCard
              icon={<Clock className="h-4 w-4" aria-hidden />}
              label="Temps d'apprentissage"
              value={formatDurationFromSeconds(watchedSeconds)}
              hint="Cumul depuis l'inscription"
            />
            <StatCard
              icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
              label="Sessions actives"
              value={activeSessionsCount.toLocaleString("fr-FR")}
              hint={user.emailVerified ? "Email vérifié ✓" : "Email non vérifié"}
            />
          </section>

          {/* Avatar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Photo de profil</CardTitle>
              <CardDescription>
                Visible sur votre page publique de formateur, dans les avis que
                vous laissez et sur vos certificats.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AvatarUploader
                currentUrl={user.image}
                userName={user.name ?? user.email}
                initials={initials}
              />
            </CardContent>
          </Card>

          {/* Informations personnelles */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
                <CardTitle className="text-base">Informations personnelles</CardTitle>
              </div>
              <CardDescription>
                Ces informations apparaissent sur votre page publique de formateur
                (le cas échéant) et dans les certificats que vous obtenez.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm
                defaultValues={{
                  firstName: user.firstName ?? "",
                  lastName: user.lastName ?? "",
                  headline: user.headline ?? "",
                  bio: user.bio ?? "",
                  websiteUrl: user.websiteUrl ?? "",
                  linkedinUrl: user.linkedinUrl ?? "",
                  twitterUrl: user.twitterUrl ?? "",
                  youtubeUrl: user.youtubeUrl ?? "",
                }}
              />
            </CardContent>
          </Card>

          {/* Préférences */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" aria-hidden />
                <CardTitle className="text-base">Préférences</CardTitle>
              </div>
              <CardDescription>
                Langue d&apos;interface et devise des prix affichés.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Langue</p>
                  <p className="text-xs text-muted-foreground">
                    Langue de l&apos;interface, des emails et du support.
                  </p>
                </div>
                <LocaleToggle current={locale} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Devise</p>
                  <p className="text-xs text-muted-foreground">
                    Devise utilisée pour afficher les prix sur le site et au panier.
                  </p>
                </div>
                <CurrencyToggle current={user.preferredCurrency} />
              </div>
            </CardContent>
          </Card>

          {/* Sécurité */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden />
                <CardTitle className="text-base">Sécurité</CardTitle>
              </div>
              <CardDescription>
                Gérez votre mot de passe et la sécurité de vos sessions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Mot de passe</p>
                  <p className="text-xs text-muted-foreground">
                    {user.passwordChangedAt
                      ? `Modifié le ${fullDateFormatter.format(user.passwordChangedAt)}`
                      : "Aucune modification récente"}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/mot-de-passe-oublie?email=${encodeURIComponent(user.email)}`}>
                    Réinitialiser
                  </Link>
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Adresse email</p>
                  <p className="text-xs text-muted-foreground">
                    {user.emailVerified
                      ? `Vérifiée le ${fullDateFormatter.format(user.emailVerified)}`
                      : "Non vérifiée — vérifiez vos emails pour activer toutes les fonctionnalités."}
                  </p>
                </div>
                {!user.emailVerified ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/verifier-email">Renvoyer l&apos;email</Link>
                  </Button>
                ) : null}
              </div>
              <div className="rounded-md border border-[color:var(--brand-warning)]/30 bg-[color:var(--brand-warning)]/5 p-3">
                <p className="text-xs text-foreground">
                  <strong>Sessions actives :</strong> {activeSessionsCount}. Une
                  réinitialisation de mot de passe déconnecte toutes vos sessions.
                </p>
              </div>
            </CardContent>
          </Card>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}

function StatCard({ icon, label, value, hint }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className="mt-2 text-2xl font-semibold text-foreground tabular-nums">
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
