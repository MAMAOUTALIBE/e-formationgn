// Analyse d'une liste d'élèves collée ou importée depuis un tableur.
//
// Écrit à la main plutôt qu'avec une bibliothèque : le besoin est étroit
// (3 à 4 colonnes) mais les fichiers réels sont sales. Un export Excel
// français utilise le point-virgule, ajoute un BOM UTF-8 en tête et des fins
// de ligne CRLF ; les copier-coller depuis Google Sheets arrivent en
// tabulations. Tout cela est géré ici.

export interface ParsedStudentRow {
  /** Numéro de ligne dans le fichier d'origine, pour situer une erreur. */
  line: number;
  firstName: string;
  lastName: string;
  email: string;
}

export interface CsvParseResult {
  rows: ParsedStudentRow[];
  /** Lignes rejetées, avec la raison — affichées telles quelles à l'admin. */
  errors: Array<{ line: number; reason: string }>;
}

/** Nombre maximal de lignes traitées en une fois — voir le commentaire d'import. */
export const MAX_IMPORT_ROWS = 50;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Détecte le séparateur d'après la première ligne non vide. */
function detectDelimiter(sample: string): string {
  const counts = [
    { d: ";", n: (sample.match(/;/g) ?? []).length },
    { d: "\t", n: (sample.match(/\t/g) ?? []).length },
    { d: ",", n: (sample.match(/,/g) ?? []).length },
  ];
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ";";
}

/** Découpe une ligne en respectant les champs entre guillemets. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Guillemet doublé à l'intérieur d'un champ cité = guillemet littéral.
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((c) => c.trim());
}

/** Une ligne d'en-tête ne contient pas d'adresse email. */
function looksLikeHeader(cells: string[]): boolean {
  return !cells.some((c) => EMAIL_PATTERN.test(c));
}

/**
 * Analyse le contenu collé.
 *
 * Colonnes attendues : prénom, nom, email. Les comptes internes sont créés
 * depuis l'espace « Équipe & accès », jamais depuis un import d'apprenants.
 */
export function parseStudentCsv(raw: string): CsvParseResult {
  const rows: ParsedStudentRow[] = [];
  const errors: CsvParseResult["errors"] = [];

  // Retire le BOM UTF-8 qu'Excel place en tête, sinon le premier champ
  // commence par un caractère invisible et le prénom est corrompu.
  const text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");

  const firstContent = lines.find((l) => l.trim() !== "") ?? "";
  const delimiter = detectDelimiter(firstContent);

  const seen = new Set<string>();
  let headerSkipped = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;

    const cells = splitLine(line, delimiter);

    if (!headerSkipped && looksLikeHeader(cells)) {
      headerSkipped = true;
      continue;
    }

    const lineNumber = i + 1;

    if (cells.length < 3) {
      errors.push({
        line: lineNumber,
        reason: "Il faut au moins trois colonnes : prénom, nom, email.",
      });
      continue;
    }

    const [firstName, lastName, email, roleCell] = cells;
    const normalizedEmail = email.toLowerCase();

    if (!firstName) {
      errors.push({ line: lineNumber, reason: "Prénom manquant." });
      continue;
    }
    if (!lastName) {
      errors.push({ line: lineNumber, reason: "Nom manquant." });
      continue;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      errors.push({ line: lineNumber, reason: `Email invalide : « ${email} ».` });
      continue;
    }
    if (roleCell && /formateur|instructor|admin|gestionnaire|manager|support|finance|moderateur|modérateur/i.test(roleCell)) {
      errors.push({
        line: lineNumber,
        reason:
          "Un compte interne ne peut pas être importé comme apprenant. Utilisez « Équipe & accès ».",
      });
      continue;
    }
    // Doublon interne au fichier : le signaler ici évite un échec obscur de
    // contrainte d'unicité au milieu de l'import.
    if (seen.has(normalizedEmail)) {
      errors.push({
        line: lineNumber,
        reason: `Email en double dans le fichier : ${normalizedEmail}.`,
      });
      continue;
    }
    seen.add(normalizedEmail);

    rows.push({
      line: lineNumber,
      firstName,
      lastName,
      email: normalizedEmail,
    });
  }

  return { rows, errors };
}
