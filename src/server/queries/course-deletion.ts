import "server-only";

import { prisma } from "@/lib/prisma";
export { COURSE_NOT_DELETABLE_MESSAGE } from "@/lib/domain/course-deletion";

// Détermine si un cours peut être SUPPRIMÉ DÉFINITIVEMENT.
//
// Les commandes, certificats, inscriptions et rattachements à un programme
// constituent un historique sensible. Même lorsqu'une relation est en cascade,
// on ne l'efface pas : suppression définitive uniquement si les quatre compteurs
// sont à zéro. Les contenus pédagogiques sans historique sont alors purgés.

export interface CourseDeletionStatus {
  deletable: boolean;
  orderItems: number;
  certificates: number;
  enrollments: number;
  programs: number;
}

export async function getCourseDeletionStatus(
  courseId: string,
): Promise<CourseDeletionStatus> {
  const [orderItems, certificates, enrollments, programs] = await Promise.all([
    prisma.orderItem.count({ where: { courseId } }),
    prisma.certificate.count({ where: { courseId } }),
    prisma.enrollment.count({ where: { courseId } }),
    prisma.programCourse.count({ where: { courseId } }),
  ]);
  return {
    deletable: orderItems === 0 && certificates === 0 && enrollments === 0 && programs === 0,
    orderItems,
    certificates,
    enrollments,
    programs,
  };
}
