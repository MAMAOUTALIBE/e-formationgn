// Bloc « À traiter maintenant » du tableau de bord.
//
// Composant serveur : il n'affiche que des liens, aucune interactivité ne
// justifie de le passer côté client.

import Link from "next/link";
import { ArrowRight, Clock3, Zap } from "lucide-react";

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
      className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-[0_8px_28px_rgba(15,23,42,0.05)]"
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-sky-500/70 via-blue-400/20 to-transparent" />
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-blue-100 text-sky-700 shadow-sm ring-1 ring-inset ring-white/60 dark:from-sky-400/15 dark:to-blue-400/10 dark:text-sky-300"
          >
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <h2 id="action-queue-heading" className="text-base font-semibold text-foreground">
              À traiter maintenant
            </h2>
            <p className="text-sm text-muted-foreground">
              Les prochaines actions, classées par niveau d&apos;urgence.
            </p>
          </div>
        </div>

        {remaining > 0 ? (
          <span className="rounded-full border border-border bg-muted/70 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            +{remaining} en attente
          </span>
        ) : null}
      </header>

      {queue.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          Rien à traiter — aucune demande en attente.
        </p>
      ) : (
        <ul className="grid gap-2">
          {queue.items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  "group flex h-full items-start gap-3 rounded-xl border px-3 py-3 transition duration-200 hover:-translate-y-px hover:bg-muted/50 hover:shadow-sm",
                  item.overdue
                    ? "border-[color:var(--brand-warning)]/40 bg-[color:var(--brand-warning)]/5"
                    : "border-border",
                )}
              >
                <span aria-hidden className={cn("mt-1 h-8 w-1 shrink-0 rounded-full", DOT_CLASS[item.kind])} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {item.title}
                  </span>
                  <span className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Clock3 className="h-3 w-3 shrink-0" aria-hidden />
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
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden />
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
