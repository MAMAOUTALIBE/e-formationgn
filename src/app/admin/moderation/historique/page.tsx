import type { Metadata } from "next";

import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Historique de modération" };

export const dynamic = "force-dynamic";

export default async function ModerationHistoryPage() {
  // On filtre les actions liées à la modération depuis AuditLog.
  const entries = await prisma.auditLog.findMany({
    where: {
      OR: [
        { action: { startsWith: "course.approve" } },
        { action: { startsWith: "course.reject" } },
        { action: { startsWith: "report." } },
        { action: { startsWith: "moderation-rule." } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { name: true, email: true } } },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Historique de modération
        </h1>
        <p className="text-sm text-muted-foreground">
          {entries.length} actions de modération récentes (issues de l&apos;audit log).
        </p>
      </header>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Acteur</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Cible</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    Aucune action récente.
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {e.createdAt.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      {e.actor?.name ?? e.actor?.email ?? "système"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{e.action}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {e.targetType ?? ""}
                      {e.targetId ? ` ${e.targetId.slice(0, 12)}…` : ""}
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
