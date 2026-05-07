import type { Metadata } from "next";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { exportAuditLogCsv } from "@/server/actions/admin-security";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Audit log" };

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ action?: string; targetType?: string; q?: string; page?: string }>;
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, params.page ? Number(params.page) : 1);
  const pageSize = 100;

  const where = {
    ...(params.action ? { action: { contains: params.action } } : {}),
    ...(params.targetType ? { targetType: params.targetType } : {}),
    ...(params.q
      ? {
          OR: [
            { actor: { email: { contains: params.q, mode: "insensitive" as const } } },
            { targetId: { contains: params.q } },
          ],
        }
      : {}),
  };
  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Audit log
          </h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString("fr-FR")} entrées · page {page}/{totalPages}
          </p>
        </div>
        <ExportButton action={exportAuditLogCsv} />
      </header>

      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 sm:grid-cols-4">
            <Input name="q" placeholder="Email acteur ou ID cible" defaultValue={params.q ?? ""} className="sm:col-span-2" />
            <Input name="action" placeholder="course.approve, user.suspend…" defaultValue={params.action ?? ""} />
            <Button type="submit">Filtrer</Button>
          </form>
        </CardContent>
      </Card>

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
                    Aucune entrée.
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
