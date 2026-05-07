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
