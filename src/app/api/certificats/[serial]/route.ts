// Téléchargement du certificat PDF.
// Le serial number est connu uniquement de l'élève propriétaire (et publiquement
// vérifiable via la page /certificat/[serial]).

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getAiducaTrainingLocation } from "@/lib/certificate-template";
import { generateCertificatePdf } from "@/lib/pdf-certificate";
import { formatDuree } from "@/lib/duration";
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
      // Session au titre de laquelle l'attestation a été délivrée : ses dates
      // et son lieu font foi, pas ceux de l'accès au cours.
      registration: {
        select: {
          session: { select: { startDate: true, endDate: true, location: true } },
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
    certificate.holderName ??
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

  // Dates de l'action de formation.
  //
  // L'attestation citait les dates d'ouverture et de clôture de l'ACCÈS au
  // cours. Ce ne sont pas les dates de l'action : celles-ci figurent sur la
  // convention et sont portées par la session. On les préfère dès que
  // l'attestation est rattachée à une inscription ; à défaut — accès attribué
  // hors session, ou attestation antérieure au rattachement — on retombe sur
  // les dates d'inscription, comme avant.
  const sessionFormation = certificate.registration?.session ?? null;
  const startDate = sessionFormation?.startDate ?? enrollment?.enrolledAt ?? certificate.issuedAt;
  const endDate =
    sessionFormation?.endDate ?? enrollment?.completedAt ?? certificate.issuedAt;
  const trainingLocation =
    sessionFormation?.location?.trim() || getAiducaTrainingLocation();

  const pdf = await generateCertificatePdf({
    recipientName,
    courseTitle: certificate.course.title,
    serialNumber: certificate.serialNumber,
    issuedAt: certificate.issuedAt,
    startDate,
    endDate,
    trainingLocation,
    durationLabel: certificate.course.durationSeconds
      ? formatDurationFromSeconds(certificate.course.durationSeconds)
      : "Non renseignée",
    // Mentions figées à l'émission (art. L.6353-1 du Code du travail). On les
    // lit sur l'attestation et NON sur la formation : remanier un programme ne
    // doit pas modifier un document déjà remis à un stagiaire et vérifiable par
    // son employeur.
    objectives: certificate.objectives,
    assessmentSummary: certificate.assessmentSummary,
    // Temps de connexion effectif figé à l'émission (art. L.6353-1 : la durée
    // de l'action). `null` sur les attestations antérieures à la colonne, le
    // gabarit saute alors la mention.
    realisedLabel: certificate.completedSeconds
      ? formatDuree(certificate.completedSeconds)
      : null,
  });

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="attestation-aiduca-${certificate.serialNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
