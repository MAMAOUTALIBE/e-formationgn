"use client";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { uploadWithProgress } from "@/components/features/instructor/thumbnail-uploader";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/images/compress";
import { cn } from "@/lib/utils";

interface QuizImageInputProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  compact?: boolean;
  label: string;
}

export function QuizImageInput({ value, onChange, disabled, compact, label }: QuizImageInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!file.type.startsWith("image/") || /svg/i.test(file.type)) {
      setError("Choisissez une image PNG, JPG ou WebP.");
      return;
    }
    setBusy(true);
    try {
      const prepared = await compressImage(file, { maxWidth: 2000, quality: 0.88 });
      const response = await fetch("/api/upload/course-thumbnail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: prepared.name,
          contentType: prepared.type,
          sizeBytes: prepared.size,
        }),
      });
      const body = (await response.json()) as { uploadUrl?: string; publicUrl?: string; error?: string };
      if (!response.ok || !body.uploadUrl || !body.publicUrl) {
        throw new Error(body.error ?? "Impossible de préparer le téléversement.");
      }
      await uploadWithProgress(body.uploadUrl, prepared, prepared.type, () => undefined);
      onChange(body.publicUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Échec du téléversement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className={cn("relative overflow-hidden rounded-md border bg-muted", compact ? "aspect-[4/3]" : "aspect-video")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="h-full w-full object-contain" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute right-2 top-2"
            onClick={() => onChange("")}
            aria-label={`Retirer ${label}`}
            disabled={disabled || busy}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className={cn("w-full border-dashed", compact ? "h-24" : "h-28")}
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {busy ? "Téléversement…" : label}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        className="hidden"
        disabled={disabled || busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.currentTarget.value = "";
        }}
      />
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
