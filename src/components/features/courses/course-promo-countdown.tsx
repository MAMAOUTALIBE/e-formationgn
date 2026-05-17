"use client";

// Compte à rebours sur une promotion qui se termine à une date donnée.
// Affiché juste au-dessus du prix dans la card sticky : « Plus que 4h 23min
// à ce prix ! » — pattern Udemy pour créer un sentiment d'urgence légitime
// (la promo se termine réellement à `discountEndsAt`).
//
// Client component car re-render chaque seconde tant qu'il reste < 24h.
// Au-dessus de 24h on n'actualise qu'à l'heure pour éviter le rerender
// inutile et économiser CPU/batterie sur mobile.

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface CoursePromoCountdownProps {
  /** Date ISO de fin de la promotion (envoyée par le serveur). */
  endsAt: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

function computeTimeLeft(targetMs: number): TimeLeft {
  const diff = Math.max(0, targetMs - Date.now());
  return {
    totalMs: diff,
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function CoursePromoCountdown({ endsAt }: CoursePromoCountdownProps) {
  const targetMs = new Date(endsAt).getTime();
  const [left, setLeft] = useState<TimeLeft>(() => computeTimeLeft(targetMs));

  useEffect(() => {
    if (Number.isNaN(targetMs)) return;
    // Sous les 24h on tick chaque seconde (urgence visible) ; au-delà,
    // chaque minute suffit (la valeur ne change qu'à l'heure de toute façon).
    const intervalMs = left.totalMs < 24 * 3600 * 1000 ? 1000 : 60_000;
    const id = window.setInterval(() => {
      setLeft(computeTimeLeft(targetMs));
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [targetMs, left.totalMs]);

  if (Number.isNaN(targetMs) || left.totalMs <= 0) return null;

  const label = formatTimeLeft(left);

  return (
    <div
      role="timer"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-warning)]/15 px-2.5 py-1 text-xs font-semibold text-[color:var(--brand-warning)] ring-1 ring-[color:var(--brand-warning)]/30"
    >
      <Clock className="h-3.5 w-3.5" aria-hidden />
      Plus que {label} à ce prix
    </div>
  );
}

function formatTimeLeft(left: TimeLeft): string {
  if (left.days >= 2) return `${left.days} jours`;
  if (left.days === 1) return `1 jour ${left.hours} h`;
  if (left.hours >= 1) return `${left.hours} h ${pad(left.minutes)} min`;
  if (left.minutes >= 1) return `${left.minutes} min ${pad(left.seconds)} s`;
  return `${left.seconds} s`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
