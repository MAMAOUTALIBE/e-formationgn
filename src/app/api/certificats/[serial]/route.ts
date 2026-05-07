// Téléchargement du certificat PDF.
// Le serial number est connu uniquement de l'élève propriétaire (et publiquement
// vérifiable via la page /certificat/[serial]).

import { NextResponse } from "next/server";

import { auth } from "@/auth";
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
          instructor: {
            select: { name: true, firstName: true, lastName: true },
          },
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

  const instructorName =
    certificate.course.instructor.name ??
    (`${certificate.course.instructor.firstName ?? ""} ${certificate.course.instructor.lastName ?? ""}`.trim() ||
      "Formateur");

  const pdf = await generateCertificatePdf({
    recipientName,
    courseTitle: certificate.course.title,
    instructorName,
    serialNumber: certificate.serialNumber,
    issuedAt: certificate.issuedAt,
    durationLabel: certificate.course.durationSeconds
      ? formatDurationFromSeconds(certificate.course.durationSeconds)
      : undefined,
  });

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificat-${certificate.serialNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
