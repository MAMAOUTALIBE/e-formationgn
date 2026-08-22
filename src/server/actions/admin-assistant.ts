"use server";

// Server Action : question posée à l'assistant IA du CRM.
//
// L'instantané envoyé au modèle est construit ICI, côté serveur, à partir des
// mêmes requêtes que le tableau de bord. Rien de ce que le client envoie n'est
// repris tel quel : il ne fournit que sa question.

import { z } from "zod";

import {
  askAdminAssistant,
  isAdminAssistantConfigured,
} from "@/lib/ai/admin-assistant";
import { requireAnyAdminRole } from "@/lib/auth/authorization";
import { adminRolesForScreen } from "@/lib/workspace/admin-screen-roles";
import { periodToRange, PRESET_LABELS } from "@/lib/admin/period";
import { readPeriod } from "@/lib/admin/period-server";
import { logError } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getAdminAlerts,
  getAdminOverviewKpis,
} from "@/server/queries/admin-overview";
import { getAdminSidebarBadges } from "@/server/queries/admin-sidebar";

const questionSchema = z
  .object({
    question: z.string().trim().min(5, "Posez une question plus précise.").max(1000),
  })
  .strict();

export interface AdminAssistantResult {
  ok: boolean;
  message?: string;
  answer?: string;
}

function formatMinor(cents: number, suffix: string): string {
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${suffix}`;
}

export async function askCrmAssistant(
  question: string,
): Promise<AdminAssistantResult> {
  // Sans argument : tout rôle « administratif » (ADMIN, MODERATOR, SUPPORT,
  // FINANCE). L'assistant est en lecture seule et ne commente que des
  // agrégats déjà visibles sur le tableau de bord de chacun de ces rôles.
  let session;
  try {
    session = await requireAnyAdminRole(...adminRolesForScreen("/admin"));
  } catch {
    return { ok: false, message: "Accès refusé." };
  }

  // Sans clé API, l'assistant n'est pas rendu dans le header — ce garde couvre
  // le cas où la clé disparaît entre le rendu de la page et l'envoi.
  if (!isAdminAssistantConfigured()) {
    return { ok: false, message: "L'assistant IA n'est pas activé." };
  }

  const parsed = questionSchema.safeParse({ question });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Question invalide.",
    };
  }

  // Un appel modèle coûte : on borne à 20 questions par heure et par admin.
  const rl = await checkRateLimit({
    key: `admin-assistant:${session.userId}`,
    windowMs: 60 * 60 * 1000,
    max: 20,
  });
  if (!rl.ok) {
    const minutes = Math.ceil((rl.resetAt - Date.now()) / 60_000);
    return {
      ok: false,
      message: `Limite atteinte (20 questions / h). Réessayez dans ${minutes} min.`,
    };
  }

  try {
    const period = await readPeriod(null);
    const range = periodToRange(period);
    const [kpis, badges, alerts] = await Promise.all([
      getAdminOverviewKpis(range),
      getAdminSidebarBadges(),
      getAdminAlerts(),
    ]);

    const result = await askAdminAssistant(
      {
        periodLabel: PRESET_LABELS[period.preset],
        revenueEur: formatMinor(kpis.revenueByCurrency.EUR, "€"),
        revenueUsd: formatMinor(kpis.revenueByCurrency.USD, "$"),
        ordersCount: kpis.ordersCount,
        newSignups: kpis.newSignups,
        activeStudents30d: kpis.activeStudents30d,
        averageCompletionPercent: kpis.averageCompletionPercent,
        pendingCourses: badges.pendingCourses,
        openTickets: badges.openTickets,
        openDisputes: badges.openDisputes,
        pendingReports: badges.pendingReports,
        pendingGdpr: badges.pendingGdpr,
        alerts: alerts.map((a) => a.label),
      },
      parsed.data.question,
    );

    return { ok: true, answer: result.text };
  } catch (error) {
    logError("admin-assistant", error, { userId: session.userId });
    return {
      ok: false,
      message: "L'assistant n'a pas pu répondre. Réessayez dans un instant.",
    };
  }
}
