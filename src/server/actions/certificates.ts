"use server";

import { randomBytes } from "node:crypto";

import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import {
  CERTIFICATE_REQUIRES_COMPLETION,
  canIssueCertificate,
} from "@/lib/domain/training-integrity";
import { prisma } from "@/lib/prisma";

import type { ActionResult } from "./auth";

// Suffixe imprévisible (8 octets → 16 hex). Remplace Math.random (prévisible,
// faible entropie) : un certificat ne doit pas être devinable par énumération.
function buildSerial(): string {
  const year = new Date().getFullYear();
  const random = randomBytes(8).toString("hex").toUpperCase();
  return `EFGN-${year}-${random}`;
}

export async function issueCertificate(courseId: string): Promise<ActionResult & { serialNumber?: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, message: "Connectez-vous." };

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    select: { id: true, completedAt: true, progressPercent: true, orderItemId: true },
  });
  if (!enrollment) {
    return { success: false, message: "Vous n'êtes pas inscrit à cette formation." };
  }
  if (!canIssueCertificate(enrollment)) {
    return {
      success: false,
      message: CERTIFICATE_REQUIRES_COMPLETION,
    };
  }

  // Idempotent : si un certificat existe déjà, on le réutilise.
  const existing = await prisma.certificate.findFirst({
    where: { userId: session.user.id, courseId },
    select: { id: true, serialNumber: true },
  });
  if (existing) {
    return { success: true, serialNumber: existing.serialNumber };
  }

  // Génère un numéro unique (réessais si collision rare).
  let serial = buildSerial();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.certificate.findUnique({
      where: { serialNumber: serial },
      select: { id: true },
    });
    if (!exists) break;
    serial = buildSerial();
  }

  let cert: { serialNumber: string };
  try {
    cert = await prisma.certificate.create({
      data: {
        userId: session.user.id,
        courseId,
        serialNumber: serial,
        orderItemId: enrollment.orderItemId,
      },
      select: { serialNumber: true },
    });
  } catch (error) {
    // Deux clics concurrents peuvent franchir le premier SELECT. La contrainte
    // composite garantit l'idempotence ; le perdant réutilise l'attestation.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrent = await prisma.certificate.findFirst({
        where: { userId: session.user.id, courseId },
        select: { serialNumber: true },
      });
      if (concurrent) return { success: true, serialNumber: concurrent.serialNumber };
    }
    throw error;
  }

  return { success: true, serialNumber: cert.serialNumber };
}
