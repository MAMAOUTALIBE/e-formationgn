export interface PersistentMediaReferenceSnapshot {
  counts: Record<string, number>;
  structuredDocuments: unknown[];
}

export function structuredValueContainsUrl(value: unknown, url: string): boolean {
  if (value === url) return true;
  if (Array.isArray(value)) return value.some((item) => structuredValueContainsUrl(item, url));
  if (typeof value === "object" && value !== null) {
    return Object.values(value).some((item) => structuredValueContainsUrl(item, url));
  }
  return false;
}

export function hasPersistentMediaReference(snapshot: PersistentMediaReferenceSnapshot, url: string): boolean {
  return Object.values(snapshot.counts).some((count) => count > 0)
    || snapshot.structuredDocuments.some((document) => structuredValueContainsUrl(document, url));
}

export interface PersistentMediaBatchReader {
  scalarUrls: (candidates: string[]) => Promise<string[]>;
  embeddedTexts: (candidates: string[]) => Promise<string[]>;
  hasUnfilterableStructuredMedia: () => Promise<boolean>;
}

/** Résout toutes les références en trois lectures, indépendamment du nombre d'URL. */
export async function resolvePersistentMediaReferences(
  candidates: string[],
  reader: PersistentMediaBatchReader,
): Promise<Set<string>> {
  const unique = [...new Set(candidates)];
  if (unique.length === 0) return new Set();
  const [scalarUrls, texts, structuredRisk] = await Promise.all([
    reader.scalarUrls(unique),
    reader.embeddedTexts(unique),
    reader.hasUnfilterableStructuredMedia(),
  ]);
  const referenced = new Set(scalarUrls.filter((url) => unique.includes(url)));
  for (const candidate of unique) {
    if (texts.some((text) => text.includes(candidate))) referenced.add(candidate);
  }
  // JSON imbriqué non indexé : pas de full scan. On conserve tout plutôt que
  // de risquer un faux négatif ou une complexité proportionnelle aux lignes.
  if (structuredRisk) for (const candidate of unique) referenced.add(candidate);
  return referenced;
}
