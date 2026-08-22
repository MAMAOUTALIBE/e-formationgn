"use client";

// Surface d'une leçon RESSOURCE — l'équivalent du lecteur vidéo pour un
// document. Les pièces jointes occupent la scène au lieu d'être reléguées
// dans un onglet sous le pavé « contenu disponible plus bas ».
//
// L'aperçu intégré est contraint par la politique de sécurité du site
// (next.config.ts) et cette contrainte est structurante :
//
//   - `object-src 'none'` interdit <object> et <embed> ;
//   - `frame-src 'self'` n'autorise l'<iframe> que sur notre propre origine,
//     donc les PDF servis par /uploads/ mais PAS ceux d'un stockage objet
//     externe ;
//   - `img-src ... https:` laisse en revanche passer les images de partout.
//
//   - `media-src 'self'` autorise la balise <video> sur notre origine.
//
// D'où la règle appliquée ici : image → aperçu toujours ; PDF et vidéo →
// aperçu si le fichier vient de notre origine ; tout le reste → une fiche de
// téléchargement. Tenter l'aperçu hors de ces cas produirait un cadre vide
// que rien n'expliquerait à l'élève.

import { Download, FileText, FileVideo, ImageIcon, Paperclip } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  formatFileSize,
  isVideoResource,
  lessonResourceHref,
  resourceExtensionOf,
} from "@/lib/resource-file";
import { cn } from "@/lib/utils";

export interface StageResource {
  id: string;
  title: string;
  url: string;
  fileSizeBytes: number | null;
  /** Adresse de stockage — sert à deviner le format, jamais à charger. */
  storageUrl?: string;
  /** Variante « pièce jointe » de la même adresse. */
  downloadUrl?: string;
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif", "bmp"]);

function isSameOrigin(url: string): boolean {
  return url.startsWith("/");
}

type Preview = "image" | "pdf" | "video" | "none";

function previewKind(url: string): Preview {
  const extension = resourceExtensionOf(url);
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (extension === "pdf" && isSameOrigin(url)) return "pdf";
  // La balise <video> ne lit pas tous les conteneurs acceptés à l'envoi (MXF,
  // RMVB…) : on la propose quand même, et son propre repli de téléchargement
  // prend le relais si le navigateur ne sait pas décoder le fichier.
  if (isVideoResource(url, "") && isSameOrigin(url)) return "video";
  return "none";
}

export function LessonResourceStage({
  lessonId,
  resources,
  legacyUrl,
  legacyFileName,
}: {
  lessonId: string;
  resources: StageResource[];
  /** Lien unique porté par les leçons antérieures aux pièces jointes. */
  legacyUrl: string | null;
  legacyFileName: string | null;
}) {
  // Les pièces jointes s'ouvrent par la route qui vérifie l'inscription,
  // jamais par leur adresse de stockage. Le lien historique, lui, reste tel
  // quel : il n'a pas d'entrée en base à laquelle rattacher un contrôle.
  const items: StageResource[] =
    resources.length > 0
      ? resources.map((resource) => ({
          ...resource,
          storageUrl: resource.url,
          url: lessonResourceHref(lessonId, resource.id),
          downloadUrl: lessonResourceHref(lessonId, resource.id, true),
        }))
      : legacyUrl
        ? [
            {
              id: "legacy",
              title: legacyFileName ?? "Document de la leçon",
              url: legacyUrl,
              storageUrl: legacyUrl,
              downloadUrl: legacyUrl,
              fileSizeBytes: null,
            },
          ]
        : [];

  const [activeId, setActiveId] = useState(items[0]?.id ?? null);
  const active = items.find((item) => item.id === activeId) ?? items[0] ?? null;

  if (!active) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 bg-card px-6 py-12 text-center">
        <Paperclip className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Aucun document n&apos;est encore attaché à cette leçon.
        </p>
      </div>
    );
  }

  const kind = previewKind(active.storageUrl ?? active.url);

  return (
    <div className="bg-card">
      <div className="border-b border-border bg-muted/30">
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={active.url}
            alt={active.title}
            className="mx-auto max-h-[70vh] w-auto max-w-full object-contain"
          />
        ) : kind === "video" ? (
          <video
            key={active.id}
            src={active.url}
            controls
            preload="metadata"
            className="mx-auto max-h-[70vh] w-full bg-black"
          >
            <a href={active.url} download>
              Télécharger la vidéo
            </a>
          </video>
        ) : kind === "pdf" ? (
          <iframe
            key={active.id}
            src={active.url}
            title={active.title}
            className="h-[70vh] w-full border-0 bg-white"
          />
        ) : (
          <div className="flex min-h-[38vh] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-card text-muted-foreground">
              {isVideoResource(active.storageUrl ?? active.url, "") ? (
                <FileVideo className="h-7 w-7" aria-hidden />
              ) : (
                <FileText className="h-7 w-7" aria-hidden />
              )}
            </span>
            <div>
              <p className="text-base font-medium text-foreground">{active.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {resourceExtensionOf(active.storageUrl ?? active.url).toUpperCase() || "Document"}
                {active.fileSizeBytes
                  ? ` · ${formatFileSize(active.fileSizeBytes)}`
                  : ""}
                {" — ce format s'ouvre dans votre lecteur habituel."}
              </p>
            </div>
            <Button asChild>
              <a href={active.downloadUrl ?? active.url} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
                Ouvrir le document
              </a>
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
        {items.length > 1 ? (
          <div
            role="tablist"
            aria-label="Documents de la leçon"
            className="flex min-w-0 flex-wrap gap-1"
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === active.id}
                onClick={() => setActiveId(item.id)}
                className={cn(
                  "flex max-w-56 items-center gap-1.5 truncate rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  item.id === active.id
                    ? "border-[color:var(--brand-secondary)] bg-[color:var(--brand-secondary)]/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {previewKind(item.storageUrl ?? item.url) === "image" ? (
                  <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                ) : isVideoResource(item.storageUrl ?? item.url, "") ? (
                  <FileVideo className="h-3.5 w-3.5 shrink-0" aria-hidden />
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                )}
                <span className="truncate">{item.title}</span>
              </button>
            ))}
          </div>
        ) : null}

        <Button asChild size="sm" variant="outline" className="ml-auto">
          <a href={active.downloadUrl ?? active.url} target="_blank" rel="noopener noreferrer">
            <Download className="h-4 w-4" />
            Télécharger
            {active.fileSizeBytes ? (
              <span className="text-muted-foreground">
                {" "}
                ({formatFileSize(active.fileSizeBytes)})
              </span>
            ) : null}
          </a>
        </Button>
      </div>
    </div>
  );
}
