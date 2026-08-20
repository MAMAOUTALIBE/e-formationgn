// Téléchargement du certificat PDF.
// Le serial number est connu uniquement de l'élève propriétaire (et publiquement
// vérifiable via la page /certificat/[serial]).

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getAiducaTrainingLocation } from "@/lib/certificate-template";
import { generateCertificatePdf } from "@/lib/pdf-certificate";
import { formatDurationFromSeconds } from "@/lib/format/duration";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ serial: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { serial } = await context.params;
  const certificate = await prisma.certificate.findUnique({
    where: { serialNumber: serial },
    include: {
      user: { select: { id: true, name: true, firstName: true, lastName: true } },
      course: {
        select: {
          title: true,
          durationSeconds: true,
        },
      },
    },
  });
  if (!certificate) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Le téléchargement direct est autorisé au propriétaire ; la page publique
  // /certificat/[serial] permet à un tiers de vérifier sans télécharger.
  const session = await auth();
  if (session?.user.id !== certificate.userId && session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const recipientName =
    certificate.user.name ??
    (`${certificate.user.firstName ?? ""} ${certificate.user.lastName ?? ""}`.trim() ||
      "Apprenant·e");

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: certificate.userId,
        courseId: certificate.courseId,
      },
    },
    select: { enrolledAt: true, completedAt: true },
  });

  const endDate = enrollment?.completedAt ?? certificate.issuedAt;

  const pdf = await generateCertificatePdf({
    recipientName,
    courseTitle: certificate.course.title,
    serialNumber: certificate.serialNumber,
    issuedAt: certificate.issuedAt,
    startDate: enrollment?.enrolledAt ?? certificate.issuedAt,
    endDate,
    trainingLocation: getAiducaTrainingLocation(),
    durationLabel: certificate.course.durationSeconds
      ? formatDurationFromSeconds(certificate.course.durationSeconds)
      : "Non renseignée",
  });

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="attestation-aiduca-${certificate.serialNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
