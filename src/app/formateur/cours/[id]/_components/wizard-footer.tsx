"use client";

import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

import { WIZARD_STEPS, currentStepIndex, stepHref } from "./wizard";

interface WizardFooterProps {
  courseId: string;
  /** Index max accessible : au-delà, l'étape suivante est verrouillée. */
  unlockedMaxIndex: number;
}

/**
 * Barre de navigation bas-de-page de l'assistant : « Étape précédente » /
 * « Étape suivante ». Affichée uniquement sur les 4 étapes de création
 * (masquée sur les pages secondaires). Sur la dernière étape, invite à soumettre.
 */
export function WizardFooter({ courseId, unlockedMaxIndex }: WizardFooterProps) {
  const pathname = usePathname();
  const index = currentStepIndex(courseId, pathname);

  // Page secondaire ou inconnue → pas d'assistant.
  if (index === -1) return null;

  const prev = index > 0 ? WIZARD_STEPS[index - 1] : null;
  const next = index < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[index + 1] : null;
  const isLast = index === WIZARD_STEPS.length - 1;
  // L'étape suivante est verrouillée tant que l'étape courante n'est pas validée.
  const nextLocked = next ? index + 1 > unlockedMaxIndex : false;

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {prev ? (
          <Button asChild variant="outline">
            <Link href={stepHref(courseId, prev.slug)}>
              <ArrowLeft className="h-4 w-4" />
              {prev.label}
            </Link>
          </Button>
        ) : (
          <span />
        )}
      </div>

      <p className="order-first text-center text-xs text-muted-foreground sm:order-none">
        Étape {index + 1} sur {WIZARD_STEPS.length}
      </p>

      <div className="flex justify-end">
        {next && nextLocked ? (
          <Button
            variant="outline"
            disabled
            title="Complétez cette étape pour débloquer la suivante."
          >
            <Lock className="h-4 w-4" />
            {next.label}
          </Button>
        ) : next ? (
          <Button asChild>
            <Link href={stepHref(courseId, next.slug)}>
              {next.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : isLast ? (
          <p className="text-right text-xs text-muted-foreground">
            Dernière étape — cliquez sur{" "}
            <span className="font-medium text-foreground">
              « Soumettre à la modération »
            </span>{" "}
            en haut de page.
          </p>
        ) : null}
      </div>
    </div>
  );
}
