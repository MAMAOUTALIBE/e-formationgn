// Bloc « À traiter maintenant » du tableau de bord.
//
// Composant serveur : il n'affiche que des liens, aucune interactivité ne
// justifie de le passer côté client.

import Link from "next/link";
import { Zap } from "lucide-react";

import type { AdminActionQueue, ActionQueueKind } from "@/server/queries/admin-action-queue";
import { cn } from "@/lib/utils";

/** Couleur de la pastille de gauche — reprend le rang de priorité. */
const DOT_CLASS: Record<ActionQueueKind, string> = {
  dispute: "bg-red-500",
  gdpr: "bg-orange-500",
  ticket: "bg-amber-500",
  report: "bg-sky-500",
  course: "bg-blue-500",
  payout: "bg-emerald-500",
};

export function AdminActionQueueCard({ queue }: { queue: AdminActionQueue }) {
  const remaining = queue.totalCount - queue.items.length;

  return (
    <section
      aria-labelledby="action-queue-heading"
      className="rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300"
          >
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <h2 id="action-queue-heading" className="text-base font-semibold text-foreground">
              À traiter maintenant
            </h2>
            <p className="text-sm text-muted-foreground">
              File priorisée : litiges et demandes RGPD d&apos;abord, puis
              support, signalements, modération et versements.
            </p>
          </div>
        </div>

        {remaining > 0 ? (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            +{remaining} en attente
          </span>
        ) : null}
      </header>

      {queue.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          Rien à traiter — aucune demande en attente.
        </p>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {queue.items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  "flex h-full items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50",
                  item.overdue
                    ? "border-[color:var(--brand-warning)]/40 bg-[color:var(--brand-warning)]/5"
                    : "border-border",
                )}
              >
                <span
                  aria-hidden
                  className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", DOT_CLASS[item.kind])}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {item.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.kindLabel}
                    {item.overdue ? (
                      <span className="font-semibold text-[color:var(--brand-warning)]">
                        {" "}
                        · en retard
                      </span>
                    ) : null}
                    {" · "}
                    {formatAge(item.createdAt)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatAge(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 60) return `il y a ${Math.max(minutes, 1)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}
