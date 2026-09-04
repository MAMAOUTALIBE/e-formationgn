// Compteurs dynamiques pour les badges de la sidebar admin.
// Une seule requête groupée par appel — toutes les valeurs sont des `count`,
// donc l'impact est minimal même sans cache.

import { prisma } from "@/lib/prisma";

/**
 * Alias de type et non `interface` : la coquille attend un
 * `Record<string, number>` (les compteurs sont indexés par les `badgeKeys` du
 * registre de navigation), et TypeScript n'accorde de signature d'index
 * implicite qu'aux alias, jamais aux interfaces.
 */
export type AdminSidebarBadges = {
  pendingCourses: number;
  openTickets: number;
  openDisputes: number;
  pendingReports: number;
  pendingGdpr: number;
  /** Réponses d'Aiduca-IA laissées incertaines — à documenter. */
  unansweredQuestions: number;
};

export async function getAdminSidebarBadges(): Promise<AdminSidebarBadges> {
  const [
    pendingCourses,
    openTickets,
    openDisputes,
    pendingReports,
    pendingGdpr,
    unansweredQuestions,
  ] = await Promise.all([
    prisma.course.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.supportTicket.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
    prisma.dispute.count({
      where: { status: { in: ["OPEN", "IN_REVIEW"] } },
    }),
    prisma.report.count({ where: { status: "PENDING" } }),
    prisma.gdprRequest.count({ where: { status: "PENDING" } }),
    prisma.assistantMessage.count({
      where: { role: "ASSISTANT", answered: false },
    }),
  ]);
  return {
    pendingCourses,
    openTickets,
    openDisputes,
    pendingReports,
    pendingGdpr,
    unansweredQuestions,
  };
}
