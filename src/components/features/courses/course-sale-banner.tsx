"use client";

// Bandeau d'urgence "Promo en cours — se termine dans X" — pattern Udemy.
// Countdown live qui se met à jour chaque seconde. Affiché en haut du
// catalogue quand au moins N cours sont en solde (cf. getActiveSale).
//
// Le composant se masque automatiquement quand la deadline est passée
// (sans reload), pour éviter d'afficher "Reste 0s" indéfiniment.

import { Flame } from "lucide-react";
import * as React from "react";

interface CourseSaleBannerProps {
  /** Date ISO 8601 de fin de promo (sérialisable depuis le server component). */
  endsAt: string;
  coursesCount: number;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "terminée";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}j ${hours}h ${minutes}min`;
  if (hours > 0) return `${hours}h ${minutes}min ${seconds}s`;
  if (minutes > 0) return `${minutes}min ${seconds}s`;
  return `${seconds}s`;
}

export function CourseSaleBanner({ endsAt, coursesCount }: CourseSaleBannerProps) {
  const endsAtTs = React.useMemo(() => new Date(endsAt).getTime(), [endsAt]);

  // `null` jusqu'au montage, volontairement.
  //
  // Le décompte partait de `Date.now()` dès le premier rendu : le serveur
  // calculait « 3j 4h 12min », le navigateur recalculait quelques secondes
  // plus tard, et React refusait l'hydratation (erreur #418 en production).
  // Le temps restant n'a de sens que côté client — on ne l'affiche donc qu'une
  // fois monté, ce qui rend les deux rendus identiques.
  const [remaining, setRemaining] = React.useState<number | null>(null);

  React.useEffect(() => {
    const tick = () => setRemaining(endsAtTs - Date.now());
    tick();
    // Tick chaque seconde. Léger : un seul interval, pas de re-render des cards.
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAtTs]);

  if (remaining === null || remaining <= 0) return null;

  return (
    <aside
      role="status"
      aria-label="Promotion en cours"
      className="flex flex-wrap items-center justify-center gap-3 rounded-lg border border-[color:var(--brand-warning)]/30 bg-[color:var(--brand-warning)]/10 px-4 py-3 text-sm text-foreground"
    >
      <Flame
        className="h-5 w-5 shrink-0 text-[color:var(--brand-warning)]"
        aria-hidden
      />
      <p>
        <strong>Soldes en cours</strong> sur{" "}
        <span className="font-semibold">{coursesCount}</span> formations — se termine
        dans{" "}
        <span className="font-bold tabular-nums text-[color:var(--brand-warning)]">
          {formatRemaining(remaining)}
        </span>
      </p>
    </aside>
  );
}
