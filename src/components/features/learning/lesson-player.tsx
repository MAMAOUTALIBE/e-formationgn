"use client";

// Lecteur de leçon : utilise Mux Player si playbackId est fourni, sinon
// fallback sur une balise <video> HTML5 native quand un externalVideoUrl
// est présent (utile pour le seed démo Blender ou tout contenu hors-Mux).

import { useEffect, useRef } from "react";

import { recordLessonProgress } from "@/server/actions/learning";

interface LessonPlayerProps {
  /** Identifiant Mux Playback. Prioritaire sur externalVideoUrl. */
  playbackId?: string | null;
  /** URL .mp4 externe utilisée si playbackId est absent. */
  externalVideoUrl?: string | null;
  lessonId: string;
  initialPositionSeconds?: number;
  durationSeconds?: number;
  thumbnail?: string | null;
  title?: string;
}

const COMPLETION_THRESHOLD = 0.95; // 95 % regardé = leçon terminée

export function LessonPlayer({
  playbackId,
  externalVideoUrl,
  lessonId,
  initialPositionSeconds = 0,
  durationSeconds = 0,
  thumbnail,
  title,
}: LessonPlayerProps) {
  if (playbackId) {
    return (
      <MuxLessonPlayer
        playbackId={playbackId}
        lessonId={lessonId}
        initialPositionSeconds={initialPositionSeconds}
        durationSeconds={durationSeconds}
        thumbnail={thumbnail}
        title={title}
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
      />
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Mux player (cas Mux configuré + asset uploadé)
// ---------------------------------------------------------------------------

interface MuxLessonPlayerProps {
  playbackId: string;
  lessonId: string;
  initialPositionSeconds: number;
  durationSeconds: number;
  thumbnail?: string | null;
  title?: string;
}

function MuxLessonPlayer({
  playbackId,
  lessonId,
  initialPositionSeconds,
  durationSeconds,
  thumbnail,
  title,
}: MuxLessonPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastReportRef = useRef<number>(0);
  const completedRef = useRef(false);

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
        });
      }
    }

    function handleEnded() {
      void recordLessonProgress({
        lessonId,
        isCompleted: true,
        watchedSeconds: Math.round(player?.currentTime ?? durationSeconds),
        lastPositionSeconds: 0,
      });
    }

    player.addEventListener("timeupdate", handleTimeUpdate);
    player.addEventListener("ended", handleEnded);
    return () => {
      player.removeEventListener("timeupdate", handleTimeUpdate);
      player.removeEventListener("ended", handleEnded);
    };
  }, [lessonId, durationSeconds]);

  return (
    <div ref={containerRef} className="overflow-hidden rounded-lg bg-black">
      <mux-player
        playback-id={playbackId}
        metadata-video-title={title}
        primary-color="#1E3A8A"
        accent-color="#0EA5E9"
        stream-type="on-demand"
        playback-rates="0.5 0.75 1 1.25 1.5 2"
        start-time={initialPositionSeconds || undefined}
        poster={thumbnail || undefined}
        style={{ width: "100%", aspectRatio: "16 / 9" }}
      />
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
}

function NativeLessonPlayer({
  src,
  lessonId,
  initialPositionSeconds,
  durationSeconds,
  poster,
  title,
}: NativeLessonPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastReportRef = useRef<number>(0);
  const completedRef = useRef(false);

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
        });
      }
    }

    function handleEnded() {
      void recordLessonProgress({
        lessonId,
        isCompleted: true,
        watchedSeconds: Math.round(video?.currentTime ?? durationSeconds),
        lastPositionSeconds: 0,
      });
    }

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, [lessonId, durationSeconds, initialPositionSeconds]);

  return (
    <div className="overflow-hidden rounded-lg bg-black">
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
          "stream-type"?: "on-demand" | "live";
          "primary-color"?: string;
          "accent-color"?: string;
          "playback-rates"?: string;
          "start-time"?: number;
          "metadata-video-title"?: string;
          poster?: string;
        },
        HTMLElement
      >;
    }
  }
}
