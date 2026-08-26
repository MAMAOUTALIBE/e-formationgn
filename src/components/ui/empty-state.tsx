import { cn } from "@/lib/utils";

/**
 * Registre visuel de l'état vide.
 *
 * `neutral` est le rendu historique, volontairement discret : dans un écran
 * d'administration, une liste vide est une information, pas un évènement.
 * `brand` s'adresse à l'apprenant, pour qui la même liste vide est le premier
 * écran de son parcours — elle doit inviter plutôt que constater.
 */
type EmptyStateTone = "neutral" | "brand";

interface EmptyStateProps {
  /** Icône Lucide affichée dans une pastille — passe-toi le component pré-rendu. */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** Bouton CTA (généralement un Link wrappé dans Button asChild). */
  action?: React.ReactNode;
  tone?: EmptyStateTone;
  className?: string;
}

const TONE = {
  neutral: {
    container: "rounded-lg border-dashed border-border bg-muted/20 p-10",
    icon: "mb-4 h-12 w-12 bg-[color:var(--brand-primary)]/10 text-[color:var(--brand-primary)]",
    title: "text-sm font-medium",
    description: "mt-1",
    action: "mt-4",
  },
  brand: {
    container:
      "rounded-2xl border-[color:var(--brand-secondary)]/20 bg-gradient-to-br from-[color:var(--brand-primary)]/6 via-card to-[color:var(--brand-accent)]/10 p-8 shadow-sm sm:p-12",
    icon: "mb-5 h-16 w-16 bg-[color:var(--brand-secondary)]/12 text-[color:var(--brand-secondary)] ring-8 ring-[color:var(--brand-secondary)]/5 dark:text-blue-300 [&_svg]:h-7 [&_svg]:w-7",
    title: "text-base font-semibold sm:text-lg",
    description: "mt-1.5",
    action: "mt-6",
  },
} satisfies Record<EmptyStateTone, Record<string, string>>;

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "neutral",
  className,
}: EmptyStateProps) {
  const styles = TONE[tone];
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center border text-center",
        styles.container,
        className,
      )}
    >
      {icon ? (
        <div className={cn("inline-flex items-center justify-center rounded-full", styles.icon)}>
          {icon}
        </div>
      ) : null}
      <p className={cn("text-foreground", styles.title)}>{title}</p>
      {description ? (
        <p className={cn("max-w-md text-sm text-muted-foreground", styles.description)}>
          {description}
        </p>
      ) : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
