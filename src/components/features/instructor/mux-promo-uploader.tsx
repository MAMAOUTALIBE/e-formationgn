"use client";

// Uploader vidéo Mux pour la "vidéo de présentation" (promo) du cours,
// affichée comme preview avant achat sur la page détail.
//
// Variante simplifiée du MuxUploader des leçons :
//   - rattaché à un courseId au lieu d'un lessonId
//   - pas de durée stockée (juste un teaser)
//   - même flux : presigned upload direct vers Mux + polling pour playbackId

import { Loader2, Trash2, UploadCloud, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/features/instructor/confirm-action";
import { cn } from "@/lib/utils";
import { isLikelyVideoFile } from "@/lib/video-file";
import {
  confirmMuxUploadForCoursePromo,
  createMuxUploadForCoursePromo,
  detachMuxFromCoursePromo,
} from "@/server/actions/curriculum";

interface MuxPromoUploaderProps {
  courseId: string;
  initialPlaybackId?: string | null;
  isMuxConfigured: boolean;
}

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading"; progress: number }
  | { kind: "processing"; message: string }
  | { kind: "ready"; playbackId: string }
  | { kind: "error"; message: string };

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 60;

export function MuxPromoUploader({
  courseId,
  initialPlaybackId,
  isMuxConfigured,
}: MuxPromoUploaderProps) {
  const [state, setState] = useState<UploadState>(() =>
    initialPlaybackId
      ? { kind: "ready", playbackId: initialPlaybackId }
      : { kind: "idle" },
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  function pickFile() {
    fileInputRef.current?.click();
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isLikelyVideoFile(file.name, file.type)) {
      setState({ kind: "error", message: "Seuls les fichiers vidéo sont acceptés." });
      return;
    }

    setState({ kind: "uploading", progress: 0 });

    try {
      const result = await createMuxUploadForCoursePromo(courseId);
      if (!result.ok || !result.url) {
        setState({
          kind: "error",
          message: result.error ?? "Impossible de préparer l'upload.",
        });
        return;
      }

      await uploadFileToMux(file, result.url, (progress) =>
        setState({ kind: "uploading", progress }),
      );

      setState({ kind: "processing", message: "Encodage en cours…" });
      startPolling();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      setState({ kind: "error", message });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function startPolling(attempt = 0) {
    if (attempt >= MAX_POLL_ATTEMPTS) {
      setState({
        kind: "error",
        message:
          "L'encodage prend plus de temps que prévu. Recharger la page ; le webhook finalisera en arrière-plan.",
      });
      return;
    }
    pollTimerRef.current = setTimeout(async () => {
      try {
        const status = await confirmMuxUploadForCoursePromo(courseId);
        if (!status.ok) {
          setState({
            kind: "error",
            message: status.message ?? "Erreur lors de la confirmation.",
          });
          return;
        }
        if (status.status === "ready" && status.playbackId) {
          setState({ kind: "ready", playbackId: status.playbackId });
          return;
        }
        if (status.status === "errored") {
          setState({
            kind: "error",
            message: "L'encodage a échoué côté Mux. Veuillez réessayer.",
          });
          return;
        }
        startPolling(attempt + 1);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erreur de polling.";
        setState({ kind: "error", message });
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleDetach() {
    setState({ kind: "idle" });
    await detachMuxFromCoursePromo(courseId);
  }

  if (!isMuxConfigured) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Mux n&apos;est pas configuré. Renseignez{" "}
          <code className="rounded bg-muted px-1">MUX_TOKEN_ID</code> et{" "}
          <code className="rounded bg-muted px-1">MUX_TOKEN_SECRET</code> dans{" "}
          <code className="rounded bg-muted px-1">.env</code>, puis redémarrez le
          serveur.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.3g2,.3gp,.asf,.avi,.divx,.dv,.f4v,.flv,.m2t,.m2ts,.m4v,.mkv,.mod,.mov,.mpe,.mpeg,.mpg,.mts,.mxf,.ogm,.ogv,.qt,.rm,.rmvb,.tod,.ts,.vob,.webm,.wmv"
        onChange={handleFile}
        className="hidden"
      />

      {state.kind === "ready" ? (
        <div className="space-y-3">
          <div className="aspect-video overflow-hidden rounded-md bg-black">
            <iframe
              title="Aperçu vidéo de présentation"
              src={`https://stream.mux.com/${state.playbackId}.html`}
              className="h-full w-full"
              allow="autoplay; fullscreen"
            />
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Video className="h-4 w-4" aria-hidden />
            Vidéo de présentation prête — visible publiquement sur la fiche du cours.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={pickFile}>
              <UploadCloud className="h-4 w-4" aria-hidden />
              Remplacer la vidéo
            </Button>
            <ConfirmAction
              variant="outline"
              message="Supprimer cette vidéo de présentation ? Cette action ne peut pas être annulée."
              onConfirm={handleDetach}
              pendingLabel="Suppression…"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Retirer la vidéo
            </ConfirmAction>
          </div>
        </div>
      ) : null}

      {state.kind === "idle" ? (
        <button
          type="button"
          onClick={pickFile}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/40 px-6 py-10 text-center transition-colors hover:border-[color:var(--brand-secondary)]/40 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <UploadCloud className="h-8 w-8 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium text-foreground">
            Téléverser une vidéo de présentation
          </span>
          <span className="text-xs text-muted-foreground">
            Teaser court (1–2 min recommandé) montré aux visiteurs avant achat.
          </span>
        </button>
      ) : null}

      {state.kind === "uploading" ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Téléversement vers Mux… {state.progress}%
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-[color:var(--brand-secondary)] transition-all"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {state.kind === "processing" ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {state.message} (vérification toutes les {POLL_INTERVAL_MS / 1000}s)
        </div>
      ) : null}

      {state.kind === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function uploadFileToMux(
  file: File,
  url: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload échoué (${xhr.status}). Réessayez.`));
      }
    };
    xhr.onerror = () => reject(new Error("Erreur réseau pendant l'upload."));
    xhr.send(file);
  });
}
