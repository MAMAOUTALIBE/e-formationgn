import { AlertTriangle, ArrowRight, MessageCircle, Star } from "lucide-react";
import Link from "next/link";

import { pluralize } from "@/lib/format/labels";
import type { InstructorActionItems } from "@/server/queries/instructor";

interface InstructorActionCenterProps {
  items: InstructorActionItems;
}

/**
 * Bandeau « À traiter » : ne s'affiche que s'il y a au moins une action en
 * attente. Chaque tuile renvoie vers la page concernée.
 */
export function InstructorActionCenter({ items }: InstructorActionCenterProps) {
  const tiles = [
    {
      key: "rejected",
      count: items.rejectedCourses,
      href: "/formateur/cours",
      icon: <AlertTriangle className="h-4 w-4" aria-hidden />,
      label: (n: number) =>
        `${n} formation${n > 1 ? "s" : ""} refusée${n > 1 ? "s" : ""} à corriger`,
      tone: "danger" as const,
    },
    {
      key: "questions",
      count: items.unansweredQuestions,
      href: "/formateur/questions",
      icon: <MessageCircle className="h-4 w-4" aria-hidden />,
      label: (n: number) =>
        `${n} ${pluralize(n, "question")} sans réponse`,
      tone: "primary" as const,
    },
    {
      key: "reviews",
      count: items.reviewsToReply,
      href: "/formateur/avis",
      icon: <Star className="h-4 w-4" aria-hidden />,
      label: (n: number) => `${n} ${pluralize(n, "avis")} à répondre`,
      tone: "primary" as const,
    },
  ].filter((t) => t.count > 0);

  if (tiles.length === 0) return null;

  return (
    <section aria-label="À traiter" className="grid gap-3 sm:grid-cols-3">
      {tiles.map((tile) => (
        <Link
          key={tile.key}
          href={tile.href}
          className={
            "group flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors " +
            (tile.tone === "danger"
              ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
              : "border-border bg-card hover:bg-muted/50")
          }
        >
          <div className="flex items-center gap-3">
            <span
              className={
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full " +
                (tile.tone === "danger"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-[color:var(--brand-primary)]/10 text-[color:var(--brand-primary)]")
              }
            >
              {tile.icon}
            </span>
            <p className="text-sm font-medium text-foreground">
              {tile.label(tile.count)}
            </p>
          </div>
          <ArrowRight
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      ))}
    </section>
  );
}
