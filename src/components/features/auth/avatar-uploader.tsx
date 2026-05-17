"use client";

// Uploader d'avatar — 2 étapes :
//   1. POST /api/upload/avatar  → reçoit { uploadUrl, publicUrl, key }
//   2. PUT direct vers R2 (uploadUrl) avec le fichier brut
//   3. Server action updateAvatarUrl(publicUrl) pour persister sur User
//
// Preview locale avec URL.createObjectURL avant upload pour feedback
// instantané. Validation côté client (type + taille) pour éviter l'aller-retour
// quand le fichier est manifestement trop gros / mauvais format.

import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { updateAvatarUrl } from "@/server/actions/profile";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — doit matcher api/upload/avatar
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

interface AvatarUploaderProps {
  currentUrl: string | null;
  userName: string;
  initials: string;
}

interface UploadPresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export function AvatarUploader({
  currentUrl,
  userName,
  initials,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleFile(file: File) {
    setError(null);
    setFeedback(null);

    // 1) Validation client
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Format non supporté. JPEG, PNG, WebP ou AVIF uniquement.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`Fichier trop lourd (max ${MAX_BYTES / (1024 * 1024)} MB).`);
      return;
    }

    // 2) Preview locale (révoqué quand on remplace ou quand le composant unmount)
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    startTransition(async () => {
      try {
        // 3) Récupère une URL presigned
        const presignResponse = await fetch("/api/upload/avatar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          }),
        });
        if (!presignResponse.ok) {
          const data = (await presignResponse.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? `HTTP ${presignResponse.status}`);
        }
        const presign = (await presignResponse.json()) as UploadPresignResponse;

        // 4) PUT direct sur R2
        const putResponse = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: { "content-type": file.type },
          body: file,
        });
        if (!putResponse.ok) {
          throw new Error(
            `Échec de l'upload vers le stockage (HTTP ${putResponse.status}).`,
          );
        }

        // 5) Server action pour mettre à jour User.image
        const result = await updateAvatarUrl(presign.publicUrl);
        if (!result.success) {
          throw new Error(result.message ?? "Échec de l'enregistrement.");
        }
        setFeedback("Avatar mis à jour ✓");
        setPreviewUrl(presign.publicUrl);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inattendue.");
        // Rollback preview vers l'ancien avatar pour cohérence visuelle.
        setPreviewUrl(currentUrl);
      } finally {
        URL.revokeObjectURL(localPreview);
      }
    });
  }

  function handleRemove() {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await updateAvatarUrl(null);
        if (!result.success) {
          throw new Error(result.message ?? "Échec de la suppression.");
        }
        setPreviewUrl(null);
        setFeedback("Avatar supprimé ✓");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inattendue.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <div className="relative">
        <Avatar
          src={previewUrl}
          alt={userName}
          fallback={initials}
          size={80}
        />
        {pending ? (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50"
            aria-hidden
          >
            <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
          </div>
        ) : null}
      </div>

      <div className="flex-1 space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = ""; // permet de re-sélectionner le même fichier
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            {previewUrl ? (
              <>
                <Camera className="h-4 w-4" aria-hidden /> Changer
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" aria-hidden /> Uploader
              </>
            )}
          </Button>
          {previewUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={handleRemove}
            >
              <Trash2 className="h-4 w-4" aria-hidden /> Retirer
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, WebP ou AVIF · max {MAX_BYTES / (1024 * 1024)} MB.
        </p>

        {error ? (
          <p role="alert" className="text-xs text-[color:var(--brand-danger)]">
            {error}
          </p>
        ) : null}
        {feedback ? (
          <p role="status" className="text-xs text-[color:var(--brand-success)]">
            {feedback}
          </p>
        ) : null}
      </div>
    </div>
  );
}
