"use server";

// Administration d'Aiduca-IA : base documentaire, conversations, prospects.
//
// Conventions du dépôt : autorisation par `adminRolesForScreen` (les rôles de
// l'action ne peuvent donc pas diverger de ceux de la route), Zod `.strict()`,
// `createAuditLog` sur chaque écriture, puis `revalidatePath`.

import { revalidatePath } from "next/cache";

import { seedAssistantKnowledge } from "../../../scripts/seed-assistant-knowledge";
import { requireAnyAdminRole } from "@/lib/auth/authorization";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  assistantDocumentSchema,
  assistantLeadStatusSchema,
} from "@/lib/validators/assistant";
import { adminRolesForScreen } from "@/lib/workspace/admin-screen-roles";
import { reindexAssistantDocument } from "@/server/services/assistant-knowledge";
import { createAuditLog } from "@/server/services/audit-log";

const SCREEN = "/admin/assistant";

export interface AssistantAdminResult {
  success: boolean;
  message?: string;
  documentId?: string;
  fieldErrors?: Record<string, string>;
  /** Saisie réémise pour ne pas perdre le travail sur une erreur de validation. */
  values?: Record<string, string>;
}

function readDocumentForm(formData: FormData) {
  return {
    slug: String(formData.get("slug") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim(),
    body: String(formData.get("body") ?? ""),
    sourceLabel: String(formData.get("sourceLabel") ?? "").trim(),
    sourceUrl: String(formData.get("sourceUrl") ?? "").trim(),
    isPublished: formData.get("isPublished") === "on" ? "true" : "false",
    position: String(formData.get("position") ?? "0"),
  };
}

function toFieldErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Base documentaire
// ---------------------------------------------------------------------------

/**
 * Synchronise les sources publiques livrées avec l'application.
 *
 * Le script CLI n'est pas présent dans l'image Next.js standalone. Cette
 * action rend donc l'amorçage réellement utilisable en production, tout en
 * conservant intacts les documents rédigés manuellement (slugs sans `auto-`).
 */
export async function synchronizeAssistantKnowledge(): Promise<AssistantAdminResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole(...adminRolesForScreen(SCREEN));
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  try {
    const result = await seedAssistantKnowledge({ log: false });

    await createAuditLog({
      actorId: actor.userId,
      action: "assistant.source.synchronize",
      targetType: "AssistantDocument",
      targetId: null,
      metadata: {
        documents: result.documents,
        chunks: result.chunks,
        manualDocuments: result.manualDocuments,
      },
    });

    revalidatePath("/admin/assistant");
    revalidatePath("/admin/assistant/sources");
    return {
      success: true,
      message: `${result.documents} document(s) synchronisé(s), ${result.chunks} fragment(s) indexé(s).`,
    };
  } catch (error) {
    logError("assistant-admin", error, { action: "synchronize" });
    return {
      success: false,
      message: "La synchronisation des sources a échoué.",
    };
  }
}

export async function createAssistantDocument(
  _prev: AssistantAdminResult,
  formData: FormData,
): Promise<AssistantAdminResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole(...adminRolesForScreen(SCREEN));
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  const raw = readDocumentForm(formData);
  const parsed = assistantDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "Corrigez les champs signalés. Votre saisie est conservée.",
      fieldErrors: toFieldErrors(parsed.error.issues),
      values: raw,
    };
  }

  const existing = await prisma.assistantDocument.findUnique({
    where: { slug: parsed.data.slug },
    select: { id: true },
  });
  if (existing) {
    return {
      success: false,
      message: "Un document porte déjà cet identifiant.",
      fieldErrors: { slug: "Identifiant déjà utilisé." },
      values: raw,
    };
  }

  const document = await prisma.assistantDocument.create({
    data: {
      slug: parsed.data.slug,
      title: parsed.data.title,
      category: parsed.data.category,
      body: parsed.data.body,
      sourceLabel: parsed.data.sourceLabel || null,
      sourceUrl: parsed.data.sourceUrl || null,
      isPublished: parsed.data.isPublished,
      position: parsed.data.position,
      updatedById: actor.userId,
    },
    select: { id: true },
  });

  const chunks = await reindexAssistantDocument(document.id);

  await createAuditLog({
    actorId: actor.userId,
    action: "assistant.source.create",
    targetType: "AssistantDocument",
    targetId: document.id,
    metadata: { slug: parsed.data.slug, chunks },
  });

  revalidatePath("/admin/assistant/sources");
  return {
    success: true,
    documentId: document.id,
    message: `Document créé (${chunks} fragment${chunks > 1 ? "s" : ""} indexé${chunks > 1 ? "s" : ""}).`,
  };
}

export async function updateAssistantDocument(
  documentId: string,
  _prev: AssistantAdminResult,
  formData: FormData,
): Promise<AssistantAdminResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole(...adminRolesForScreen(SCREEN));
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  const raw = readDocumentForm(formData);
  const parsed = assistantDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "Corrigez les champs signalés. Votre saisie est conservée.",
      fieldErrors: toFieldErrors(parsed.error.issues),
      values: raw,
    };
  }

  const conflict = await prisma.assistantDocument.findFirst({
    where: { slug: parsed.data.slug, NOT: { id: documentId } },
    select: { id: true },
  });
  if (conflict) {
    return {
      success: false,
      message: "Un autre document porte déjà cet identifiant.",
      fieldErrors: { slug: "Identifiant déjà utilisé." },
      values: raw,
    };
  }

  await prisma.assistantDocument.update({
    where: { id: documentId },
    data: {
      slug: parsed.data.slug,
      title: parsed.data.title,
      category: parsed.data.category,
      body: parsed.data.body,
      sourceLabel: parsed.data.sourceLabel || null,
      sourceUrl: parsed.data.sourceUrl || null,
      isPublished: parsed.data.isPublished,
      position: parsed.data.position,
      updatedById: actor.userId,
    },
  });

  // Réindexation systématique : un document modifié dont les fragments datent
  // de la version précédente ferait répondre l'assistant sur l'ancien texte.
  const chunks = await reindexAssistantDocument(documentId);

  await createAuditLog({
    actorId: actor.userId,
    action: "assistant.source.update",
    targetType: "AssistantDocument",
    targetId: documentId,
    metadata: { slug: parsed.data.slug, chunks },
  });

  revalidatePath("/admin/assistant/sources");
  revalidatePath(`/admin/assistant/sources/${documentId}`);
  return { success: true, documentId, message: "Document mis à jour et réindexé." };
}

export interface AssistantDocumentDraftResult {
  id: string;
  slug: string;
  title: string;
  category: string;
  body: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
  isPublished: boolean;
  position: number;
}

/**
 * Charge un document pour l'éditeur.
 *
 * Une action de lecture plutôt qu'une route API : CLAUDE.md réserve
 * `src/app/api/` aux webhooks, crons et endpoints publics, et le corps d'un
 * document (jusqu'à 50 000 caractères) n'a pas à être transporté dans la liste
 * pour tous les documents à la fois.
 */
export async function getAssistantDocumentDraft(
  documentId: string,
): Promise<AssistantDocumentDraftResult | null> {
  try {
    await requireAnyAdminRole(...adminRolesForScreen(SCREEN));
  } catch {
    return null;
  }

  return prisma.assistantDocument.findUnique({
    where: { id: documentId },
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

export async function deleteAssistantDocument(
  documentId: string,
): Promise<AssistantAdminResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole(...adminRolesForScreen(SCREEN));
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  const document = await prisma.assistantDocument.findUnique({
    where: { id: documentId },
    select: { slug: true },
  });
  if (!document) return { success: false, message: "Document introuvable." };

  // Les fragments partent en cascade (onDelete: Cascade).
  await prisma.assistantDocument.delete({ where: { id: documentId } });

  await createAuditLog({
    actorId: actor.userId,
    action: "assistant.source.delete",
    targetType: "AssistantDocument",
    targetId: documentId,
    metadata: { slug: document.slug },
  });

  revalidatePath("/admin/assistant/sources");
  return { success: true, message: "Document supprimé." };
}

/**
 * Amorce un document depuis une question restée sans réponse.
 *
 * C'est la boucle de correction du dispositif : l'écran « questions sans
 * réponse » ne sert à rien s'il faut recopier la question à la main dans un
 * autre écran pour y répondre.
 */
export async function draftDocumentFromQuestion(
  messageId: string,
): Promise<AssistantAdminResult & { slug?: string; question?: string }> {
  try {
    await requireAnyAdminRole(...adminRolesForScreen(SCREEN));
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  const answer = await prisma.assistantMessage.findUnique({
    where: { id: messageId },
    select: { conversationId: true, createdAt: true },
  });
  if (!answer) return { success: false, message: "Message introuvable." };

  const question = await prisma.assistantMessage.findFirst({
    where: {
      conversationId: answer.conversationId,
      role: "USER",
      createdAt: { lt: answer.createdAt },
    },
    orderBy: { createdAt: "desc" },
    select: { content: true },
  });

  return {
    success: true,
    question: question?.content ?? "",
    slug: slugifyQuestion(question?.content ?? ""),
  };
}

function slugifyQuestion(question: string): string {
  return question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export interface AssistantTranscript {
  id: string;
  startedAt: string;
  escalated: boolean;
  messages: Array<{
    id: string;
    role: "USER" | "ASSISTANT";
    content: string;
    answered: boolean;
    courseSlugs: string[];
  }>;
}

/** Transcript complet d'un fil, chargé à la demande depuis le tiroir admin. */
export async function getAssistantConversationTranscript(
  conversationId: string,
): Promise<AssistantTranscript | null> {
  try {
    await requireAnyAdminRole(...adminRolesForScreen(SCREEN));
  } catch {
    return null;
  }

  const conversation = await prisma.assistantConversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      startedAt: true,
      escalated: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          answered: true,
          courseSlugs: true,
        },
      },
    },
  });
  if (!conversation) return null;

  return {
    id: conversation.id,
    // Sérialisée : une Date ne franchit pas proprement la frontière RSC.
    startedAt: conversation.startedAt.toISOString(),
    escalated: conversation.escalated,
    messages: conversation.messages,
  };
}

export async function deleteAssistantConversation(
  conversationId: string,
): Promise<AssistantAdminResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole(...adminRolesForScreen(SCREEN));
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  try {
    // Les messages partent en cascade ; le prospect éventuel est conservé
    // (conversationId passe à NULL) : effacer un fil ne doit pas faire perdre
    // une demande de rappel en cours de traitement.
    await prisma.assistantConversation.delete({ where: { id: conversationId } });
  } catch (error) {
    logError("assistant-admin", error, { conversationId });
    return { success: false, message: "Suppression impossible." };
  }

  await createAuditLog({
    actorId: actor.userId,
    action: "assistant.conversation.delete",
    targetType: "AssistantConversation",
    targetId: conversationId,
    metadata: null,
  });

  revalidatePath("/admin/assistant/conversations");
  return { success: true, message: "Conversation supprimée." };
}

// ---------------------------------------------------------------------------
// Prospects
// ---------------------------------------------------------------------------

export async function setAssistantLeadStatus(
  leadId: string,
  status: "NEW" | "IN_PROGRESS" | "CLOSED",
  internalNote?: string,
): Promise<AssistantAdminResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole(...adminRolesForScreen(SCREEN));
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  const parsed = assistantLeadStatusSchema.safeParse({
    leadId,
    status,
    ...(internalNote === undefined ? {} : { internalNote }),
  });
  if (!parsed.success) {
    return { success: false, message: "Requête invalide." };
  }

  await prisma.assistantLead.update({
    where: { id: parsed.data.leadId },
    data: {
      status: parsed.data.status,
      handledById: actor.userId,
      handledAt: new Date(),
      ...(parsed.data.internalNote === undefined
        ? {}
        : { internalNote: parsed.data.internalNote || null }),
    },
  });

  await createAuditLog({
    actorId: actor.userId,
    action: "assistant.lead.status",
    targetType: "AssistantLead",
    targetId: parsed.data.leadId,
    metadata: { status: parsed.data.status },
  });

  revalidatePath("/admin/assistant/prospects");
  return { success: true, message: "Statut mis à jour." };
}
