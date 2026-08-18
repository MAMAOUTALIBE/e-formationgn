"use client";

// Sélecteur de source vidéo pour une leçon. Trois méthodes, affichées selon
// ce qui est configuré côté plateforme :
//   - Mux         : encodage adaptatif + lecture signée (composant existant)
//   - Téléverser  : upload direct vers Cloudflare R2 (presigned PUT)
//   - Lien / URL  : .mp4/.webm/.mov direct, lu par la balise <video> de l'élève
//
// Mux et externalVideoUrl sont mutuellement exclusifs (cf. actions serveur).
// Pour les sources R2/URL, on capte la durée au chargement de la métadonnée
// vidéo et on la persiste (setLessonVideoDuration) — Mux fournit la sienne.

import { Link2, Loader2, Trash2, UploadCloud, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ConfirmAction } from "@/components/features/instructor/confirm-action";
import { MuxUploader } from "@/components/features/instructor/mux-uploader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDurationFromSeconds } from "@/lib/format/duration";
import { cn } from "@/lib/utils";
import { isLikelyVideoFile, videoUploadContentType } from "@/lib/video-file";
import {
  clearLessonVideo,
  setLessonExternalVideoUrl,
  setLessonVideoDuration,
} from "@/server/actions/curriculum";
import { createPresignedLessonVideoUpload } from "@/server/actions/storage";

type SourceTab = "mux" | "upload" | "url";

interface LessonVideoSourceProps {
  lessonId: string;
  muxPlaybackId: string | null;
  externalVideoUrl: string | null;
  durationSeconds: number;
  isMuxConfigured: boolean;
  isUploadAvailable: boolean;
}

export function LessonVideoSource({
  lessonId,
  muxPlaybackId,
  externalVideoUrl,
  durationSeconds,
  isMuxConfigured,
  isUploadAvailable,
}: LessonVideoSourceProps) {
  const router = useRouter();

  const tabs: { key: SourceTab; label: string; available: boolean }[] = [
    { key: "mux", label: "Mux (premium)", available: isMuxConfigured },
    { key: "upload", label: "Téléverser un fichier", available: isUploadAvailable },
    { key: "url", label: "Lien / URL", available: true },
  ];
  const available = tabs.filter((t) => t.available);

  // Onglet par défaut : selon la source déjà en place, sinon le 1er dispo.
  const initialTab: SourceTab = muxPlaybackId
    ? "mux"
    : externalVideoUrl
      ? isUploadAvailable
        ? "upload"
        : "url"
      : (available[0]?.key ?? "url");
  const [tab, setTab] = useState<SourceTab>(initialTab);

  return (
    <div className="space-y-4">
      {/* Onglets — masqués s'il n'y a qu'une seule source disponible. */}
      {available.length > 1 ? (
        <div
          role="tablist"
          aria-label="Source de la vidéo"
          className="inline-flex flex-wrap gap-0.5 rounded-md border border-border bg-muted/40 p-0.5"
        >
          {available.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.key
                  ? "bg-[color:var(--brand-primary)] text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "mux" ? (
        <MuxUploader
          lessonId={lessonId}
          initialPlaybackId={muxPlaybackId}
          initialDurationSeconds={durationSeconds}
          isMuxConfigured={isMuxConfigured}
        />
      ) : null}

      {tab === "upload" ? (
        <R2VideoUploader
          lessonId={lessonId}
          externalVideoUrl={muxPlaybackId ? null : externalVideoUrl}
          durationSeconds={durationSeconds}
          onChanged={() => router.refresh()}
        />
      ) : null}

      {tab === "url" ? (
        <ExternalUrlForm
          lessonId={lessonId}
          externalVideoUrl={muxPlaybackId ? null : externalVideoUrl}
          durationSeconds={durationSeconds}
          onChanged={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aperçu + suppression communs aux sources externes (R2 / URL).
// Capte la durée au chargement de la métadonnée et la persiste.
// ---------------------------------------------------------------------------

function ExternalVideoPreview({
  lessonId,
  src,
  durationSeconds,
  onRemoved,
}: {
  lessonId: string;
  src: string;
  durationSeconds: number;
  onRemoved: () => void;
}) {
  const reportedRef = useRef(false);

  return (
    <div className="space-y-3">
      <div className="aspect-video overflow-hidden rounded-md bg-black">
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className="h-full w-full"
          onLoadedMetadata={(e) => {
            if (reportedRef.current) return;
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0 && Math.round(d) !== durationSeconds) {
              reportedRef.current = true;
              void setLessonVideoDuration(lessonId, Math.round(d));
            }
          }}
        />
      </div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Video className="h-4 w-4" aria-hidden />
        Vidéo enregistrée
        {durationSeconds > 0 ? ` · ${formatDurationFromSeconds(durationSeconds)}` : ""}
      </p>
      <ConfirmAction
        variant="outline"
        message="Retirer cette vidéo de la leçon ?"
        onConfirm={async () => {
          await clearLessonVideo(lessonId);
          onRemoved();
        }}
        pendingLabel="Suppression…"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Retirer la vidéo
      </ConfirmAction>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet « Lien / URL »
// ---------------------------------------------------------------------------

function ExternalUrlForm({
  lessonId,
  externalVideoUrl,
  durationSeconds,
  onChanged,
}: {
  lessonId: string;
  externalVideoUrl: string | null;
  durationSeconds: number;
  onChanged: () => void;
}) {
  const [url, setUrl] = useState(externalVideoUrl ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (externalVideoUrl) {
    return (
      <ExternalVideoPreview
        lessonId={lessonId}
        src={externalVideoUrl}
        durationSeconds={durationSeconds}
        onRemoved={onChanged}
      />
    );
  }

  async function handleSubmit() {
    setError(null);
    setPending(true);
    try {
      const result = await setLessonExternalVideoUrl(lessonId, url.trim());
      if (!result.success) {
        setError(result.message ?? "Échec.");
        return;
      }
      onChanged();
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://exemple.com/cours/lecon-1.mp4"
          disabled={pending}
        />
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={pending || url.trim().length === 0}
          className="shrink-0"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Link2 className="h-4 w-4" aria-hidden />
          )}
          Utiliser cette vidéo
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Lien direct vers un fichier vidéo (MP4, WebM, MOV). Le lien doit être
        accessible publiquement pour être lu par les élèves.
      </p>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet « Téléverser un fichier » (R2)
// ---------------------------------------------------------------------------

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading"; progress: number }
  | { kind: "saving" }
  | { kind: "error"; message: string };

function R2VideoUploader({
  lessonId,
  externalVideoUrl,
  durationSeconds,
  onChanged,
}: {
  lessonId: string;
  externalVideoUrl: string | null;
  durationSeconds: number;
  onChanged: () => void;
}) {
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (externalVideoUrl) {
    return (
      <ExternalVideoPreview
        lessonId={lessonId}
        src={externalVideoUrl}
        durationSeconds={durationSeconds}
        onRemoved={onChanged}
      />
    );
  }

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
      const presigned = await createPresignedLessonVideoUpload({
        lessonId,
        filename: file.name,
        contentType: videoUploadContentType(file.name, file.type),
        sizeBytes: file.size,
      });
      if (!presigned.ok || !presigned.upload) {
        setState({ kind: "error", message: presigned.message ?? "Préparation échouée." });
        return;
      }

      await putToR2(
        file,
        presigned.upload.uploadUrl,
        videoUploadContentType(file.name, file.type),
        (progress) =>
          setState({ kind: "uploading", progress }),
      );

      setState({ kind: "saving" });
      const saved = await setLessonExternalVideoUrl(
        lessonId,
        presigned.upload.publicUrl,
      );
      if (!saved.success) {
        setState({ kind: "error", message: saved.message ?? "Enregistrement échoué." });
        return;
      }
      setState({ kind: "idle" });
      onChanged();
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur inconnue.",
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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

      {state.kind === "idle" ? (
        <button
          type="button"
          onClick={pickFile}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/40 px-6 py-12 text-center transition-colors hover:border-[color:var(--brand-secondary)]/40 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <UploadCloud className="h-8 w-8 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium text-foreground">
            Cliquer pour téléverser un fichier vidéo
          </span>
          <span className="text-xs text-muted-foreground">
            Tous formats et toutes tailles acceptés par le stockage vidéo.
          </span>
        </button>
      ) : null}

      {state.kind === "uploading" ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Téléversement… {state.progress}%
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-[color:var(--brand-secondary)] transition-all"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {state.kind === "saving" ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Enregistrement…
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

function putToR2(
  file: File,
  url: string,
  contentType: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let serverMessage = "";
        try {
          serverMessage = (JSON.parse(xhr.responseText) as { error?: string }).error ?? "";
        } catch {
          // Une réponse non JSON (par exemple nginx) conserve le message générique.
        }
        reject(
          new Error(
            serverMessage || `Upload échoué (${xhr.status}). Réessayez.`,
          ),
        );
      }
    };
    xhr.onerror = () => reject(new Error("Erreur réseau pendant l'upload."));
    xhr.send(file);
  });
}
