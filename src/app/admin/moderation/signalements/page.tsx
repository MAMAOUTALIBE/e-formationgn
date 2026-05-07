import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { resolveReport } from "@/server/actions/admin-moderation";
import { prisma } from "@/lib/prisma";
import type { ReportStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Signalements" };

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ status?: ReportStatus }>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const reports = await prisma.report.findMany({
    where: params.status ? { status: params.status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { reporter: { select: { name: true, email: true } } },
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Signalements
          </h1>
          <p className="text-sm text-muted-foreground">
            {reports.length} signalements affichés.
          </p>
        </div>
        <form className="flex gap-2">
          <Select name="status" defaultValue={params.status ?? ""}>
            <option value="">Tous statuts</option>
            <option value="PENDING">En attente</option>
            <option value="REVIEWING">En revue</option>
            <option value="RESOLVED_HIDDEN">Masqué</option>
            <option value="RESOLVED_DELETED">Supprimé</option>
            <option value="DISMISSED">Rejeté</option>
          </Select>
          <Button type="submit" size="sm">Filtrer</Button>
        </form>
      </header>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Cible</th>
                <th className="px-4 py-3">Raison</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Aucun signalement.
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.targetType}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {r.targetId.slice(0, 12)}…
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm">{r.reason}</p>
                      {r.description ? (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {r.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <ReportStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.createdAt.toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "PENDING" || r.status === "REVIEWING" ? (
                        <form
                          action={async (formData: FormData) => {
                            "use server";
                            await resolveReport(
                              r.id,
                              formData.get("resolution") as ReportStatus,
                              String(formData.get("notes") ?? "") || undefined,
                            );
                          }}
                          className="flex justify-end gap-1"
                        >
                          <Select name="resolution" defaultValue="DISMISSED">
                            <option value="DISMISSED">Rejeter</option>
                            <option value="RESOLVED_HIDDEN">Masquer</option>
                            <option value="RESOLVED_DELETED">Supprimer</option>
                          </Select>
                          <Button type="submit" size="sm" variant="outline">
                            OK
                          </Button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {r.resolvedAt?.toLocaleDateString("fr-FR")}
                        </span>
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

function ReportStatusBadge({ status }: { status: ReportStatus }) {
  if (status === "PENDING") return <StatusBadge tone="warning">En attente</StatusBadge>;
  if (status === "REVIEWING") return <StatusBadge tone="info">En revue</StatusBadge>;
  if (status === "RESOLVED_HIDDEN") return <StatusBadge tone="neutral">Masqué</StatusBadge>;
  if (status === "RESOLVED_DELETED") return <StatusBadge tone="danger">Supprimé</StatusBadge>;
  if (status === "DISMISSED") return <StatusBadge tone="neutral">Rejeté</StatusBadge>;
  return <StatusBadge tone="neutral">{status}</StatusBadge>;
}
