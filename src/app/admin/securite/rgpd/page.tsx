import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { markGdprRequestComplete } from "@/server/actions/admin-security";
import { prisma } from "@/lib/prisma";
import type { GdprRequestStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "RGPD" };

export const dynamic = "force-dynamic";

export default async function GdprPage() {
  const requests = await prisma.gdprRequest.findMany({
    orderBy: { requestedAt: "desc" },
    take: 100,
    include: { user: { select: { email: true, name: true } } },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Demandes RGPD
        </h1>
        <p className="text-sm text-muted-foreground">
          {requests.length} demandes (export et suppression).
        </p>
      </header>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Demandé le</th>
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Aucune demande.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.requestedAt.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      {r.user.name ?? r.user.email}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={r.kind === "DELETE" ? "danger" : "info"}>
                        {r.kind}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <GdprStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status !== "COMPLETED" && r.status !== "REJECTED" ? (
                        <form
                          action={async () => {
                            "use server";
                            await markGdprRequestComplete(r.id);
                          }}
                        >
                          <Button type="submit" size="sm" variant="outline">
                            Marquer traité
                          </Button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {r.completedAt?.toLocaleDateString("fr-FR") ?? "—"}
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

function GdprStatusBadge({ status }: { status: GdprRequestStatus }) {
  if (status === "COMPLETED") return <StatusBadge tone="success">Traité</StatusBadge>;
  if (status === "IN_PROGRESS") return <StatusBadge tone="info">En cours</StatusBadge>;
  if (status === "REJECTED") return <StatusBadge tone="danger">Rejeté</StatusBadge>;
  return <StatusBadge tone="warning">En attente</StatusBadge>;
}
