import { Eye, GraduationCap, Users } from "lucide-react";

import type { CourseFunnel as CourseFunnelData } from "@/server/queries/instructor";

interface CourseFunnelProps {
  funnel: CourseFunnelData;
}

/**
 * Entonnoir de conversion d'un cours : Vues de la fiche → Inscriptions →
 * Cours terminés, avec le taux de conversion entre chaque étape.
 */
export function CourseFunnel({ funnel }: CourseFunnelProps) {
  const { views, enrollments, completions } = funnel;
  const max = Math.max(1, views, enrollments, completions);

  const stages = [
    {
      key: "views",
      label: "Vues de la fiche",
      value: views,
      icon: <Eye className="h-4 w-4" aria-hidden />,
      conv: null as string | null,
    },
    {
      key: "enrollments",
      label: "Inscriptions",
      value: enrollments,
      icon: <Users className="h-4 w-4" aria-hidden />,
      conv: views > 0 ? `${Math.round((enrollments / views) * 100)}%` : null,
    },
    {
      key: "completions",
      label: "Cours terminés",
      value: completions,
      icon: <GraduationCap className="h-4 w-4" aria-hidden />,
      conv:
        enrollments > 0
          ? `${Math.round((completions / enrollments) * 100)}%`
          : null,
    },
  ];

  return (
    <ul className="space-y-3">
      {stages.map((stage) => (
        <li key={stage.key} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <span className="text-muted-foreground">{stage.icon}</span>
              {stage.label}
            </span>
            <span className="flex items-center gap-2">
              {stage.conv ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {stage.conv} de l&apos;étape précédente
                </span>
              ) : null}
              <span className="font-semibold tabular-nums text-foreground">
                {stage.value.toLocaleString("fr-FR")}
              </span>
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[color:var(--brand-primary)]"
              style={{ width: `${Math.round((stage.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
