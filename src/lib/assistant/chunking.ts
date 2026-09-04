// Découpage des documents de la base documentaire en fragments indexables.
//
// Pourquoi découper plutôt qu'indexer le document entier : les CGV et la
// politique de confidentialité font plusieurs milliers de caractères. Indexées
// d'un bloc, elles remontent sur presque toutes les requêtes et noient le
// contexte envoyé au modèle. Fragmentées, seule la section pertinente remonte.
//
// Module pur — testé sans base (tests/unit/assistant-retrieval.test.ts).

export interface DocumentChunk {
  position: number;
  heading: string | null;
  content: string;
}

/**
 * Taille visée d'un fragment. Assez large pour qu'une réponse de FAQ tienne
 * d'un tenant, assez petite pour qu'une dizaine de fragments tiennent dans le
 * prompt sans le saturer.
 */
const MAX_CHUNK_CHARS = 1200;

/** En dessous, on préfère recoller au fragment précédent qu'isoler une miette. */
const MIN_CHUNK_CHARS = 80;

/**
 * Reconnaît un titre de section : soit un titre markdown (`## Titre`), soit une
 * ligne courte terminée par « : » — la forme utilisée par les pages CMS du
 * dépôt, qui sont du texte brut et non du markdown.
 */
function readHeading(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;

  const markdown = /^#{1,6}\s+(.*)$/.exec(trimmed);
  if (markdown) return markdown[1].trim() || null;

  if (trimmed.length <= 90 && trimmed.endsWith(":") && !trimmed.includes(". ")) {
    return trimmed.slice(0, -1).trim() || null;
  }

  return null;
}

/**
 * Découpe un document en fragments, en respectant d'abord ses titres de
 * section, puis ses paragraphes quand une section dépasse `MAX_CHUNK_CHARS`.
 *
 * Déterministe : le même corps produit toujours les mêmes fragments, ce qui
 * rend la réindexation idempotente et le test stable.
 */
export function chunkDocument(body: string, title: string): DocumentChunk[] {
  const normalized = body.replace(/\r\n/g, "\n").trim();
  if (normalized.length === 0) return [];

  // 1) Regroupement par titre de section.
  const sections: Array<{ heading: string | null; lines: string[] }> = [
    { heading: null, lines: [] },
  ];
  for (const line of normalized.split("\n")) {
    const heading = readHeading(line);
    if (heading) {
      sections.push({ heading, lines: [] });
    } else {
      sections[sections.length - 1].lines.push(line);
    }
  }

  // 2) Découpage par paragraphes à l'intérieur des sections trop longues.
  const chunks: DocumentChunk[] = [];
  for (const section of sections) {
    const text = section.lines.join("\n").trim();
    if (text.length === 0) continue;

    for (const piece of splitByLength(text)) {
      chunks.push({
        position: chunks.length,
        heading: section.heading ?? title,
        content: piece,
      });
    }
  }

  // Un document sans aucun titre ni paragraphe exploitable reste indexable
  // sous son propre titre plutôt que de disparaître silencieusement.
  if (chunks.length === 0) {
    chunks.push({ position: 0, heading: title, content: normalized });
  }

  return chunks;
}

function splitByLength(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text];

  const pieces: string[] = [];
  let current = "";

  for (const paragraph of text.split(/\n{2,}/)) {
    const candidate = current.length === 0 ? paragraph : `${current}\n\n${paragraph}`;

    if (candidate.length <= MAX_CHUNK_CHARS) {
      current = candidate;
      continue;
    }

    if (current.length >= MIN_CHUNK_CHARS) {
      pieces.push(current);
      current = "";
    }

    // Un paragraphe seul plus long que la limite est coupé sur les frontières
    // de phrase — jamais au milieu d'un mot.
    if (paragraph.length > MAX_CHUNK_CHARS) {
      pieces.push(...splitSentences(paragraph));
      current = "";
    } else {
      current = current.length === 0 ? paragraph : `${current}\n\n${paragraph}`;
    }
  }

  if (current.trim().length > 0) pieces.push(current);
  return pieces.filter((p) => p.trim().length > 0);
}

function splitSentences(paragraph: string): string[] {
  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  const pieces: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current.length === 0 ? sentence : `${current} ${sentence}`;
    if (candidate.length <= MAX_CHUNK_CHARS) {
      current = candidate;
    } else {
      if (current.length > 0) pieces.push(current);
      // Une phrase (ou un bloc sans ponctuation) peut elle-même dépasser la
      // limite. L'ancienne implémentation n'en conservait que les 1 200
      // premiers caractères et supprimait silencieusement toute la suite.
      // On la découpe donc sur le dernier espace disponible ; un mot isolé de
      // plus de 1 200 caractères est le seul cas où une coupe brute est
      // inévitable.
      if (sentence.length > MAX_CHUNK_CHARS) {
        pieces.push(...splitOversizedSentence(sentence));
        current = "";
      } else {
        current = sentence;
      }
    }
  }

  if (current.trim().length > 0) pieces.push(current);
  return pieces;
}

function splitOversizedSentence(sentence: string): string[] {
  const pieces: string[] = [];
  let remaining = sentence.trim();

  while (remaining.length > MAX_CHUNK_CHARS) {
    const window = remaining.slice(0, MAX_CHUNK_CHARS + 1);
    const whitespace = Math.max(window.lastIndexOf(" "), window.lastIndexOf("\n"));
    const cutAt = whitespace > 0 ? whitespace : MAX_CHUNK_CHARS;
    const piece = remaining.slice(0, cutAt).trim();
    if (piece.length > 0) pieces.push(piece);
    remaining = remaining.slice(cutAt).trimStart();
  }

  if (remaining.length > 0) pieces.push(remaining);
  return pieces;
}
