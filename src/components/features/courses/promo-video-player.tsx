"use client";

// Player Mux pour la vidéo de présentation du cours, montrée AVANT achat.
// Pattern Udemy : vignette + bouton play overlay → clic → bascule en player
// embed Mux. Charge le SDK <mux-player> à la demande pour ne pas alourdir
// la page détail si l'utilisateur ne joue pas la preview.

import { Play } from "lucide-react";
import * as React from "react";

interface PromoVideoPlayerProps {
  /** Mux playback ID (priorité). Si absent, on utilise videoUrl en fallback HTML5. */
  playbackId?: string | null;
  /** URL d'un MP4 externe (fallback quand Mux n'est pas configuré). */
  videoUrl?: string | null;
  title: string;
  thumbnailUrl?: string | null;
}

// La déclaration JSX du custom element <mux-player> vit dans
// src/components/features/learning/lesson-player.tsx (déclaration globale).

export function PromoVideoPlayer({
  playbackId,
  videoUrl,
  title,
  thumbnailUrl,
}: PromoVideoPlayerProps) {
  const [playing, setPlaying] = React.useState(false);
  const useMux = Boolean(playbackId);

  React.useEffect(() => {
    if (playing && useMux) void import("@mux/mux-player");
  }, [playing, useMux]);

  // Aucune source vidéo : on n'affiche rien (le parent gère le fallback image).
  if (!playbackId && !videoUrl) return null;

  if (!playing) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label={`Voir l'aperçu vidéo de ${title}`}
        className="group relative block aspect-video w-full overflow-hidden bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-secondary)]"
      >
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--brand-primary)]/40 via-black to-[color:var(--brand-violet)]/40" />
        )}

        <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-xl transition-transform group-hover:scale-110">
            <Play
              className="h-7 w-7 fill-[color:var(--brand-primary)] text-[color:var(--brand-primary)]"
              aria-hidden
            />
          </span>
        </span>

        <span className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white">
          Aperçu gratuit
        </span>
      </button>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden bg-black">
      {useMux ? (
        <mux-player
          playback-id={playbackId ?? undefined}
          metadata-video-title={`${title} — aperçu`}
          primary-color="#1E3A8A"
          accent-color="#0EA5E9"
          stream-type="on-demand"
          autoplay
        />
      ) : (
        <video
          src={videoUrl ?? undefined}
          poster={thumbnailUrl ?? undefined}
          controls
          autoPlay
          playsInline
          className="h-full w-full bg-black"
        >
          Votre navigateur ne supporte pas la lecture vidéo.
        </video>
      )}
    </div>
  );
}
