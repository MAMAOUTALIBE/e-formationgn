"use client";

// Lecteur de leçon : utilise Mux Player si playbackId est fourni, sinon
// fallback sur une balise <video> HTML5 native quand un externalVideoUrl
// est présent (utile pour le seed démo Blender ou tout contenu hors-Mux).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, X } from "lucide-react";

import { recordLessonProgress } from "@/server/actions/learning";

interface LessonPlayerProps {
  /** Identifiant Mux Playback. Prioritaire sur externalVideoUrl. */
  playbackId?: string | null;
  /** JWT signé pour les assets en policy `signed`. null si policy `public`. */
  playbackToken?: string | null;
  /** URL .mp4 externe utilisée si playbackId est absent. */
  externalVideoUrl?: string | null;
  lessonId: string;
  initialPositionSeconds?: number;
  durationSeconds?: number;
  thumbnail?: string | null;
  title?: string;
  /** Lien vers la leçon suivante — déclenche l'auto-avance en fin de vidéo. */
  nextLessonHref?: string | null;
  /** Titre de la leçon suivante (affiché dans l'overlay). */
  nextLessonTitle?: string | null;
}

const COMPLETION_THRESHOLD = 0.95; // 95 % regardé = leçon terminée
const AUTO_ADVANCE_SECONDS = 5;

export function LessonPlayer({
  playbackId,
  playbackToken,
  externalVideoUrl,
  lessonId,
  initialPositionSeconds = 0,
  durationSeconds = 0,
  thumbnail,
  title,
  nextLessonHref,
  nextLessonTitle,
}: LessonPlayerProps) {
  if (playbackId) {
    return (
      <MuxLessonPlayer
        playbackId={playbackId}
        playbackToken={playbackToken ?? null}
        lessonId={lessonId}
        initialPositionSeconds={initialPositionSeconds}
        durationSeconds={durationSeconds}
        thumbnail={thumbnail}
        title={title}
        nextLessonHref={nextLessonHref}
        nextLessonTitle={nextLessonTitle}
      />
    );
  }
  if (externalVideoUrl) {
    return (
      <NativeLessonPlayer
        src={externalVideoUrl}
        lessonId={lessonId}
        initialPositionSeconds={initialPositionSeconds}
        durationSeconds={durationSeconds}
        poster={thumbnail ?? undefined}
        title={title}
        nextLessonHref={nextLessonHref}
        nextLessonTitle={nextLessonTitle}
      />
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Auto-avance : décompte + navigation vers la leçon suivante en fin de vidéo.
// ---------------------------------------------------------------------------

function useAutoAdvance(nextLessonHref?: string | null) {
  const router = useRouter();
  const [countdown, setCountdown] = useState<number | null>(null);
  const startRef = useRef<() => void>(() => {});

  useEffect(() => {
    startRef.current = () => {
      if (nextLessonHref) setCountdown(AUTO_ADVANCE_SECONDS);
    };
  }, [nextLessonHref]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      if (nextLessonHref) router.push(nextLessonHref);
      return;
    }
    const timer = setTimeout(
      () => setCountdown((c) => (c === null ? null : c - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [countdown, nextLessonHref, router]);

  // `trigger` est stable (useCallback) pour pouvoir être appelé depuis l'effet
  // du player sans le ré-exécuter ni écrire un ref pendant le render.
  const trigger = useCallback(() => startRef.current(), []);

  return {
    countdown,
    /** À appeler en fin de vidéo. */
    trigger,
    goNow: () => {
      if (nextLessonHref) router.push(nextLessonHref);
    },
    cancel: () => setCountdown(null),
  };
}

function AutoAdvanceOverlay({
  countdown,
  nextLessonTitle,
  onNow,
  onCancel,
}: {
  countdown: number;
  nextLessonTitle?: string | null;
  onNow: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center text-white">
      <p className="text-xs uppercase tracking-wide text-white/70">
        Leçon suivante dans {countdown} s
      </p>
      {nextLessonTitle ? (
        <p className="max-w-md text-lg font-semibold">{nextLessonTitle}</p>
      ) : null}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onNow}
          className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
        >
          <Play className="h-4 w-4" />
          Lancer maintenant
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-md border border-white/40 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
        >
          <X className="h-4 w-4" />
          Annuler
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mux player (cas Mux configuré + asset uploadé)
// ---------------------------------------------------------------------------

interface MuxLessonPlayerProps {
  playbackId: string;
  playbackToken: string | null;
  lessonId: string;
  initialPositionSeconds: number;
  durationSeconds: number;
  thumbnail?: string | null;
  title?: string;
  nextLessonHref?: string | null;
  nextLessonTitle?: string | null;
}

function MuxLessonPlayer({
  playbackId,
  playbackToken,
  lessonId,
  initialPositionSeconds,
  durationSeconds,
  thumbnail,
  title,
  nextLessonHref,
  nextLessonTitle,
}: MuxLessonPlayerProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const lastReportRef = useRef<number>(0);
  const completedRef = useRef(false);
  const autoAdvance = useAutoAdvance(nextLessonHref);
  const advanceTrigger = autoAdvance.trigger;

  useEffect(() => {
    void import("@mux/mux-player");
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const player = container.querySelector("mux-player") as
      | (HTMLElement & { currentTime: number; duration: number })
      | null;
    if (!player) return;

    function handleTimeUpdate() {
      if (!player) return;
      const now = Date.now();
      if (now - lastReportRef.current < 5000) return;
      lastReportRef.current = now;

      void recordLessonProgress({
        lessonId,
        watchedSeconds: Math.round(player.currentTime),
        lastPositionSeconds: Math.round(player.currentTime),
      });

      const total = player.duration || durationSeconds;
      if (
        !completedRef.current &&
        total > 0 &&
        player.currentTime / total >= COMPLETION_THRESHOLD
      ) {
        completedRef.current = true;
        void recordLessonProgress({
          lessonId,
          isCompleted: true,
          watchedSeconds: Math.round(player.currentTime),
          lastPositionSeconds: Math.round(player.currentTime),
        }).then(() => router.refresh());
      }
    }

    function handleEnded() {
      const alreadyCompleted = completedRef.current;
      completedRef.current = true;
      advanceTrigger(); // overlay « leçon suivante » + décompte
      void recordLessonProgress({
        lessonId,
        isCompleted: true,
        watchedSeconds: Math.round(player?.currentTime ?? durationSeconds),
        lastPositionSeconds: 0,
      }).then(() => {
        // Évite un refresh redondant si le seuil 95 % l'a déjà déclenché.
        if (!alreadyCompleted) router.refresh();
      });
    }

    player.addEventListener("timeupdate", handleTimeUpdate);
    player.addEventListener("ended", handleEnded);
    return () => {
      player.removeEventListener("timeupdate", handleTimeUpdate);
      player.removeEventListener("ended", handleEnded);
    };
  }, [lessonId, durationSeconds, router, advanceTrigger]);

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-lg bg-black">
      <mux-player
        playback-id={playbackId}
        playback-token={playbackToken || undefined}
        metadata-video-title={title}
        primary-color="#1E3A8A"
        accent-color="#0EA5E9"
        stream-type="on-demand"
        playback-rates="0.5 0.75 1 1.25 1.5 2"
        start-time={initialPositionSeconds || undefined}
        poster={thumbnail || undefined}
        style={{ width: "100%", aspectRatio: "16 / 9" }}
      />
      {autoAdvance.countdown !== null ? (
        <AutoAdvanceOverlay
          countdown={autoAdvance.countdown}
          nextLessonTitle={nextLessonTitle}
          onNow={autoAdvance.goNow}
          onCancel={autoAdvance.cancel}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Native player (cas externalVideoUrl, ex : démos Blender CC BY 3.0)
// ---------------------------------------------------------------------------

interface NativeLessonPlayerProps {
  src: string;
  lessonId: string;
  initialPositionSeconds: number;
  durationSeconds: number;
  poster?: string;
  title?: string;
  nextLessonHref?: string | null;
  nextLessonTitle?: string | null;
}

function NativeLessonPlayer({
  src,
  lessonId,
  initialPositionSeconds,
  durationSeconds,
  poster,
  title,
  nextLessonHref,
  nextLessonTitle,
}: NativeLessonPlayerProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastReportRef = useRef<number>(0);
  const completedRef = useRef(false);
  const autoAdvance = useAutoAdvance(nextLessonHref);
  const advanceTrigger = autoAdvance.trigger;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (initialPositionSeconds > 0) {
      const onLoaded = () => {
        try {
          video.currentTime = initialPositionSeconds;
        } catch {
          /* navigator restrictions — non bloquant */
        }
      };
      video.addEventListener("loadedmetadata", onLoaded, { once: true });
    }

    function handleTimeUpdate() {
      if (!video) return;
      const now = Date.now();
      if (now - lastReportRef.current < 5000) return;
      lastReportRef.current = now;

      void recordLessonProgress({
        lessonId,
        watchedSeconds: Math.round(video.currentTime),
        lastPositionSeconds: Math.round(video.currentTime),
      });

      const total = video.duration || durationSeconds;
      if (
        !completedRef.current &&
        total > 0 &&
        video.currentTime / total >= COMPLETION_THRESHOLD
      ) {
        completedRef.current = true;
        void recordLessonProgress({
          lessonId,
          isCompleted: true,
          watchedSeconds: Math.round(video.currentTime),
          lastPositionSeconds: Math.round(video.currentTime),
        }).then(() => router.refresh());
      }
    }

    function handleEnded() {
      const alreadyCompleted = completedRef.current;
      completedRef.current = true;
      advanceTrigger(); // overlay « leçon suivante » + décompte
      void recordLessonProgress({
        lessonId,
        isCompleted: true,
        watchedSeconds: Math.round(video?.currentTime ?? durationSeconds),
        lastPositionSeconds: 0,
      }).then(() => {
        // Évite un refresh redondant si le seuil 95 % l'a déjà déclenché.
        if (!alreadyCompleted) router.refresh();
      });
    }

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, [lessonId, durationSeconds, initialPositionSeconds, router, advanceTrigger]);

  return (
    <div className="relative overflow-hidden rounded-lg bg-black">
      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        preload="metadata"
        poster={poster}
        title={title}
        style={{ width: "100%", aspectRatio: "16 / 9", display: "block" }}
      >
        Votre navigateur ne supporte pas la lecture vidéo HTML5.
      </video>
      {autoAdvance.countdown !== null ? (
        <AutoAdvanceOverlay
          countdown={autoAdvance.countdown}
          nextLessonTitle={nextLessonTitle}
          onNow={autoAdvance.goNow}
          onCancel={autoAdvance.cancel}
        />
      ) : null}
    </div>
  );
}

// Déclare le custom element <mux-player> pour TypeScript / JSX (React 19).
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "mux-player": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "playback-id"?: string;
          "playback-token"?: string;
          "stream-type"?: "on-demand" | "live";
          "primary-color"?: string;
          "accent-color"?: string;
          "playback-rates"?: string;
          "start-time"?: number;
          "metadata-video-title"?: string;
          poster?: string;
          autoplay?: boolean | string;
        },
        HTMLElement
      >;
    }
  }
}
