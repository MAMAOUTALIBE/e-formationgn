// Compteurs dynamiques pour les badges de la sidebar admin.
// Une seule requête groupée par appel — toutes les valeurs sont des `count`,
// donc l'impact est minimal même sans cache.

import { prisma } from "@/lib/prisma";

export interface AdminSidebarBadges {
  pendingCourses: number;
  openTickets: number;
  openDisputes: number;
  pendingReports: number;
  pendingGdpr: number;
}

export async function getAdminSidebarBadges(): Promise<AdminSidebarBadges> {
  const [pendingCourses, openTickets, openDisputes, pendingReports, pendingGdpr] =
    await Promise.all([
      prisma.course.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.supportTicket.count({
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
      prisma.dispute.count({
        where: { status: { in: ["OPEN", "IN_REVIEW"] } },
      }),
      prisma.report.count({ where: { status: "PENDING" } }),
      prisma.gdprRequest.count({ where: { status: "PENDING" } }),
    ]);
  return { pendingCourses, openTickets, openDisputes, pendingReports, pendingGdpr };
}
