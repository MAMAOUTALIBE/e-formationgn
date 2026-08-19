import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Building2, GraduationCap, Users } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Tableau de bord — Administration" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [companies, learners, courses, enrollments] = await Promise.all([
    prisma.company.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
    prisma.course.count({ where: { status: "PUBLISHED" } }),
    prisma.enrollment.count(),
  ]);
  const links = [
    [
      "Gérer les programmes",
      "/admin/formations",
      "Programmes, sessions et inscriptions",
    ],
    [
      "Suivre les apprenants",
      "/admin/utilisateurs",
      "Accès, progression et certificats",
    ],
    [
      "Analyser l'apprentissage",
      "/admin/analytics/apprentissage",
      "Activité et complétion des formations",
    ],
  ];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Pilotage pédagogique
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d&apos;ensemble des sociétés, apprenants, formations et inscriptions.
        </p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Sociétés actives"
          value={companies}
          icon={<Building2 className="h-5 w-5" />}
          tone="blue"
          href="/admin/societes"
          appearance="crm"
        />
        <KpiCard
          label="Apprenants actifs"
          value={learners}
          icon={<Users className="h-5 w-5" />}
          tone="emerald"
          href="/admin/utilisateurs"
          appearance="crm"
        />
        <KpiCard
          label="Formations publiées"
          value={courses}
          icon={<BookOpen className="h-5 w-5" />}
          tone="amber"
          href="/admin/cours"
          appearance="crm"
        />
        <KpiCard
          label="Inscriptions actives"
          value={enrollments}
          icon={<GraduationCap className="h-5 w-5" />}
          tone="sky"
          href="/admin/analytics/apprentissage"
          appearance="crm"
        />
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {links.map(([label, href, description]) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/40"
          >
            <h2 className="font-semibold">{label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
