"use client";

// Lecteur Mux Player avec persistance de la progression.
// On utilise le custom element <mux-player> directement (le wrapper React
// existe aussi mais on garde simple). À chaque pause/seek/timeupdate, on
// met à jour la progression côté serveur.

import { useEffect, useRef } from "react";

import { recordLessonProgress } from "@/server/actions/learning";

interface LessonPlayerProps {
  playbackId: string;
  lessonId: string;
  initialPositionSeconds?: number;
  durationSeconds?: number;
  thumbnail?: string | null;
  title?: string;
}

const COMPLETION_THRESHOLD = 0.95; // 95 % regardé = leçon terminée

export function LessonPlayer({
  playbackId,
  lessonId,
  initialPositionSeconds = 0,
  durationSeconds = 0,
  thumbnail,
  title,
}: LessonPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastReportRef = useRef<number>(0);
  const completedRef = useRef(false);

  useEffect(() => {
    // Charge dynamiquement le module mux-player côté client.
    void import("@mux/mux-player");
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const player = container.querySelector("mux-player") as
      | (HTMLElement & {
          currentTime: number;
          duration: number;
        })
      | null;
    if (!player) return;

    function handleTimeUpdate() {
      if (!player) return;
      const now = Date.now();
      // throttle à 5 s
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

  // mux-player est un Custom Element ; React 19 sait passer les props HTML-like.
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
