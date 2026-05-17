"use client";

import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThumbnailUploaderProps {
  /** Nom du champ caché qui contient l'URL finale (sera lu par le formulaire). */
  name: string;
  /** URL initiale (en mode édition). */
  defaultValue?: string;
  /** Désactive l'uploader pendant que le form est en cours de soumission. */
  disabled?: boolean;
  /** Texte d'aide affiché sous la zone. */
  hint?: string;
  className?: string;
  /** Affiche le badge "Optionnel" et un message plus rassurant (par défaut: false). */
  optional?: boolean;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

type Status = "idle" | "presigning" | "uploading" | "done" | "error";

export function ThumbnailUploader({
  name,
  defaultValue,
  disabled,
  hint,
  className,
  optional,
}: ThumbnailUploaderProps) {
  const [url, setUrl] = React.useState(defaultValue ?? "");
  const [status, setStatus] = React.useState<Status>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const isBusy = status === "presigning" || status === "uploading";
  const fullyDisabled = disabled || isBusy;

  async function handleFile(file: File) {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Format non supporté. Utilisez JPEG, PNG, WebP ou AVIF.");
      setStatus("error");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Fichier trop lourd (max 5 MB).");
      setStatus("error");
      return;
    }

    setStatus("presigning");
    setProgress(0);

    let presigned: { uploadUrl: string; publicUrl: string };
    try {
      const res = await fetch("/api/upload/course-thumbnail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      const json = (await res.json()) as
        | { uploadUrl: string; publicUrl: string }
        | { error: string };
      if (!res.ok) {
        throw new Error("error" in json ? json.error : "Échec serveur.");
      }
      presigned = json as { uploadUrl: string; publicUrl: string };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec serveur.");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    try {
      await uploadWithProgress(presigned.uploadUrl, file, setProgress);
      setUrl(presigned.publicUrl);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec d'upload R2.");
      setStatus("error");
    }
  }

  function reset() {
    setUrl("");
    setStatus("idle");
    setError(null);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onPick() {
    inputRef.current?.click();
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (fullyDisabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  const isStorageError = error?.toLowerCase().includes("stockage non configur");

  return (
    <div className={cn("space-y-2", className)}>
      <input type="hidden" name={name} value={url} />

      {url ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="relative aspect-video w-full bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Aperçu" className="h-full w-full object-cover" />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-3 py-2">
            <p className="truncate text-xs text-muted-foreground">{url}</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onPick}
                disabled={fullyDisabled}
              >
                Remplacer
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={reset}
                disabled={fullyDisabled}
                aria-label="Supprimer l'image"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!fullyDisabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !fullyDisabled && onPick()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !fullyDisabled) {
              e.preventDefault();
              onPick();
            }
          }}
          aria-disabled={fullyDisabled}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragOver
              ? "border-[color:var(--brand-secondary)] bg-[color:var(--brand-secondary)]/5"
              : "border-border bg-muted/20 hover:bg-muted/40",
            fullyDisabled && "cursor-not-allowed opacity-60",
          )}
        >
          {isBusy ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <div className="w-full max-w-xs">
                <p className="text-sm font-medium text-foreground">
                  {status === "presigning" ? "Préparation…" : `Upload ${progress}%`}
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-[color:var(--brand-secondary)] transition-all"
                    style={{ width: `${status === "uploading" ? progress : 0}%` }}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-muted-foreground">
                <ImagePlus className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Cliquez ou glissez une image
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  JPEG / PNG / WebP / AVIF — 5 MB max — 16:9 recommandé
                </p>
                {optional ? (
                  <p className="mt-1 text-xs italic text-muted-foreground">
                    Optionnel — vous pourrez l&apos;ajouter plus tard.
                  </p>
                ) : null}
              </div>
              <Button type="button" variant="outline" size="sm" disabled={fullyDisabled}>
                <Upload className="mr-2 h-4 w-4" />
                Choisir un fichier
              </Button>
            </>
          )}
        </div>
      )}

      {/* Fallback : URL externe en cas d'erreur d'upload (R2 KO ou autre) */}
      {isStorageError ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs">
          <p className="font-medium text-amber-900">
            L&apos;upload vers le serveur n&apos;est pas configuré.
          </p>
          <p className="mt-1 text-amber-800">
            Vous pouvez : 1) coller directement une URL d&apos;image ci-dessous,
            2) passer cette étape (l&apos;image sera demandée avant publication).
          </p>
          <input
            type="url"
            placeholder="https://example.com/photo.jpg"
            defaultValue={url}
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value && /^https?:\/\//.test(value)) {
                setUrl(value);
                setStatus("done");
                setError(null);
              }
            }}
            className="mt-2 w-full rounded-md border border-amber-300 bg-white px-3 py-1.5 text-foreground placeholder:text-muted-foreground"
          />
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        disabled={fullyDisabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * PUT du fichier vers une URL signée R2 avec progression.
 * On utilise XHR plutôt que fetch car fetch n'expose pas la progression
 * d'upload dans tous les navigateurs.
 */
function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`R2 a renvoyé HTTP ${xhr.status}.`));
    };
    xhr.onerror = () => reject(new Error("Erreur réseau pendant l'upload."));
    xhr.send(file);
  });
}
