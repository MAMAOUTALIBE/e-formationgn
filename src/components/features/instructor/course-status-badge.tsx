import type { CourseStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";

interface CourseStatusBadgeProps {
  status: CourseStatus;
}

const VARIANTS: Record<
  CourseStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "success" | "accent"; className?: string }
> = {
  DRAFT: { label: "Brouillon", variant: "secondary" },
  PENDING_REVIEW: { label: "En attente", variant: "accent" },
  PUBLISHED: { label: "Publié", variant: "success" },
  REJECTED: { label: "Refusé", variant: "outline", className: "border-destructive text-destructive" },
  ARCHIVED: { label: "Archivé", variant: "outline" },
};

export function CourseStatusBadge({ status }: CourseStatusBadgeProps) {
  const config = VARIANTS[status];
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
