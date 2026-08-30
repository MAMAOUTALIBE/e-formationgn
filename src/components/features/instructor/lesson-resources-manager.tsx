"use client";

// Pièces jointes d'une leçon : vidéos de tout format, PDF, diaporamas,
// tableurs, images, archives, audio.
//
// Même mécanique que la vignette (`ThumbnailUploader`) : presign → PUT direct
// vers le stockage → l'URL obtenue est rattachée à la leçon par une Server
// Action. La différence tient à la liste : on gère plusieurs fichiers, chacun
// enregistré dès la fin de son upload, sans passer par la soumission du
// formulaire de la leçon. Un formateur qui dépose cinq supports puis ferme
// l'onglet ne perd rien.

import { FileText, FileVideo, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatFileSize,
  isAllowedResourceFile,
  isVideoResource,
  lessonResourceHref,
  MAX_RESOURCE_BYTES,
  RESOURCE_ACCEPT_ATTRIBUTE,
  resourceSizeLimitFor,
  resourceUploadContentType,
} from "@/lib/resource-file";
import { cn } from "@/lib/utils";
import {
  addLessonResource,
  deleteLessonResource,
  renameLessonResource,
} from "@/server/actions/curriculum";

export interface LessonResourceRow {
  id: string;
  title: string;
  url: string;
  fileSizeBytes: number | null;
}

interface LessonResourcesManagerProps {
  lessonId: string;
  resources: LessonResourceRow[];
  /** Plafond côté serveur, répété ici pour désactiver la zone quand il est atteint. */
  maxResources?: number;
  /** Réduit la zone de dépôt lorsqu'elle est affichée directement dans le programme. */
  compact?: boolean;
}

/** Fichier en cours de traitement, affiché sous la liste enregistrée. */
interface PendingUpload {
  key: string;
  name: string;
  progress: number;
  phase: "presigning" | "uploading" | "saving";
}

export function LessonResourcesManager({
  lessonId,
  resources,
  maxResources = 20,
  compact = false,
}: LessonResourcesManagerProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState<PendingUpload[]>([]);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const remaining = Math.max(0, maxResources - resources.length - pending.length);
  const isFull = remaining === 0;

  async function uploadOne(file: File, key: string): Promise<string | null> {
    if (!isAllowedResourceFile(file.name, file.type)) {
      return `« ${file.name} » : format non supporté.`;
    }
    // Vidéo → `null`, donc aucun plafond côté application.
    const sizeLimit = resourceSizeLimitFor(file.name, file.type);
    if (file.size <= 0) {
      return `« ${file.name} » : fichier vide.`;
    }
    if (sizeLimit !== null && file.size > sizeLimit) {
      return `« ${file.name} » : fichier trop lourd (max ${Math.round(
        sizeLimit / (1024 * 1024),
      )} Mo).`;
    }

    const contentType = resourceUploadContentType(file.name, file.type);

    setPending((list) => [
      ...list,
      { key, name: file.name, progress: 0, phase: "presigning" },
    ]);

    let presigned: { uploadUrl: string; publicUrl: string };
    try {
      const res = await fetch("/api/upload/lesson-resource", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType,
          sizeBytes: file.size,
        }),
      });
      const json = (await res.json()) as
        | { uploadUrl: string; publicUrl: string }
        | { error: string };
      if (!res.ok) throw new Error("error" in json ? json.error : "Échec serveur.");
      presigned = json as { uploadUrl: string; publicUrl: string };
    } catch (err) {
      return `« ${file.name} » : ${err instanceof Error ? err.message : "échec serveur."}`;
    }

    setPending((list) =>
      list.map((item) => (item.key === key ? { ...item, phase: "uploading" } : item)),
    );

    try {
      await uploadWithProgress(presigned.uploadUrl, file, contentType, (pct) => {
        setPending((list) =>
          list.map((item) => (item.key === key ? { ...item, progress: pct } : item)),
        );
      });
    } catch (err) {
      return `« ${file.name} » : ${err instanceof Error ? err.message : "échec de l'upload."}`;
    }

    setPending((list) =>
      list.map((item) => (item.key === key ? { ...item, phase: "saving" } : item)),
    );

    // Le fichier est en stockage ; c'est cette action qui vérifie la propriété
    // de la leçon et rend la ressource visible à l'élève.
    const result = await addLessonResource(lessonId, {
      title: file.name,
      url: presigned.publicUrl,
      fileSizeBytes: file.size,
    });
    if (!result.success) {
      return `« ${file.name} » : ${result.message ?? "enregistrement refusé."}`;
    }
    return null;
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setErrors([]);

    const accepted = files.slice(0, remaining);
    const rejected = files.length - accepted.length;

    const failures = await Promise.all(
      accepted.map(async (file, index) => {
        const key = `${Date.now()}-${index}-${file.name}`;
        try {
          return await uploadOne(file, key);
        } finally {
          setPending((list) => list.filter((item) => item.key !== key));
        }
      }),
    );

    const messages = failures.filter((message): message is string => Boolean(message));
    if (rejected > 0) {
      messages.push(
        `${rejected} fichier(s) ignoré(s) : maximum ${maxResources} ressources par leçon.`,
      );
    }
    setErrors(messages);
    router.refresh();
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    const result = await deleteLessonResource(id);
    setBusyId(null);
    if (!result.success) {
      setErrors([result.message ?? "Suppression impossible."]);
      return;
    }
    router.refresh();
  }

  async function handleRename(id: string, title: string, previous: string) {
    const trimmed = title.trim();
    if (!trimmed || trimmed === previous) return;
    setBusyId(id);
    const result = await renameLessonResource(id, trimmed);
    setBusyId(null);
    if (!result.success) {
      setErrors([result.message ?? "Renommage impossible."]);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {resources.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {resources.map((resource) => (
            <li key={resource.id} className="flex items-center gap-3 px-3 py-2.5">
              {isVideoResource(resource.url, "") ? (
                <FileVideo className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <Input
                  aria-label={`Nom de la ressource ${resource.title}`}
                  defaultValue={resource.title}
                  maxLength={160}
                  disabled={busyId === resource.id}
                  onBlur={(event) =>
                    void handleRename(resource.id, event.target.value, resource.title)
                  }
                  className="h-8 border-transparent bg-transparent px-1 font-medium hover:border-border focus:border-border"
                />
                <p className="truncate px-1 text-xs text-muted-foreground">
                  {resource.fileSizeBytes ? `${formatFileSize(resource.fileSizeBytes)} · ` : ""}
                  <a
                    href={lessonResourceHref(lessonId, resource.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    Ouvrir
                  </a>
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busyId === resource.id}
                onClick={() => void handleDelete(resource.id)}
                aria-label={`Supprimer ${resource.title}`}
              >
                {busyId === resource.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {pending.length > 0 ? (
        <ul className="space-y-2">
          {pending.map((item) => (
            <li
              key={item.key}
              className="rounded-lg border border-border bg-muted/20 px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <p className="min-w-0 flex-1 truncate text-sm text-foreground">{item.name}</p>
                <span className="text-xs text-muted-foreground">
                  {item.phase === "presigning"
                    ? "Préparation…"
                    : item.phase === "saving"
                      ? "Enregistrement…"
                      : `${item.progress} %`}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-[color:var(--brand-secondary)] transition-all"
                  style={{ width: `${item.phase === "uploading" ? item.progress : 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!isFull) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (isFull) return;
          if (event.dataTransfer.files?.length) void handleFiles(event.dataTransfer.files);
        }}
        onClick={() => !isFull && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && !isFull) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-disabled={isFull}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-center transition-colors",
          compact ? "px-4 py-4" : "px-6 py-8",
          dragOver
            ? "border-[color:var(--brand-secondary)] bg-[color:var(--brand-secondary)]/5"
            : "border-border bg-muted/20 hover:bg-muted/40",
          isFull && "cursor-not-allowed opacity-60",
        )}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-muted-foreground">
          <UploadCloud className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {isFull
            ? `Maximum ${maxResources} ressources atteint`
            : "Cliquez ou glissez vos fichiers"}
        </p>
        <p className="text-xs text-muted-foreground">
          Vidéos de tout format, sans limite de taille — PDF, Word, Excel,
          PowerPoint, images, archives et audio jusqu&apos;à{" "}
          {Math.round(MAX_RESOURCE_BYTES / (1024 * 1024))} Mo
        </p>
        <Button type="button" variant="outline" size="sm" disabled={isFull}>
          Choisir des fichiers
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={RESOURCE_ACCEPT_ATTRIBUTE}
        className="hidden"
        disabled={isFull}
        onChange={(event) => {
          if (event.target.files?.length) void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="space-y-1">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

/**
 * PUT du fichier vers l'URL signée avec progression. XHR et non fetch : fetch
 * n'expose pas la progression d'upload dans tous les navigateurs.
 */
function uploadWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void,
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
      else reject(new Error(`Le stockage a renvoyé HTTP ${xhr.status}.`));
    };
    xhr.onerror = () => reject(new Error("Erreur réseau pendant l'upload."));
    xhr.send(file);
  });
}
