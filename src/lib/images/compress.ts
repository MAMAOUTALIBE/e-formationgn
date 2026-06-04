// Compression / recadrage d'image côté client (canvas), avant upload.
// Réduit le poids des fichiers (donc le temps d'upload + le stockage) et
// normalise le ratio. Tourne uniquement dans le navigateur.

interface CompressOptions {
  /** Ratio cible (largeur/hauteur). Ex: 16/9. Omis = conserve le ratio. */
  aspectRatio?: number;
  /** Largeur max en pixels (downscale si plus large). */
  maxWidth?: number;
  /** Qualité WebP (0–1). */
  quality?: number;
}

/**
 * Compresse une image et, si `aspectRatio` est fourni, la recadre au centre
 * à ce ratio. Retourne un nouveau File WebP. En cas d'échec ou de format non
 * gérable (GIF animé, SVG, non-image), retourne le fichier d'origine inchangé.
 */
export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;
  // GIF (animation) et SVG (vectoriel) : ne pas rasteriser → on garde l'original.
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

  const maxWidth = opts.maxWidth ?? 1920;
  const quality = opts.quality ?? 0.85;

  try {
    const bitmap = await createImageBitmap(file);
    let sx = 0;
    let sy = 0;
    let sw = bitmap.width;
    let sh = bitmap.height;

    if (opts.aspectRatio) {
      const ratio = sw / sh;
      if (ratio > opts.aspectRatio) {
        // Trop large → on rogne la largeur (centré).
        const newW = sh * opts.aspectRatio;
        sx = (sw - newW) / 2;
        sw = newW;
      } else if (ratio < opts.aspectRatio) {
        // Trop haut → on rogne la hauteur (centré).
        const newH = sw / opts.aspectRatio;
        sy = (sh - newH) / 2;
        sh = newH;
      }
    }

    const outW = Math.round(Math.min(maxWidth, sw));
    const outH = Math.round(opts.aspectRatio ? outW / opts.aspectRatio : (outW / sw) * sh);

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, outW, outH);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (!blob) return file;

    // Si aucun recadrage demandé et que la compression n'aide pas, garder l'original.
    if (!opts.aspectRatio && blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch {
    return file;
  }
}
