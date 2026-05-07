import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { unbanIp } from "@/server/actions/admin-security";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Logs de connexion" };

export const dynamic = "force-dynamic";

function last24h() {
  return new Date(Date.now() - 24 * 3600 * 1000);
}

export default async function LoginLogsPage() {
  const [attempts, banned, suspiciousIps] = await Promise.all([
    prisma.loginAttempt.findMany({
      where: { createdAt: { gte: last24h() } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.bannedIP.findMany({
      orderBy: { createdAt: "desc" },
      include: { bannedBy: { select: { email: true } } },
    }),
    prisma.loginAttempt.groupBy({
      by: ["ipHash"],
      where: { success: false, createdAt: { gte: last24h() } },
      _count: { _all: true },
      having: { ipHash: { _count: { gt: 5 } } },
      orderBy: { _count: { ipHash: "desc" } },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Logs de connexion
        </h1>
      </header>

      {suspiciousIps.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-amber-700 dark:text-amber-300">
              IPs suspectes (24 h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {suspiciousIps.map((ip) => (
                <li
                  key={ip.ipHash}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <span className="font-mono text-xs">{ip.ipHash}</span>
                  <span className="text-xs text-muted-foreground">
                    {ip._count._all} échecs
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">IPs bannies ({banned.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {banned.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune IP bannie.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {banned.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div>
                    <p className="font-mono text-xs">{b.ipHash}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.reason ?? "—"} · par {b.bannedBy.email} ·{" "}
                      {b.createdAt.toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await unbanIp(b.ipHash);
                    }}
                  >
                    <Button type="submit" size="sm" variant="outline">
                      Débannir
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tentatives récentes (24 h)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">IP (hash)</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {attempts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    Aucune tentative loggée.
                  </td>
                </tr>
              ) : (
                attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {a.createdAt.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">{a.email}</td>
                    <td className="px-4 py-3 font-mono text-xs">{a.ipHash}</td>
                    <td className="px-4 py-3">
                      {a.success ? (
                        <StatusBadge tone="success">OK</StatusBadge>
                      ) : (
                        <StatusBadge tone="danger">Échec</StatusBadge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
