"use client";

// Lecteur de leçon : utilise Mux Player si playbackId est fourni, sinon
// fallback sur une balise <video> HTML5 native quand un externalVideoUrl
// est présent (utile pour le seed démo Blender ou tout contenu hors-Mux).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, X } from "lucide-react";

import { recordLessonProgress } from "@/server/actions/learning";
import { installYouTubeReadyCallback } from "@/lib/youtube-api-ready";
import { canCompleteYouTube, isYouTubeEndedState, observeYouTubePlayback, parseYouTubeUrl, youtubePlayerErrorMessage } from "@/lib/youtube";
import { useLearningHeartbeat } from "./use-learning-heartbeat";

interface LessonPlayerProps {
  /** Identifiant Mux Playback. Prioritaire sur externalVideoUrl. */
  playbackId?: string | null;
  /** JWT signé pour les assets en policy `signed`. null si policy `public`. */
  playbackToken?: string | null;
  /** URL .mp4 externe utilisée si playbackId est absent. */
  externalVideoUrl?: string | null;
  lessonId: string;
  initialPositionSeconds?: number;
  /** Temps réellement observé comme joué, distinct de la position. */
  initialWatchedSeconds?: number;
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
  initialWatchedSeconds = 0,
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
    const youtube = parseYouTubeUrl(externalVideoUrl);
    if (youtube) {
      return (
        <YouTubeLessonPlayer videoId={youtube.id} lessonId={lessonId}
          initialPositionSeconds={initialPositionSeconds} title={title}
          initialWatchedSeconds={initialWatchedSeconds}
          nextLessonHref={nextLessonHref} nextLessonTitle={nextLessonTitle} />
      );
    }
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

type YouTubePlayer = { getCurrentTime(): number; getDuration(): number; seekTo(seconds: number, allowSeekAhead: boolean): void; destroy(): void };
type YouTubeNamespace = { Player: new (element: HTMLElement, options: Record<string, unknown>) => YouTubePlayer; PlayerState: { PLAYING: number; PAUSED: number; ENDED: number } };
let youtubeApiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  const promise = new Promise<YouTubeNamespace>((resolve, reject) => {
    let settled = false;
    const scriptSelector = 'script[src="https://www.youtube.com/iframe_api"]';
    let script = document.querySelector<HTMLScriptElement>(scriptSelector);
    let created = false;
    const cleanup = () => {
      window.clearTimeout(timeout);
      script?.removeEventListener("error", failFromEvent);
      script?.removeEventListener("load", checkReady);
      restoreReadyCallback();
    };
    const succeed = () => {
      if (settled || !window.YT?.Player) return;
      settled = true;
      cleanup();
      resolve(window.YT);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      script?.remove();
      youtubeApiPromise = null;
      reject(error);
    };
    const failFromEvent = () => fail(new Error("Chargement YouTube impossible"));
    const checkReady = () => succeed();
    const restoreReadyCallback = installYouTubeReadyCallback(window, succeed);
    if (!script) {
      script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      created = true;
    }
    script.addEventListener("error", failFromEvent, { once: true });
    script.addEventListener("load", checkReady, { once: true });
    const timeout = window.setTimeout(() => fail(new Error("Délai de chargement YouTube dépassé")), 10_000);
    if (created) document.head.appendChild(script);
  });
  youtubeApiPromise = promise;
  return promise;
}

function YouTubeLessonPlayer({ videoId, lessonId, initialPositionSeconds, initialWatchedSeconds, title, nextLessonHref, nextLessonTitle }: {
  videoId: string; lessonId: string; initialPositionSeconds: number; initialWatchedSeconds: number; title?: string;
  nextLessonHref?: string | null; nextLessonTitle?: string | null;
}) {
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const playedSecondsRef = useRef(Math.max(0, initialWatchedSeconds));
  const lastObservedPositionRef = useRef<number | null>(null);
  const reportTicksRef = useRef(0);
  const completedRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoAdvance = useAutoAdvance(nextLessonHref);
  const advanceTrigger = autoAdvance.trigger;
  useLearningHeartbeat(lessonId, { mode: "VIDEO", isPlaying });

  useEffect(() => {
    let disposed = false;
    void loadYouTubeApi().then((YT) => {
      if (disposed || !mountRef.current) return;
      playerRef.current = new YT.Player(mountRef.current, {
        host: "https://www.youtube-nocookie.com", videoId, width: "100%", height: "100%",
        playerVars: { enablejsapi: 1, rel: 0, playsinline: 1, origin: window.location.origin },
        events: {
          onReady: ({ target }: { target: YouTubePlayer }) => { if (initialPositionSeconds > 0) target.seekTo(initialPositionSeconds, true); },
          onStateChange: ({ data, target }: { data: number; target: YouTubePlayer }) => {
            setIsPlaying(data === YT.PlayerState.PLAYING);
            if (isYouTubeEndedState(data)) {
              const finalObservation = observeYouTubePlayback(
                { watchedSeconds: playedSecondsRef.current, lastPosition: lastObservedPositionRef.current },
                target.getCurrentTime(),
                document.visibilityState === "visible",
              );
              playedSecondsRef.current = finalObservation.watchedSeconds;
              lastObservedPositionRef.current = null;
            } else if (data === YT.PlayerState.PLAYING && document.visibilityState === "visible") lastObservedPositionRef.current = target.getCurrentTime();
            else lastObservedPositionRef.current = null;
            if (!isYouTubeEndedState(data)) return;
            const duration = target.getDuration();
            const sufficientlyWatched = canCompleteYouTube({ ended: true, watchedSeconds: playedSecondsRef.current, durationSeconds: duration, alreadyCompleted: completedRef.current });
            if (completedRef.current) return;
            // ENDED évite une complétion pendant un seek, et le cumul réellement
            // observé doit tout de même couvrir au moins 95 % de la durée.
            if (sufficientlyWatched) {
              completedRef.current = true;
              void recordLessonProgress({ lessonId, isCompleted: true, watchedSeconds: Math.round(playedSecondsRef.current), lastPositionSeconds: 0 }).then(() => router.refresh());
              advanceTrigger();
            } else {
              void recordLessonProgress({ lessonId, watchedSeconds: Math.round(playedSecondsRef.current), lastPositionSeconds: 0 });
            }
          },
          onError: ({ data }: { data: number }) => {
            setIsPlaying(false);
            setError(youtubePlayerErrorMessage(data));
          },
        },
      });
    }).catch(() => setError("Le lecteur YouTube n’a pas pu être chargé. Vérifiez votre connexion ou les réglages de confidentialité."));
    return () => { disposed = true; playerRef.current?.destroy(); playerRef.current = null; };
  }, [advanceTrigger, initialPositionSeconds, lessonId, router, videoId]);

  useEffect(() => {
    if (!isPlaying) return;
    const resetObservation = () => {
      lastObservedPositionRef.current = null;
      if (document.visibilityState === "visible" && playerRef.current) {
        // Nouvelle baseline : le déplacement produit pendant que l'onglet était
        // masqué ne sera jamais crédité au retour.
        lastObservedPositionRef.current = playerRef.current.getCurrentTime();
      }
    };
    document.addEventListener("visibilitychange", resetObservation);
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      if (document.visibilityState !== "visible") {
        lastObservedPositionRef.current = null;
        return;
      }
      const current = player.getCurrentTime();
      const observed = observeYouTubePlayback(
        { watchedSeconds: playedSecondsRef.current, lastPosition: lastObservedPositionRef.current },
        current,
        true,
      );
      playedSecondsRef.current = observed.watchedSeconds;
      lastObservedPositionRef.current = observed.lastPosition;
      reportTicksRef.current += 1;
      if (reportTicksRef.current % 5 === 0) {
        void recordLessonProgress({ lessonId, watchedSeconds: Math.round(playedSecondsRef.current), lastPositionSeconds: Math.round(current) });
      }
    }, 1000);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", resetObservation);
    };
  }, [isPlaying, lessonId]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
      <div ref={mountRef} className="h-full w-full" title={title ?? "Vidéo YouTube"} />
      {error ? <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 p-6 text-center text-sm text-white"><p>{error}</p><a className="underline" href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">Ouvrir la vidéo sur YouTube</a></div> : null}
      {autoAdvance.countdown !== null ? <AutoAdvanceOverlay countdown={autoAdvance.countdown} nextLessonTitle={nextLessonTitle} onNow={autoAdvance.goNow} onCancel={autoAdvance.cancel} /> : null}
    </div>
  );
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
  const [isPlaying, setIsPlaying] = useState(false);
  useLearningHeartbeat(lessonId, { mode: "VIDEO", isPlaying });

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
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    player.addEventListener("play", handlePlay);
    player.addEventListener("pause", handlePause);
    return () => {
      player.removeEventListener("timeupdate", handleTimeUpdate);
      player.removeEventListener("ended", handleEnded);
      player.removeEventListener("play", handlePlay);
      player.removeEventListener("pause", handlePause);
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
  const [isPlaying, setIsPlaying] = useState(false);
  useLearningHeartbeat(lessonId, { mode: "VIDEO", isPlaying });

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
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
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

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}
