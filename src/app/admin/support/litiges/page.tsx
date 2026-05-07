import type { Metadata } from "next";

import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { updateDisputeStatus } from "@/server/actions/admin-support";
import { prisma } from "@/lib/prisma";
import type { DisputeStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Litiges" };

export const dynamic = "force-dynamic";

export default async function AdminDisputesPage() {
  const disputes = await prisma.dispute.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Litiges
        </h1>
        <p className="text-sm text-muted-foreground">
          {disputes.length} litiges. Décidez du remboursement ou de l&apos;escalade.
        </p>
      </header>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Commande</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Raison</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {disputes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Aucun litige.
                  </td>
                </tr>
              ) : (
                disputes.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">
                      {d.orderId.slice(0, 12)}…
                    </td>
                    <td className="px-4 py-3">
                      <DisputeStatusBadge status={d.status} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <p className="line-clamp-2">{d.reason}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {d.createdAt.toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form
                        action={async (formData: FormData) => {
                          "use server";
                          await updateDisputeStatus(
                            d.id,
                            formData.get("status") as DisputeStatus,
                          );
                        }}
                        className="flex justify-end gap-1"
                      >
                        <Select name="status" defaultValue={d.status}>
                          <option value="OPEN">Ouvert</option>
                          <option value="IN_REVIEW">En revue</option>
                          <option value="RESOLVED_REFUND">Résolu (remb.)</option>
                          <option value="RESOLVED_NO_REFUND">Résolu (aucun)</option>
                          <option value="ESCALATED">Escaladé</option>
                        </Select>
                        <Button type="submit" size="sm" variant="outline">
                          OK
                        </Button>
                      </form>
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

function DisputeStatusBadge({ status }: { status: DisputeStatus }) {
  if (status === "OPEN") return <StatusBadge tone="warning">Ouvert</StatusBadge>;
  if (status === "IN_REVIEW") return <StatusBadge tone="info">En revue</StatusBadge>;
  if (status === "RESOLVED_REFUND") return <StatusBadge tone="success">Remboursé</StatusBadge>;
  if (status === "RESOLVED_NO_REFUND") return <StatusBadge tone="neutral">Sans remb.</StatusBadge>;
  if (status === "ESCALATED") return <StatusBadge tone="danger">Escaladé</StatusBadge>;
  return <StatusBadge tone="neutral">{status}</StatusBadge>;
}
