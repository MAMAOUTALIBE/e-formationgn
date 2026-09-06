"use client";

import {
  FileUp,
  Loader2,
  Presentation as PresentationIcon,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { PresentationStatus } from "@/generated/prisma/enums";
import {
  MAX_PRESENTATION_BYTES,
  PRESENTATION_ACCEPT_ATTRIBUTE,
  isAllowedPresentationFile,
  presentationFileError,
} from "@/lib/presentation-file";
import { formatFileSize } from "@/lib/resource-file";
import {
  attachPresentationSource,
  deletePresentationSource,
} from "@/server/actions/curriculum";

interface PresentationSummary {
  originalFileName: string;
  sourceSizeBytes: number;
  status: PresentationStatus;
  slideCount: number;
  errorMessage: string | null;
}

interface LessonPresentationManagerProps {
  lessonId: string;
  presentation: PresentationSummary | null;
}

type LocalState =
  | { kind: "idle" }
  | { kind: "uploading"; fileName: string }
  | { kind: "saving"; fileName: string }
  | { kind: "error"; message: string };

const STATUS_COPY: Record<
  PresentationStatus,
  { label: string; description: string }
> = {
  UPLOADED: {
    label: "PowerPoint reçu",
    description: "En attente du service de conversion.",
  },
  PROCESSING: {
    label: "Conversion en cours",
    description: "Les diapositives et leurs liens sont en cours de préparation.",
  },
  READY: {
    label: "Diaporama prêt",
    description: "Le diaporama est disponible dans le lecteur apprenant.",
  },
  ERROR: {
    label: "Échec de la conversion",
    description: "Vous pouvez remplacer le fichier pour relancer le traitement.",
  },
};

export function LessonPresentationManager({
  lessonId,
  presentation,
}: LessonPresentationManagerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<LocalState>({ kind: "idle" });

  useEffect(() => {
    if (
      presentation?.status !== "UPLOADED" &&
      presentation?.status !== "PROCESSING"
    ) {
      return;
    }

    let refreshCount = 0;
    const interval = window.setInterval(() => {
      refreshCount += 1;
      router.refresh();
      // Deux minutes suffisent pour refléter les conversions ordinaires sans
      // laisser un onglet formateur interroger le serveur indéfiniment.
      if (refreshCount >= 24) window.clearInterval(interval);
    }, 5_000);

    return () => window.clearInterval(interval);
  }, [presentation?.status, router]);

  async function handleFile(file: File) {
    if (!isAllowedPresentationFile(file.name)) {
      setState({ kind: "error", message: presentationFileError(file.name) });
      return;
    }
    if (file.size <= 0 || file.size > MAX_PRESENTATION_BYTES) {
      setState({ kind: "error", message: "Le fichier doit peser entre 1 octet et 100 Mo." });
      return;
    }

    setState({ kind: "uploading", fileName: file.name });
    try {
      const authorization = await fetch("/api/upload/lesson-presentation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lessonId,
          filename: file.name,
          sizeBytes: file.size,
        }),
      });
      const payload = (await authorization.json()) as
        | { uploadUrl: string; sourceKey: string; contentType: string }
        | { error: string };
      if (!authorization.ok || !("uploadUrl" in payload)) {
        throw new Error("error" in payload ? payload.error : "Téléversement refusé.");
      }

      const upload = await fetch(payload.uploadUrl, {
        method: "PUT",
        headers: { "content-type": payload.contentType },
        body: file,
      });
      if (!upload.ok) throw new Error("Le stockage n'a pas accepté le fichier.");

      setState({ kind: "saving", fileName: file.name });
      const result = await attachPresentationSource(lessonId, {
        sourceKey: payload.sourceKey,
        originalFileName: file.name,
        sourceSizeBytes: file.size,
      });
      if (!result.success) {
        throw new Error(result.message ?? "Enregistrement du fichier impossible.");
      }

      setState({ kind: "idle" });
      router.refresh();
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Erreur inattendue.",
      });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setState({ kind: "saving", fileName: presentation?.originalFileName ?? "" });
    const result = await deletePresentationSource(lessonId);
    if (!result.success) {
      setState({ kind: "error", message: result.message ?? "Suppression impossible." });
      return;
    }
    setState({ kind: "idle" });
    router.refresh();
  }

  const busy = state.kind === "uploading" || state.kind === "saving";
  const status = presentation ? STATUS_COPY[presentation.status] : null;

  return (
    <div className="space-y-4">
      {presentation && status ? (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              {presentation.status === "ERROR" ? (
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
              ) : presentation.status === "PROCESSING" ? (
                <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[color:var(--brand-secondary)]" aria-hidden />
              ) : (
                <PresentationIcon className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--brand-secondary)]" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="font-medium text-foreground">{status.label}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {presentation.originalFileName} · {formatFileSize(presentation.sourceSizeBytes)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {presentation.status === "READY" && presentation.slideCount > 0
                    ? `${presentation.slideCount} diapositive${presentation.slideCount > 1 ? "s" : ""} prête${presentation.slideCount > 1 ? "s" : ""}.`
                    : status.description}
                </p>
                {presentation.errorMessage ? (
                  <p className="mt-1 text-xs text-destructive">{presentation.errorMessage}</p>
                ) : null}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void remove()}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Retirer
            </Button>
          </div>
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={PRESENTATION_ACCEPT_ATTRIBUTE}
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 px-5 py-8 text-center transition-colors hover:border-[color:var(--brand-secondary)]/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <FileUp className="h-7 w-7 text-muted-foreground" aria-hidden />
        )}
        <span className="text-sm font-medium text-foreground">
          {state.kind === "uploading"
            ? `Téléversement de ${state.fileName}…`
            : state.kind === "saving"
              ? "Vérification du fichier…"
              : presentation
                ? "Remplacer le PowerPoint"
                : "Ajouter un PowerPoint"}
        </span>
        <span className="text-xs text-muted-foreground">.pptx uniquement · 100 Mo maximum</span>
      </button>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Le fichier original est conservé sous une clé privée et aucun lien de téléchargement n&apos;est exposé.
      </p>

      <p className="text-xs text-muted-foreground">
        La conversion démarre automatiquement après le téléversement. Dès qu&apos;elle est terminée, le diaporama devient automatiquement disponible dans le lecteur apprenant.
      </p>

      {state.kind === "error" ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
