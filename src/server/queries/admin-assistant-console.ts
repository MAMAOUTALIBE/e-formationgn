import "server-only";

// Lectures du back-office Aiduca-IA.
//
// Séparé de src/server/queries/assistant.ts : celui-là alimente le modèle et
// ne doit jamais voir de données internes ; celui-ci alimente l'admin et les
// voit toutes. Mélanger les deux dans un même fichier, c'est prendre le risque
// qu'une requête d'admin serve un jour de contexte à l'assistant.

import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Tableau de bord
// ---------------------------------------------------------------------------

export interface AssistantConsoleStats {
  conversations7d: number;
  questions7d: number;
  unanswered: number;
  answerRate: number;
  openLeads: number;
  publishedDocuments: number;
}

export async function getAssistantConsoleStats(): Promise<AssistantConsoleStats> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [conversations7d, questions7d, answered7d, unanswered, openLeads, publishedDocuments] =
    await Promise.all([
      prisma.assistantConversation.count({ where: { startedAt: { gte: since } } }),
      prisma.assistantMessage.count({
        where: { role: "ASSISTANT", createdAt: { gte: since } },
      }),
      prisma.assistantMessage.count({
        where: { role: "ASSISTANT", answered: true, createdAt: { gte: since } },
      }),
      prisma.assistantMessage.count({ where: { role: "ASSISTANT", answered: false } }),
      prisma.assistantLead.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] } } }),
      prisma.assistantDocument.count({ where: { isPublished: true } }),
    ]);

  return {
    conversations7d,
    questions7d,
    unanswered,
    answerRate: questions7d === 0 ? 0 : Math.round((answered7d / questions7d) * 100),
    openLeads,
    publishedDocuments,
  };
}

// ---------------------------------------------------------------------------
// Base documentaire
// ---------------------------------------------------------------------------

export async function listAssistantDocuments(query?: string) {
  const trimmed = query?.trim();
  return prisma.assistantDocument.findMany({
    where: trimmed
      ? {
          OR: [
            { title: { contains: trimmed, mode: "insensitive" } },
            { slug: { contains: trimmed, mode: "insensitive" } },
            { category: { contains: trimmed, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ category: "asc" }, { position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      category: true,
      isPublished: true,
      position: true,
      sourceLabel: true,
      sourceUrl: true,
      updatedAt: true,
      updatedBy: { select: { name: true, email: true } },
      _count: { select: { chunks: true } },
    },
  });
}

export async function getAssistantDocument(id: string) {
  return prisma.assistantDocument.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      category: true,
      body: true,
      sourceLabel: true,
      sourceUrl: true,
      isPublished: true,
      position: true,
    },
  });
}

/** Catégories déjà utilisées, pour proposer l'existant plutôt qu'un champ nu. */
export async function listAssistantCategories(): Promise<string[]> {
  const rows = await prisma.assistantDocument.findMany({
    distinct: ["category"],
    orderBy: { category: "asc" },
    select: { category: true },
  });
  return rows.map((r) => r.category);
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export interface ConversationFilters {
  escalatedOnly?: boolean;
  unansweredOnly?: boolean;
  page?: number;
}

export async function listAssistantConversations(filters: ConversationFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);

  const where = {
    ...(filters.escalatedOnly ? { escalated: true } : {}),
    ...(filters.unansweredOnly
      ? { messages: { some: { role: "ASSISTANT" as const, answered: false } } }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.assistantConversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        publicId: true,
        startedAt: true,
        lastMessageAt: true,
        messageCount: true,
        escalated: true,
        user: { select: { name: true, email: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 1,
          where: { role: "USER" },
          select: { content: true },
        },
        _count: {
          select: { messages: { where: { role: "ASSISTANT", answered: false } } },
        },
      },
    }),
    prisma.assistantConversation.count({ where }),
  ]);

  return { rows, total, page, pageSize: PAGE_SIZE };
}

export async function getAssistantConversation(id: string) {
  return prisma.assistantConversation.findUnique({
    where: { id },
    select: {
      id: true,
      publicId: true,
      startedAt: true,
      lastMessageAt: true,
      escalated: true,
      user: { select: { name: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          certainty: true,
          answered: true,
          courseSlugs: true,
          createdAt: true,
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Questions sans réponse
// ---------------------------------------------------------------------------

/**
 * Une « question sans réponse » est la QUESTION qui précède une réponse
 * incertaine — pas la réponse elle-même. C'est elle que l'équipe doit lire
 * pour décider quoi ajouter à la base documentaire.
 */
export async function listUnansweredQuestions(page = 1) {
  const current = Math.max(1, page);

  const [answers, total] = await Promise.all([
    prisma.assistantMessage.findMany({
      where: { role: "ASSISTANT", answered: false },
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        content: true,
        certainty: true,
        createdAt: true,
        conversationId: true,
      },
    }),
    prisma.assistantMessage.count({ where: { role: "ASSISTANT", answered: false } }),
  ]);

  // La question est le dernier message USER antérieur dans le même fil.
  const questions = await Promise.all(
    answers.map((answer) =>
      prisma.assistantMessage.findFirst({
        where: {
          conversationId: answer.conversationId,
          role: "USER",
          createdAt: { lt: answer.createdAt },
        },
        orderBy: { createdAt: "desc" },
        select: { content: true },
      }),
    ),
  );

  return {
    rows: answers.map((answer, index) => ({
      ...answer,
      question: questions[index]?.content ?? "(question introuvable)",
    })),
    total,
    page: current,
    pageSize: PAGE_SIZE,
  };
}

// ---------------------------------------------------------------------------
// Prospects
// ---------------------------------------------------------------------------

export async function listAssistantLeads(status?: "NEW" | "IN_PROGRESS" | "CLOSED") {
  return prisma.assistantLead.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      message: true,
      status: true,
      internalNote: true,
      createdAt: true,
      handledAt: true,
      conversationId: true,
      course: { select: { slug: true, title: true } },
      handledBy: { select: { name: true, email: true } },
    },
  });
}
