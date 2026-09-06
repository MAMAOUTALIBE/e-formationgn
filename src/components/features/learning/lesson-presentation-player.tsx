"use client";

import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Minimize2,
} from "lucide-react";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type TouchEvent,
} from "react";

import { Button } from "@/components/ui/button";
import {
  presentationHotspotLabel,
  presentationSlideIndexForResume,
} from "@/lib/presentation-learning";
import { recordPresentationSlideView } from "@/server/actions/learning";

export interface LessonPresentationPlayerSlide {
  id: string;
  displayOrder: number;
  width: number;
  height: number;
  extractedText: string | null;
  hotspots: Array<{
    id: string;
    kind: "EXTERNAL_URL" | "INTERNAL_SLIDE";
    x: number;
    y: number;
    width: number;
    height: number;
    externalUrl: string | null;
    targetSlideOrder: number | null;
    ariaLabel: string | null;
  }>;
}

interface LessonPresentationPlayerProps {
  lessonId: string;
  lessonTitle: string;
  learnerIdentity: string;
  slides: LessonPresentationPlayerSlide[];
  initialProgress: {
    lastSlideOrder: number;
    viewedSlideOrders: number[];
    completed: boolean;
  };
}

function slideImageUrl(lessonId: string, slideId: string): string {
  return `/api/lecons/${encodeURIComponent(lessonId)}/presentation/diapositives/${encodeURIComponent(slideId)}`;
}

function interactiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("a, button, input, textarea, select"));
}

export function LessonPresentationPlayer({
  lessonId,
  lessonTitle,
  learnerIdentity,
  slides,
  initialProgress,
}: LessonPresentationPlayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(() =>
    presentationSlideIndexForResume(
      slides.map((slide) => slide.displayOrder),
      initialProgress.lastSlideOrder,
    ),
  );
  const [viewedOrders, setViewedOrders] = useState(
    () => new Set(initialProgress.viewedSlideOrders),
  );
  const [completed, setCompleted] = useState(initialProgress.completed);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [failedSlideId, setFailedSlideId] = useState<string | null>(null);
  const [canvasLayout, setCanvasLayout] = useState<{
    slideId: string;
    width: number;
    height: number;
  } | null>(null);
  const [progressError, setProgressError] = useState("");
  const currentSlide = slides[currentIndex];

  const goToIndex = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(slides.length - 1, index)));
    },
    [slides.length],
  );
  const previous = useCallback(() => goToIndex(currentIndex - 1), [currentIndex, goToIndex]);
  const next = useCallback(() => goToIndex(currentIndex + 1), [currentIndex, goToIndex]);

  useEffect(() => {
    const handleFullscreen = () => {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => document.removeEventListener("fullscreenchange", handleFullscreen);
  }, []);

  useEffect(() => {
    if (!currentSlide) return;
    startTransition(async () => {
      const result = await recordPresentationSlideView({
        lessonId,
        slideId: currentSlide.id,
      });
      if (!result.success || !result.progress) {
        setProgressError(result.message ?? "Progression non enregistrée.");
        return;
      }
      const progress = result.progress;
      setProgressError("");
      // Deux actions peuvent finir dans un ordre différent de la navigation.
      // Une réponse ancienne ne doit jamais effacer une visite/complétion plus récente.
      setViewedOrders(
        (current) => new Set([...current, ...progress.viewedSlideOrders]),
      );
      setCompleted((current) => current || progress.completed);
    });
  }, [currentSlide, lessonId]);

  useEffect(() => {
    const following = slides[currentIndex + 1];
    if (!following) return;
    const prefetched = new Image();
    prefetched.src = slideImageUrl(lessonId, following.id);
  }, [currentIndex, lessonId, slides]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !currentSlide) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const availableWidth = entry.contentRect.width;
      const availableHeight = entry.contentRect.height;
      if (availableWidth <= 0 || availableHeight <= 0) return;
      const ratio = Math.max(1, currentSlide.width) / Math.max(1, currentSlide.height);
      const constrainedByWidth = availableWidth / availableHeight <= ratio;
      const width = constrainedByWidth ? availableWidth : availableHeight * ratio;
      const height = constrainedByWidth ? availableWidth / ratio : availableHeight;
      setCanvasLayout({ slideId: currentSlide.id, width, height });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [currentSlide]);

  const orderToIndex = useMemo(
    () => new Map(slides.map((slide, index) => [slide.displayOrder, index])),
    [slides],
  );
  if (!currentSlide) return null;

  const visitedCount = slides.filter((slide) => viewedOrders.has(slide.displayOrder)).length;
  const viewedPercent = Math.round((visitedCount / slides.length) * 100);
  const imageUrl = slideImageUrl(lessonId, currentSlide.id);
  const imageFailed = failedSlideId === currentSlide.id;

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {
      setProgressError("Le plein écran n’est pas disponible dans ce navigateur.");
    }
  };

  const handleTouchStart = (event: TouchEvent) => {
    const touch = event.changedTouches[0];
    if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
  };
  const handleTouchEnd = (event: TouchEvent) => {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    touchStart.current = null;
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    if (deltaX > 0) previous();
    else next();
  };

  const handleKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest("input, textarea, select, [contenteditable='true']")
    ) {
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      previous();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    } else if (event.key === " " && !interactiveTarget(target)) {
      event.preventDefault();
      next();
    } else if (event.key === "Home") {
      event.preventDefault();
      goToIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goToIndex(slides.length - 1);
    }
  };

  const slideWidth = Math.max(1, currentSlide.width);
  const slideHeight = Math.max(1, currentSlide.height);
  const fittedCanvas = canvasLayout?.slideId === currentSlide.id ? canvasLayout : null;

  return (
    <div
      ref={rootRef}
      data-presentation-player
      className="flex w-full flex-col bg-slate-950 text-white outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 fullscreen:h-screen"
      aria-label={`Diaporama : ${lessonTitle}`}
      aria-describedby="presentation-keyboard-help"
      tabIndex={0}
      onKeyDown={handleKeyboard}
    >
      <div
        ref={stageRef}
        className="relative flex min-h-[240px] flex-1 touch-pan-y items-center justify-center overflow-hidden bg-black sm:min-h-[420px]"
        style={isFullscreen ? undefined : { aspectRatio: `${slideWidth} / ${slideHeight}` }}
        onClick={(event) => {
          if (!interactiveTarget(event.target)) {
            rootRef.current?.focus({ preventScroll: true });
            next();
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          data-presentation-canvas
          className="relative shrink-0 overflow-hidden"
          style={{
            aspectRatio: `${slideWidth} / ${slideHeight}`,
            width: fittedCanvas ? `${fittedCanvas.width}px` : "100%",
            height: fittedCanvas ? `${fittedCanvas.height}px` : "auto",
          }}
        >
          {imageFailed ? (
            <p role="alert" className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-100">
              Cette diapositive ne peut pas être affichée pour le moment.
            </p>
          ) : (
            // La route est privée et `no-store` : l'optimiseur Next créerait
            // une seconde surface de cache et ne convient pas à ce média.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={currentSlide.id}
              src={imageUrl}
              alt={`Diapositive ${currentIndex + 1} sur ${slides.length} : ${lessonTitle}`}
              className="absolute inset-0 h-full w-full select-none object-contain"
              draggable={false}
              onContextMenu={(event) => event.preventDefault()}
              onDragStart={(event) => event.preventDefault()}
              onError={() => setFailedSlideId(currentSlide.id)}
            />
          )}

          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-[80%] -translate-x-1/2 -translate-y-1/2 -rotate-12 select-none whitespace-nowrap rounded bg-black/15 px-3 py-1 text-sm font-semibold tracking-wide text-white/35 shadow-sm sm:text-lg"
          >
            {learnerIdentity}
          </span>

          {currentSlide.hotspots.map((hotspot) => {
          const style = {
            left: `${hotspot.x * 100}%`,
            top: `${hotspot.y * 100}%`,
            width: `${hotspot.width * 100}%`,
            height: `${hotspot.height * 100}%`,
          };
          const label = presentationHotspotLabel(hotspot);
          const hotspotClass =
            "absolute rounded-sm bg-blue-400/0 outline-none transition-colors hover:bg-blue-400/15 focus-visible:bg-blue-400/20 focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

          if (hotspot.kind === "EXTERNAL_URL" && hotspot.externalUrl) {
            return (
              <a
                key={hotspot.id}
                href={hotspot.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${label} (nouvel onglet)`}
                title={label}
                className={hotspotClass}
                style={style}
                onClick={(event) => event.stopPropagation()}
              />
            );
          }
          const targetIndex =
            hotspot.targetSlideOrder === null
              ? undefined
              : orderToIndex.get(hotspot.targetSlideOrder);
          if (targetIndex === undefined) return null;
          return (
            <button
              key={hotspot.id}
              type="button"
              aria-label={label}
              title={label}
              className={hotspotClass}
              style={style}
              onClick={(event) => {
                event.stopPropagation();
                goToIndex(targetIndex);
              }}
            />
          );
          })}

          <span className="sr-only" aria-live="polite">
            Diapositive {currentIndex + 1} sur {slides.length}.
          </span>
          {currentSlide.extractedText ? (
            <section
              className="sr-only"
              aria-label={`Texte extrait de la diapositive ${currentIndex + 1}`}
            >
              <p>{currentSlide.extractedText}</p>
            </section>
          ) : null}
        </div>

        <span id="presentation-keyboard-help" className="sr-only">
          Utilisez les flèches gauche et droite pour changer de diapositive.
        </span>
      </div>

      <div className="border-t border-white/10 bg-slate-950 px-3 py-3 sm:px-4">
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/15">
          <div
            role="progressbar"
            aria-label="Diapositives consultées"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={viewedPercent}
            className="h-full rounded-full bg-[color:var(--brand-secondary)] transition-[width]"
            style={{ width: `${viewedPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={previous}
            disabled={currentIndex === 0}
            aria-label="Diapositive précédente"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Précédente</span>
          </Button>

          <p className="text-center text-xs tabular-nums text-slate-200 sm:text-sm">
            {currentIndex + 1} / {slides.length}
            <span className="sr-only"> — {visitedCount} consultées</span>
            {completed ? <span className="ml-2 text-emerald-300">Terminée</span> : null}
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Quitter le plein écran" : "Afficher en plein écran"}
              className="text-white hover:bg-white/10 hover:text-white"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={next}
              disabled={currentIndex === slides.length - 1}
              aria-label="Diapositive suivante"
            >
              <span className="hidden sm:inline">Suivante</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {progressError ? (
          <p role="status" className="mt-2 text-center text-xs text-amber-200">
            {progressError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
