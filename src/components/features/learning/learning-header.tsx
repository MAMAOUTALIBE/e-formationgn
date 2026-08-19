// Header dédié au mode apprentissage — remplace `SiteHeader` sur les pages
// `/apprentissage/[slug]/lecons/[lessonId]` pour libérer de l'espace au
// player vidéo et signaler visuellement qu'on est en mode focus.
//
// Inspiré de la barre de cours Udemy : logo + titre cours (compact, tronqué)
// + barre de progression globale + bouton pour quitter.

import Link from "next/link";
import { X } from "lucide-react";

import { Logo } from "@/components/branding/logo";

interface LearningHeaderProps {
  courseSlug: string;
  courseTitle: string;
  /** 0–100 — barre de progression visuelle. */
  progressPercent: number;
  /** Slot à droite du bouton ✕ — typiquement <FocusModeToggle />. */
  rightSlot?: React.ReactNode;
}

export function LearningHeader({
  courseSlug,
  courseTitle,
  progressPercent,
  rightSlot,
}: LearningHeaderProps) {
  const clampedPercent = Math.max(0, Math.min(100, Math.round(progressPercent)));
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="Retour à l'accueil Aiduca"
          className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo width={120} />
        </Link>

        <div className="hidden h-6 w-px bg-border sm:block" aria-hidden />

        {/* Une seule ligne : titre du cours tronqué. Le décompte "X / Y leçons"
            est déjà disponible dans la sidebar curriculum et redondant ici. */}
        <Link
          href={`/apprentissage/${courseSlug}`}
          title={courseTitle}
          className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground hover:underline"
        >
          {courseTitle}
        </Link>

        {/* Progression — version compacte (mobile) puis pleine (desktop) */}
        <div className="hidden items-center gap-3 md:flex" aria-hidden>
          <div className="w-40 overflow-hidden rounded-full bg-muted">
            <div
              className="h-1.5 bg-[color:var(--brand-success)] transition-[width] duration-300"
              style={{ width: `${clampedPercent}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-foreground">
            {clampedPercent} %
          </span>
        </div>
        <span className="md:hidden text-xs font-semibold tabular-nums text-foreground">
          {clampedPercent} %
        </span>

        {rightSlot}

        <Link
          href={`/apprentissage/${courseSlug}`}
          aria-label="Quitter le mode apprentissage"
          className="ml-2 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-5 w-5" aria-hidden />
        </Link>
      </div>
    </header>
  );
}
