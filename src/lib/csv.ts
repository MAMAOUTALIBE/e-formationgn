// Helpers d'export CSV — utilisés par les Server Actions d'export.
// On délègue à papaparse pour gérer le quoting / encodage proprement.

import Papa from "papaparse";

export function rowsToCsv<T extends Record<string, unknown>>(
  rows: readonly T[],
): string {
  return Papa.unparse(rows as Record<string, unknown>[], {
    header: true,
    quotes: true,
  });
}

export function csvResponseHeaders(filename: string): HeadersInit {
  // Force le téléchargement en proposant un nom de fichier propre.
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
    "Cache-Control": "no-store",
  };
}

/**
 * Réduit un libellé (nom de société) à un fragment de nom de fichier sûr.
 * Les accents sont dépliés puis retirés : un nom de fichier qui traverse
 * Windows, macOS et un client mail ne doit contenir que de l'ASCII.
 */
export function slugifyForFilename(label: string): string {
  const base = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "sans-nom";
}
