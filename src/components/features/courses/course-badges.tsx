// Badges marketing affichés au-dessus du titre du cours (Bestseller, Top
// noté, Nouveau). Couleurs inspirées Udemy : jaune-orangé pour Bestseller,
// vert pour Top noté, bleu accent pour Nouveau.

import { Award, Sparkles, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CourseBadge } from "@/lib/courses/badges";

interface CourseBadgesProps {
  badges: CourseBadge[];
  className?: string;
}

const VARIANT_CLASS: Record<CourseBadge["variant"], string> = {
  warning:
    "bg-[color:var(--brand-warning)]/15 text-[color:var(--brand-warning)] ring-1 ring-[color:var(--brand-warning)]/30",
  success:
    "bg-[color:var(--brand-success)]/15 text-[color:var(--brand-success)] ring-1 ring-[color:var(--brand-success)]/30",
  info:
    "bg-[color:var(--brand-accent)]/15 text-[color:var(--brand-accent)] ring-1 ring-[color:var(--brand-accent)]/30",
};

const ICON: Record<CourseBadge["kind"], React.ComponentType<{ className?: string }>> = {
  bestseller: TrendingUp,
  "top-rated": Award,
  new: Sparkles,
};

export function CourseBadges({ badges, className }: CourseBadgesProps) {
  if (badges.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {badges.map((badge) => {
        const Icon = ICON[badge.kind];
        return (
          <span
            key={badge.kind}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide",
              VARIANT_CLASS[badge.variant],
            )}
          >
            <Icon className="h-3 w-3" aria-hidden />
            {badge.label}
          </span>
        );
      })}
    </div>
  );
}
