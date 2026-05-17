// Bloc « Ce cours inclut » — pattern Udemy, affiché dans la card prix.
// Liste les valeurs-ajoutées du cours en pictogrammes + courte mention.
// Convertit la durée totale et le compte de leçons en libellés lisibles.

import {
  Award,
  Download,
  Infinity as InfinityIcon,
  Layers,
  PlayCircle,
  Smartphone,
} from "lucide-react";

import { formatDurationFromSeconds } from "@/lib/format/duration";
import { pluralize } from "@/lib/format/labels";

interface CourseIncludesProps {
  durationSeconds: number;
  lessonCount: number;
  resourceCount: number;
}

export function CourseIncludes({
  durationSeconds,
  lessonCount,
  resourceCount,
}: CourseIncludesProps) {
  const items: Array<{ icon: React.ComponentType<{ className?: string }>; label: string }> = [
    {
      icon: PlayCircle,
      label: `${formatDurationFromSeconds(durationSeconds)} de vidéo à la demande`,
    },
    {
      icon: Layers,
      label: `${lessonCount} ${pluralize(lessonCount, "leçon", "leçons")}`,
    },
  ];

  if (resourceCount > 0) {
    items.push({
      icon: Download,
      label: `${resourceCount} ${pluralize(resourceCount, "ressource téléchargeable", "ressources téléchargeables")}`,
    });
  }

  items.push(
    { icon: Smartphone, label: "Accès sur mobile et ordinateur" },
    { icon: InfinityIcon, label: "Accès à vie au contenu" },
    { icon: Award, label: "Certificat de fin de cours" },
  );

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Ce cours inclut
      </p>
      <ul className="space-y-2 text-sm text-foreground">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <li key={index} className="flex items-start gap-2.5">
              <Icon
                className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span>{item.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
