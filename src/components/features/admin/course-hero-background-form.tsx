"use client";

import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { compressImage } from "@/lib/images/compress";
import {
  updateCourseHeroBackground,
  type CourseHeroBackgroundActionResult,
} from "@/server/actions/admin-courses";

const initialState: CourseHeroBackgroundActionResult = { success: false };
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

type Mode = "keep" | "replace" | "default";
type UploadStatus = "idle" | "preparing" | "uploading" | "done" | "error";

export function CourseHeroBackgroundForm({
  courseId,
  currentUrl,
}: {
  courseId: string;
  currentUrl: string | null;
}) {
  const action = updateCourseHeroBackground.bind(null, courseId);
  const [state, formAction] = useActionState(action, initialState);
  const [stagedUrl, setStagedUrl] = useState("");
  const [mode, setMode] = useState<Mode>("keep");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = status === "preparing" || status === "uploading";
  const actionMatchesSelection =
    state.success &&
    state.appliedMode === mode &&
    (mode !== "replace" || state.heroBackgroundUrl === stagedUrl);
  const displayedMode = actionMatchesSelection ? "keep" : mode;
  const savedUrl = currentUrl;
  const previewUrl =
    displayedMode === "replace"
      ? stagedUrl
      : displayedMode === "keep"
        ? savedUrl
        : null;

  async function importImage(file: File) {
    setUploadError(null);
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      setUploadError("Format non supporté. Choisissez une image JPG, PNG, WebP ou AVIF.");
      setStatus("error");
      return;
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      setUploadError("Image trop lourde (12 Mo maximum).");
      setStatus("error");
      return;
    }

    setStatus("preparing");
    const uploadFile = await compressImage(file, { maxWidth: 2560, quality: 0.85 });
    if (uploadFile.size > MAX_IMAGE_BYTES) {
      setUploadError("L’image préparée dépasse 12 Mo.");
      setStatus("error");
      return;
    }

    try {
      const response = await fetch("/api/upload/course-hero-background", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          courseId,
          filename: uploadFile.name,
          contentType: uploadFile.type,
          sizeBytes: uploadFile.size,
        }),
      });
      const payload = (await response.json()) as
        | { uploadUrl: string; publicUrl: string }
        | { error: string };
      if (!response.ok || !("uploadUrl" in payload)) {
        throw new Error("error" in payload ? payload.error : "Échec de la préparation.");
      }

      setStatus("uploading");
      await uploadWithProgress(payload.uploadUrl, uploadFile, setProgress);
      setStagedUrl(payload.publicUrl);
      setMode("replace");
      setStatus("done");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Échec de l’import.");
      setStatus("error");
    }
  }

  function pickImage() {
    inputRef.current?.click();
  }

  return (
    <form action={formAction} className="space-y-2 border-t border-border pt-2">
      <input type="hidden" name="heroBackgroundMode" value={mode} />
      <input type="hidden" name="heroBackgroundUrl" value={stagedUrl} />
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        className="hidden"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importImage(file);
          event.target.value = "";
        }}
      />

      <div>
        <p className="text-sm font-medium text-foreground">
          Image d’arrière-plan du hero
        </p>
        <p className="text-xs text-muted-foreground">
          Propre à cette formation. Le fond actuel reste utilisé sans image personnalisée.
        </p>
      </div>

      <div className="relative aspect-[3/1] overflow-hidden rounded-md border border-border bg-[linear-gradient(125deg,#f1faf6_0%,#f8fcfa_72%,#edf8f2_100%)]">
        {previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Aperçu de l’image d’arrière-plan du hero"
              className="h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-black/55" aria-hidden />
          </>
        ) : (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
            <ImagePlus className="h-4 w-4" aria-hidden />
            Fond par défaut actuel
          </div>
        )}
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 text-xs font-medium text-white">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {status === "preparing" ? "Préparation…" : `Import ${progress}%`}
          </div>
        ) : null}
      </div>

      {displayedMode === "replace" ? (
        <p className="text-xs font-medium text-[color:var(--brand-success)]">
          Nouvelle image — aperçu avant validation
        </p>
      ) : null}

      <fieldset className="space-y-1.5 text-xs">
        <legend className="sr-only">Choix de l’image du hero</legend>
        <label className="flex items-center gap-2 text-foreground">
          <input
            type="radio"
            checked={displayedMode === "keep"}
            onChange={() => setMode("keep")}
          />
          Conserver l’image actuelle
        </label>
        <label className="flex items-center gap-2 text-foreground">
          <input
            type="radio"
            checked={displayedMode === "default"}
            onChange={() => setMode("default")}
          />
          Restaurer l’image par défaut
        </label>
      </fieldset>

      {uploadError ? (
        <p className="text-xs text-destructive" role="alert">{uploadError}</p>
      ) : null}
      {state.message ? (
        <Alert variant={state.success ? "success" : "destructive"} className="py-2">
          <AlertDescription aria-live="polite" className="text-xs">
            {state.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          <Button type="button" variant="outline" size="sm" onClick={pickImage} disabled={busy}>
            <Upload className="h-4 w-4" aria-hidden />
            {savedUrl || stagedUrl ? "Remplacer" : "Importer une image"}
          </Button>
          {previewUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (displayedMode === "replace") {
                  setStagedUrl("");
                  setMode("keep");
                } else {
                  setMode("default");
                }
              }}
              disabled={busy}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {displayedMode === "replace" ? "Retirer la sélection" : "Supprimer l’image actuelle"}
            </Button>
          ) : null}
        </div>
        <SubmitButton size="sm" pendingLabel="Enregistrement…" disabled={busy}>
          Enregistrer
        </SubmitButton>
      </div>
    </form>
  );
}

function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url, true);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`Le stockage a renvoyé HTTP ${request.status}.`));
    };
    request.onerror = () => reject(new Error("Erreur réseau pendant l’import."));
    request.send(file);
  });
}
