import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Sécurité" };

export const dynamic = "force-dynamic";

function last24h() {
  return new Date(Date.now() - 24 * 3600 * 1000);
}

export default async function AdminSecurityHubPage() {
  const [
    failedLogins24h,
    recentlyConnectedUsers,
    bannedIps,
    pendingGdpr,
    activeImpersonations,
    recentAudits,
  ] = await Promise.all([
    prisma.loginAttempt.count({
      where: { success: false, createdAt: { gte: last24h() } },
    }),
    prisma.user.count({ where: { lastLoginAt: { gte: last24h() } } }),
    prisma.bannedIP.count({}),
    prisma.gdprRequest.count({ where: { status: "PENDING" } }),
    prisma.impersonationSession.count({ where: { endedAt: null } }),
    prisma.auditLog.count({ where: { createdAt: { gte: last24h() } } }),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Sécurité
        </h1>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Échecs de login (24 h)" value={failedLogins24h} href="/admin/securite/logs" />
        <KpiCard label="Comptes connectés (24 h)" value={recentlyConnectedUsers} href="/admin/securite/sessions" />
        <KpiCard label="IPs bannies" value={bannedIps} href="/admin/securite/logs" />
        <KpiCard label="Demandes RGPD en attente" value={pendingGdpr} href="/admin/securite/rgpd" />
        <KpiCard label="Impersonations en cours" value={activeImpersonations} />
        <KpiCard label="Actions admin (24 h)" value={recentAudits} href="/admin/securite/audit" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sous-modules</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <SecurityTile href="/admin/securite/audit" label="Audit log" description="Historique exhaustif des actions sensibles." />
            <SecurityTile href="/admin/securite/roles" label="Rôles" description="Modérateurs, support, finance." />
            <SecurityTile href="/admin/securite/sessions" label="Connexions" description="Activité récente et déconnexion globale par compte." />
            <SecurityTile href="/admin/securite/logs" label="Logs de connexion" description="Tentatives échouées, IPs bannies." />
            <SecurityTile href="/admin/securite/rgpd" label="RGPD" description="Demandes export/suppression." />
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function SecurityTile({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="block rounded-md border border-border p-3 hover:bg-muted/50"
      >
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </Link>
    </li>
  );
}
