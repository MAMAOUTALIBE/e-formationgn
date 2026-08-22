"use client";

// Surface de lecture d'une leçon TEXTE — l'équivalent du lecteur vidéo.
//
// L'écran affichait auparavant, à la place du player, un pavé gris renvoyant
// vers un onglet plus bas : le contenu principal de la leçon était le seul à
// ne pas occuper la scène. Ici le texte prend cette place, avec les deux
// repères qu'un lecteur vidéo fournit et qu'un texte n'a pas nativement :
//
//   - une barre de progression, qui suit le défilement au lieu du temps ;
//   - une fin explicite, où l'on propose la leçon suivante — la contrepartie
//     de l'écran de fin d'une vidéo ;
//   - la complétion enregistrée toute seule quand le texte a été parcouru,
//     comme la vidéo la marque en arrivant à son terme. Sans cela le texte
//     était le seul contenu dont l'avancement dépendait d'une case que
//     l'élève devait penser à cocher.

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { MarkdownContent } from "@/components/features/learning/markdown-content";
import { Button } from "@/components/ui/button";
import { recordLessonProgress } from "@/server/actions/learning";

interface LessonReaderProps {
  lessonId: string;
  content: string;
  readingMinutes: number;
  nextLessonHref: string | null;
  nextLessonTitle: string | null;
  /** Évite de réenregistrer une complétion déjà acquise à chaque visite. */
  alreadyCompleted: boolean;
}

export function LessonReader({
  lessonId,
  content,
  readingMinutes,
  nextLessonHref,
  nextLessonTitle,
  alreadyCompleted,
}: LessonReaderProps) {
  const router = useRouter();
  const articleRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);
  // Une référence et non un état : l'enregistrement ne doit partir qu'une
  // fois, et un état redéclencherait l'effet de défilement à chaque passage.
  const completionSent = useRef(alreadyCompleted);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;

    // Le texte défile avec la page, pas dans un conteneur propre : la
    // progression se calcule donc sur la portion de l'article déjà passée
    // au-dessus du bas de la fenêtre.
    function update() {
      if (!article) return;
      const rect = article.getBoundingClientRect();
      const total = rect.height;
      if (total <= 0) return;
      const seen = Math.min(total, Math.max(0, window.innerHeight - rect.top));
      const ratio = total <= window.innerHeight ? 1 : seen / total;
      const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
      setProgress(percent);
      if (percent < 95) return;

      setReachedEnd(true);
      // Même seuil que le lecteur vidéo : 95 % vaut « parcouru », parce que
      // personne ne fait défiler jusqu'au dernier pixel.
      if (completionSent.current) return;
      completionSent.current = true;
      void recordLessonProgress({ lessonId, isCompleted: true }).then(() => {
        router.refresh();
      });
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [lessonId, router]);

  return (
    <div className="bg-card">
      <div
        className="sticky top-14 z-10 h-1 w-full bg-border"
        role="progressbar"
        aria-label="Progression de lecture"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-[color:var(--brand-secondary)] transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      <article
        ref={articleRef}
        className="mx-auto max-w-[68ch] px-5 py-8 sm:px-8 sm:py-12"
      >
        <p className="mb-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Lecture · {readingMinutes} min
        </p>

        <MarkdownContent source={content} />

        {nextLessonHref ? (
          <div
            className={`mt-12 rounded-lg border border-border bg-muted/30 p-5 transition-opacity ${
              reachedEnd ? "opacity-100" : "opacity-70"
            }`}
          >
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {reachedEnd ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
              {reachedEnd ? "Leçon parcourue" : "À suivre"}
            </p>
            <p className="mt-1.5 text-sm font-medium text-foreground">
              {nextLessonTitle}
            </p>
            <Button asChild size="sm" className="mt-3">
              <Link href={nextLessonHref}>
                Leçon suivante
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : null}
      </article>
    </div>
  );
}
