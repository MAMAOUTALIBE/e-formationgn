import "server-only";

// Indexation de la base documentaire d'Aiduca-IA.
//
// `AssistantChunk` est une table DÉRIVÉE : elle est reconstruite intégralement
// à chaque sauvegarde du document parent. Faire des mises à jour incrémentales
// obligerait à réconcilier des positions et laisserait, tôt ou tard, des
// fragments orphelins que la recherche continuerait de servir.
//
// Le `searchVector` n'est pas écrit ici : le trigger Postgres installé par la
// migration `assistant_knowledge` s'en charge à l'INSERT.

import { chunkDocument } from "@/lib/assistant/chunking";
import { prisma } from "@/lib/prisma";

/**
 * Régénère les fragments d'un document.
 *
 * Transactionnel : sans cela, une erreur entre le `deleteMany` et le
 * `createMany` laisserait le document introuvable par la recherche, en silence.
 */
export async function reindexAssistantDocument(documentId: string): Promise<number> {
  const document = await prisma.assistantDocument.findUnique({
    where: { id: documentId },
    select: { id: true, title: true, body: true },
  });
  if (!document) return 0;

  const chunks = chunkDocument(document.body, document.title);

  await prisma.$transaction([
    prisma.assistantChunk.deleteMany({ where: { documentId: document.id } }),
    prisma.assistantChunk.createMany({
      data: chunks.map((chunk) => ({
        documentId: document.id,
        documentTitle: document.title,
        position: chunk.position,
        heading: chunk.heading,
        content: chunk.content,
      })),
    }),
  ]);

  return chunks.length;
}

/** Réindexe toute la base — utilisé par le script d'amorçage. */
export async function reindexAllAssistantDocuments(): Promise<number> {
  const documents = await prisma.assistantDocument.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  let total = 0;
  for (const doc of documents) {
    total += await reindexAssistantDocument(doc.id);
  }
  return total;
}
