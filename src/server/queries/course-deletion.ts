import "server-only";

import { prisma } from "@/lib/prisma";

// Détermine si un cours peut être SUPPRIMÉ DÉFINITIVEMENT.
//
// OrderItem et Certificate référencent Course avec onDelete par défaut
// (Restrict) → une suppression échouerait au niveau base si l'un existe, et
// surtout effacerait l'historique financier/comptable. Règle : suppression
// définitive autorisée uniquement sans ventes ni certificats. Sinon → archiver.
// (Les inscriptions, sections, leçons, avis… sont en cascade et seront purgés.)

export interface CourseDeletionStatus {
  deletable: boolean;
  orderItems: number;
  certificates: number;
  enrollments: number;
}

export async function getCourseDeletionStatus(
  courseId: string,
): Promise<CourseDeletionStatus> {
  const [orderItems, certificates, enrollments] = await Promise.all([
    prisma.orderItem.count({ where: { courseId } }),
    prisma.certificate.count({ where: { courseId } }),
    prisma.enrollment.count({ where: { courseId } }),
  ]);
  return {
    deletable: orderItems === 0 && certificates === 0,
    orderItems,
    certificates,
    enrollments,
  };
}

export const COURSE_NOT_DELETABLE_MESSAGE =
  "Ce cours a un historique de commandes ou de certificats : pour préserver la comptabilité, il ne peut pas être supprimé définitivement. Archivez-le à la place.";
