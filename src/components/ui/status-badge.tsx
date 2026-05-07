import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<StatusTone, string> = {
  success:
    "bg-[color:var(--brand-success)]/15 text-[color:var(--brand-success)] ring-[color:var(--brand-success)]/30",
  warning:
    "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-400",
  danger:
    "bg-red-500/15 text-red-700 ring-red-500/30 dark:text-red-400",
  info:
    "bg-[color:var(--brand-secondary)]/15 text-[color:var(--brand-secondary)] ring-[color:var(--brand-secondary)]/30",
  neutral:
    "bg-muted text-muted-foreground ring-border",
};

interface StatusBadgeProps {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
