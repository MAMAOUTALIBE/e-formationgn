"use server";

// Aiduca-IA — actions publiques.
//
// Accessibles aux visiteurs anonymes : les questions avant-vente (tarifs,
// prérequis, comment s'inscrire) viennent presque toutes de gens qui n'ont pas
// encore de compte. Le précédent d'une action publique dans ce dépôt est
// `subscribeNewsletter`, dont on reprend les garde-fous : Zod strict, IP
// hachée, limite de débit.
//
// Un Server Action poste sur l'URL de la page courante, déjà autorisée par
// `authorized` pour les pages publiques : aucune entrée n'est à ajouter dans
// src/auth.config.ts ni dans src/proxy.ts.

import { cookies } from "next/headers";
import { nanoid } from "nanoid";

import { auth } from "@/auth";
import { isAiducaAssistantConfigured, askAiducaAssistant } from "@/lib/ai/assistant";
import {
  buildUnavailableAnswer,
  type AssistantAnswer,
} from "@/lib/assistant/contract";
import {
  buildContactProspectMessage,
  contactAssistantLeadSchema,
  type ContactAssistantLeadInput,
} from "@/lib/assistant/contact-prospect";
import { checkIpRateLimit, checkUserRateLimit, clientIpHash, rateLimitMessage } from "@/lib/auth/rate-limit-ip";
import { BRAND } from "@/lib/brand";
import { sendTransactionalEmail } from "@/lib/email/client";
import { renderBrandedEmail } from "@/lib/email/templates";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  assistantLeadSchema,
  assistantQuestionSchema,
} from "@/lib/validators/assistant";
import {
  buildAssistantContext,
  buildCentreFactsBlock,
} from "@/server/services/assistant-retrieval";

const CONVERSATION_COOKIE = "aiduca_conv";
/** Durée de vie du cookie, alignée sur la rétention des conversations. */
const CONVERSATION_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

/** Tours renvoyés au modèle et réaffichés à la réouverture du widget. */
const HISTORY_TURNS = 12;

/**
 * Plafond global journalier.
 *
 * Un widget public sur toutes les pages est une surface de coût : sans borne
 * absolue, un script distribué sur de nombreuses IP contourne les limites par
 * IP. Ce compteur est le dernier filet — il protège la facture, pas l'UX.
 */
const GLOBAL_DAILY_MAX = 2000;

export interface AssistantMessageView {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  courseSlugs: string[];
  courses: Array<{ slug: string; title: string; url: string }>;
  offerAdvisor: boolean;
  suggestions: string[];
}

export interface AssistantAskResult {
  ok: boolean;
  message?: string;
  answer?: AssistantAnswer;
}

// ---------------------------------------------------------------------------
// Poser une question
// ---------------------------------------------------------------------------

export async function askAssistant(input: {
  question: string;
  courseSlug?: string;
}): Promise<AssistantAskResult> {
  if (!isAiducaAssistantConfigured()) {
    return {
      ok: false,
      message: "L'assistant n'est pas disponible pour le moment.",
    };
  }

  const parsed = assistantQuestionSchema.safeParse({
    question: input.question,
    ...(input.courseSlug ? { courseSlug: input.courseSlug } : {}),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Question invalide.",
    };
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  const limit = userId
    ? await checkUserRateLimit({
        prefix: "assistant",
        userId,
        windowMs: 60 * 60 * 1000,
        max: 40,
      })
    : await checkIpRateLimit({
        prefix: "assistant",
        windowMs: 10 * 60 * 1000,
        max: 10,
      });

  if (!limit.ok) {
    return { ok: false, message: rateLimitMessage(limit.resetAt) };
  }

  const day = new Date().toISOString().slice(0, 10);
  const globalLimit = await checkRateLimit({
    key: `assistant:global:${day}`,
    windowMs: 24 * 60 * 60 * 1000,
    max: GLOBAL_DAILY_MAX,
  });
  if (!globalLimit.ok) {
    return {
      ok: false,
      message:
        "L'assistant reçoit un volume inhabituel de questions. Contactez " +
        `l'équipe Aiduca au ${BRAND.phone} ou à ${BRAND.email}.`,
    };
  }

  let conversationId: string | null = null;
  const startedAt = Date.now();

  try {
    const conversation = await resolveConversation(userId);
    conversationId = conversation.id;
    const historyNewestFirst = await prisma.assistantMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: [{ createdAt: "desc" }, { role: "desc" }],
      take: HISTORY_TURNS,
      select: { role: true, content: true },
    });
    const history = historyNewestFirst.reverse();

    const context = await buildAssistantContext(parsed.data.question, {
      courseSlug: parsed.data.courseSlug ?? null,
    });

    const result = await askAiducaAssistant({
      question: parsed.data.question,
      context,
      centreFacts: buildCentreFactsBlock(),
      history,
    });
    const latencyMs = Date.now() - startedAt;

    try {
      await persistExchange({
        conversationId: conversation.id,
        question: parsed.data.question,
        answer: result,
        latencyMs,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cacheReadTokens: result.cacheReadTokens,
      });
    } catch (error) {
      // Une panne de journalisation ne doit pas jeter une réponse déjà obtenue
      // et facturée. Elle est remontée aux logs pour intervention.
      logError("assistant-persistence", error, { conversationId: conversation.id });
    }

    return { ok: true, answer: stripUsage(result) };
  } catch (error) {
    // Le détail d'une panne (clé invalide, base injoignable) ne doit jamais
    // ressortir vers un visiteur anonyme.
    logError("assistant", error, { userId: userId ?? undefined });
    const fallback = buildUnavailableAnswer(
      "Je n'arrive pas à répondre pour l'instant. Un conseiller Aiduca peut " +
        "vous aider directement.",
    );

    // Quand le modèle ou la récupération échoue après la création du fil, on
    // conserve la question et le repli. Le conseiller retrouve ainsi le vrai
    // contexte de la demande, et l'équipe voit la question dans la file « sans
    // réponse » au lieu d'un fil vide.
    if (conversationId) {
      try {
        await persistExchange({
          conversationId,
          question: parsed.data.question,
          answer: fallback,
          latencyMs: Date.now() - startedAt,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
        });
      } catch (persistenceError) {
        logError("assistant-persistence", persistenceError, { conversationId });
      }
    }

    return { ok: true, answer: fallback };
  }
}

function stripUsage(result: AssistantAnswer): AssistantAnswer {
  return {
    text: result.text,
    certainty: result.certainty,
    answered: result.answered,
    offerAdvisor: result.offerAdvisor,
    courses: result.courses,
    suggestions: result.suggestions,
    sourceIds: result.sourceIds,
  };
}

// ---------------------------------------------------------------------------
// Historique
// ---------------------------------------------------------------------------

/** Recharge le fil courant à l'ouverture du widget. */
export async function loadAssistantHistory(): Promise<AssistantMessageView[]> {
  const jar = await cookies();
  const publicId = jar.get(CONVERSATION_COOKIE)?.value;
  if (!publicId) return [];

  const conversation = await prisma.assistantConversation.findUnique({
    where: { publicId },
    select: {
      messages: {
        orderBy: [{ createdAt: "desc" }, { role: "desc" }],
        take: HISTORY_TURNS,
        select: {
          id: true,
          role: true,
          content: true,
          courseSlugs: true,
          answered: true,
        },
      },
    },
  });
  if (!conversation) return [];

  // `take` doit porter sur la fin du fil, puis l'affichage revient dans
  // l'ordre chronologique. Trier directement en ASC renverrait les 12 tout
  // premiers messages d'une longue conversation.
  const messages = conversation.messages.reverse();

  const slugs = [...new Set(messages.flatMap((m) => m.courseSlugs))];
  const courses =
    slugs.length > 0
      ? await prisma.course.findMany({
          where: { slug: { in: slugs }, status: "PUBLISHED" },
          select: { slug: true, title: true },
        })
      : [];
  const bySlug = new Map(courses.map((c) => [c.slug, c]));

  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    courseSlugs: message.courseSlugs,
    // Une formation dépubliée depuis l'échange ne doit plus produire de bouton.
    courses: message.courseSlugs
      .map((slug) => bySlug.get(slug))
      .filter((c): c is { slug: string; title: string } => Boolean(c))
      .map((c) => ({ slug: c.slug, title: c.title, url: `/cours/${c.slug}` })),
    offerAdvisor: message.role === "ASSISTANT" && !message.answered,
    suggestions: [],
  }));
}

// ---------------------------------------------------------------------------
// Escalade vers un conseiller
// ---------------------------------------------------------------------------

export interface AssistantLeadResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
}

export async function submitAssistantLead(
  _prev: AssistantLeadResult,
  formData: FormData,
): Promise<AssistantLeadResult> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    message: String(formData.get("message") ?? ""),
    courseSlug: String(formData.get("courseSlug") ?? ""),
    consent: String(formData.get("consent") ?? ""),
  };

  const parsed = assistantLeadSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      message: "Corrigez les champs signalés.",
      fieldErrors,
    };
  }

  const limit = await checkIpRateLimit({
    prefix: "assistant-lead",
    windowMs: 60 * 60 * 1000,
    max: 5,
  });
  if (!limit.ok) {
    return { ok: false, message: rateLimitMessage(limit.resetAt) };
  }

  try {
    const jar = await cookies();
    const publicId = jar.get(CONVERSATION_COOKIE)?.value;
    const conversation = publicId
      ? await prisma.assistantConversation.findUnique({
          where: { publicId },
          select: { id: true },
        })
      : null;

    const course = parsed.data.courseSlug
      ? await prisma.course.findFirst({
          where: { slug: parsed.data.courseSlug, status: "PUBLISHED" },
          select: { id: true, title: true },
        })
      : null;

    // Le fil de discussion complet est le vrai contenu de la demande : sans
    // lui, le conseiller rappelle sans savoir ce qui a été demandé.
    const transcriptNewestFirst = conversation
      ? await prisma.assistantMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: [{ createdAt: "desc" }, { role: "desc" }],
          take: HISTORY_TURNS,
          select: { role: true, content: true },
        })
      : [];
    const transcript = transcriptNewestFirst.reverse();

    const lead = await prisma.assistantLead.create({
      data: {
        conversationId: conversation?.id ?? null,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        message: parsed.data.message || "(aucun message complémentaire)",
        courseId: course?.id ?? null,
        ipHash: await clientIpHash(),
      },
      select: { id: true },
    });

    if (conversation) {
      await prisma.assistantConversation.update({
        where: { id: conversation.id },
        data: { escalated: true },
      });
    }

    await notifyTeam({
      leadId: lead.id,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      message: parsed.data.message || null,
      courseTitle: course?.title ?? null,
      transcript,
    });

    return {
      ok: true,
      message:
        "Votre demande est transmise. Un conseiller Aiduca vous recontacte " +
        "sous 48 heures ouvrées.",
    };
  } catch (error) {
    logError("assistant-lead", error);
    return {
      ok: false,
      message:
        "L'envoi a échoué. Contactez directement l'équipe au " +
        `${BRAND.phone} ou à ${BRAND.email}.`,
    };
  }
}

/**
 * Enregistre le parcours guidé de la page Contact dans la liste Prospects
 * existante. La mutation n'est appelée qu'après le consentement explicite du
 * visiteur ; le serveur le vérifie de nouveau avant toute écriture.
 */
export async function submitContactAssistantLead(
  input: ContactAssistantLeadInput,
): Promise<AssistantLeadResult> {
  const parsed = contactAssistantLeadSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      message: "Certaines informations sont invalides.",
      fieldErrors,
    };
  }

  const limit = await checkIpRateLimit({
    prefix: "contact-assistant-lead",
    windowMs: 60 * 60 * 1000,
    max: 5,
  });
  if (!limit.ok) {
    return { ok: false, message: rateLimitMessage(limit.resetAt) };
  }

  try {
    const jar = await cookies();
    const publicId = jar.get(CONVERSATION_COOKIE)?.value;
    const conversation = publicId
      ? await prisma.assistantConversation.findUnique({
          where: { publicId },
          select: { id: true },
        })
      : null;

    const transcriptNewestFirst = conversation
      ? await prisma.assistantMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: [{ createdAt: "desc" }, { role: "desc" }],
          take: HISTORY_TURNS,
          select: { role: true, content: true },
        })
      : [];
    const transcript = transcriptNewestFirst.reverse();
    const message = buildContactProspectMessage(parsed.data);

    const lead = await prisma.assistantLead.create({
      data: {
        conversationId: conversation?.id ?? null,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        message,
        ipHash: await clientIpHash(),
      },
      select: { id: true },
    });

    if (conversation) {
      await prisma.assistantConversation.update({
        where: { id: conversation.id },
        data: { escalated: true },
      });
    }

    await notifyTeam({
      leadId: lead.id,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      message,
      courseTitle: parsed.data.training,
      transcript,
    });

    return {
      ok: true,
      message:
        "Merci, vos informations ont été ajoutées à notre liste de prospection. " +
        "Un conseiller Aiduca vous recontactera sous 48 heures ouvrées.",
    };
  } catch (error) {
    logError("contact-assistant-lead", error);
    return {
      ok: false,
      message:
        "L'envoi a échoué. Contactez directement l'équipe au " +
        `${BRAND.phone} ou à ${BRAND.email}.`,
    };
  }
}

// ---------------------------------------------------------------------------
// Interne
// ---------------------------------------------------------------------------

async function resolveConversation(userId: string | null) {
  const jar = await cookies();
  const existingId = jar.get(CONVERSATION_COOKIE)?.value;

  if (existingId) {
    const found = await prisma.assistantConversation.findUnique({
      where: { publicId: existingId },
      select: { id: true },
    });
    if (found) {
      // Un visiteur qui se connecte en cours de discussion rattache son fil.
      if (userId) {
        await prisma.assistantConversation.updateMany({
          where: { id: found.id, userId: null },
          data: { userId },
        });
      }
      return found;
    }
  }

  const publicId = nanoid(24);
  const created = await prisma.assistantConversation.create({
    data: { publicId, userId, ipHash: await clientIpHash() },
    select: { id: true },
  });

  jar.set(CONVERSATION_COOKIE, publicId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CONVERSATION_COOKIE_MAX_AGE,
  });

  return created;
}

async function persistExchange(params: {
  conversationId: string;
  question: string;
  answer: AssistantAnswer;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}): Promise<void> {
  await prisma.$transaction([
    prisma.assistantMessage.create({
      data: {
        conversationId: params.conversationId,
        role: "USER",
        content: params.question,
      },
    }),
    prisma.assistantMessage.create({
      data: {
        conversationId: params.conversationId,
        role: "ASSISTANT",
        content: params.answer.text,
        certainty: params.answer.certainty,
        answered: params.answer.answered,
        sources: params.answer.sourceIds,
        courseSlugs: params.answer.courses.map((c) => c.slug),
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        cacheReadTokens: params.cacheReadTokens,
        latencyMs: params.latencyMs,
      },
    }),
    prisma.assistantConversation.update({
      where: { id: params.conversationId },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 2 },
      },
    }),
  ]);
}

async function notifyTeam(params: {
  leadId: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  courseTitle: string | null;
  transcript: Array<{ role: "USER" | "ASSISTANT"; content: string }>;
}): Promise<void> {
  const lines = [
    `Nom : ${params.name}`,
    `E-mail : ${params.email}`,
    params.phone ? `Téléphone : ${params.phone}` : null,
    params.courseTitle ? `Formation concernée : ${params.courseTitle}` : null,
    params.message ? `\nMessage :\n${params.message}` : null,
    params.transcript.length > 0
      ? `\nÉchange avec Aiduca-IA :\n${params.transcript
          .map((m) => `${m.role === "USER" ? "Visiteur" : "Aiduca-IA"} : ${m.content}`)
          .join("\n\n")}`
      : null,
  ].filter(Boolean) as string[];

  const { html, text } = renderBrandedEmail({
    preview: `Nouvelle demande de rappel — ${params.name}`,
    heading: "Nouvelle demande de rappel",
    body: lines.join("\n"),
  });

  // Sans Resend configuré, `sendTransactionalEmail` renvoie une erreur au lieu
  // de lever : le prospect est déjà en base et reste visible dans l'admin.
  const sent = await sendTransactionalEmail({
    to: BRAND.email,
    subject: `[Aiduca-IA] Demande de rappel — ${params.name}`,
    html,
    text,
  });

  if (!sent.ok) {
    logError("assistant-lead", new Error("Notification e-mail non envoyée."), {
      leadId: params.leadId,
    });
  }
}
