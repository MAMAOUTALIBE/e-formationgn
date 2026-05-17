// Badge « Garantie 30 jours satisfait ou remboursé » — trust signal majeur
// sur le premier achat. À afficher juste sous le CTA principal de la card prix.

import { ShieldCheck } from "lucide-react";

interface CourseMoneyBackProps {
  /** Personnalisable si la politique change (ex: 14 jours en B2B). */
  days?: number;
  className?: string;
}

export function CourseMoneyBack({ days = 30, className }: CourseMoneyBackProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md bg-[color:var(--brand-success)]/10 px-3 py-2 text-xs font-medium text-[color:var(--brand-success)] ring-1 ring-[color:var(--brand-success)]/30 ${className ?? ""}`}
      role="note"
    >
      <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        <strong className="font-semibold">{days} jours</strong> satisfait ou remboursé
      </span>
    </div>
  );
}
