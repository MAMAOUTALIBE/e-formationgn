import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { refundOrder } from "@/server/actions/admin-finances";
import { getAdminOrderDetail } from "@/server/queries/admin-finances";

export const metadata: Metadata = { title: "Commande" };

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const order = await getAdminOrderDetail(id);
  if (!order) notFound();

  const refundedTotal = order.refunds.reduce((sum, r) => sum + r.amountCents, 0);
  const refundable = Math.max(0, order.totalCents - refundedTotal);

  return (
    <div className="space-y-5">
      <Link
        href="/admin/finances/transactions"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Retour
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Commande {order.id.slice(0, 12)}…
          </h1>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/admin/utilisateurs/${order.user.id}`}
              className="hover:underline"
            >
              {order.user.name ?? order.user.email}
            </Link>
            {" · "}
            {order.createdAt.toLocaleString("fr-FR")}
          </p>
        </div>
        <StatusBadge tone={order.status === "PAID" ? "success" : "warning"}>
          {order.status}
        </StatusBadge>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">
              {(order.totalCents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}{" "}
              {order.currency}
            </p>
            <p className="text-xs text-muted-foreground">
              Sous-total : {(order.subtotalCents / 100).toFixed(2)} ·
              Remise : {(order.discountCents / 100).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stripe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">PI : </span>
              <span className="font-mono text-xs">{order.stripePaymentIntentId ?? "—"}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Session : </span>
              <span className="font-mono text-xs">
                {order.stripeCheckoutSessionId ?? "—"}
              </span>
            </p>
            {order.stripeReceiptUrl ? (
              <Link
                href={order.stripeReceiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[color:var(--brand-secondary)] hover:underline"
              >
                Voir le reçu Stripe ↗
              </Link>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Promo</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {order.promoCode ? (
              <p>
                Code : <code className="font-mono">{order.promoCode.code}</code>
              </p>
            ) : (
              <p className="text-muted-foreground">Aucun code promo.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Articles ({order.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border text-sm">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="font-medium">{it.course.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Commission {it.commissionRateBps / 100} % · Plateforme{" "}
                    {(it.platformFeeCents / 100).toFixed(2)} · Formateur{" "}
                    {(it.instructorPayoutCents / 100).toFixed(2)}
                  </p>
                </div>
                <span className="text-sm font-medium">
                  {(it.totalCents / 100).toFixed(2)} {it.currency}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {order.refunds.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Remboursements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {order.refunds.map((r) => (
                <li key={r.id} className="flex justify-between gap-2 py-2">
                  <span>
                    {r.createdAt.toLocaleString("fr-FR")} ·{" "}
                    <span className="font-mono text-xs">
                      {r.stripeRefundId ?? "—"}
                    </span>
                  </span>
                  <span className="font-medium">
                    {(r.amountCents / 100).toFixed(2)} {order.currency}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {refundable > 0 && order.status === "PAID" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rembourser</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={async (formData: FormData) => {
                "use server";
                const amount = Math.round(
                  Number(formData.get("amount") ?? 0) * 100,
                );
                const reason = String(formData.get("reason") ?? "");
                await refundOrder(order.id, amount, reason);
              }}
              className="flex flex-wrap items-end gap-3"
            >
              <div>
                <label className="block text-xs text-muted-foreground">
                  Montant ({order.currency})
                </label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  min="0.01"
                  max={(refundable / 100).toFixed(2)}
                  defaultValue={(refundable / 100).toFixed(2)}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Maximum : {(refundable / 100).toFixed(2)}
                </p>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs text-muted-foreground">Raison</label>
                <input
                  type="text"
                  name="reason"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <Button type="submit" variant="outline">
                Rembourser via Stripe
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
