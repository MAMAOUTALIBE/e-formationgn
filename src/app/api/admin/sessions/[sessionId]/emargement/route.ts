// Téléchargement de la feuille d'émargement d'une session de formation.
//
// Route d'API et non Server Action : le résultat est un fichier binaire que le
// navigateur doit enregistrer, ce qu'une Server Action ne sait pas produire
// directement.
//
// L'édition d'une feuille d'émargement est journalisée. Ce document sort de
// l'organisme — il part chez un financeur, un employeur ou un auditeur — et il
// porte des données nominatives : savoir qui l'a édité et quand fait partie de
// la traçabilité au même titre que son contenu.

import { NextResponse } from "next/server";

import { requireAnyAdminRole } from "@/lib/auth/authorization";
import { generateAttendancePdf } from "@/lib/pdf-attendance";
import { buildAttendanceSheet } from "@/server/queries/attendance";
import { createAuditLog } from "@/server/services/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  let session;
  try {
    // Le suivi pédagogique relève aussi du gestionnaire de formation : la
    // feuille d'émargement est son outil de travail, pas une pièce réservée
    // à l'administrateur.
    session = await requireAnyAdminRole("ADMIN", "MANAGER", "SUPPORT");
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sheet = await buildAttendanceSheet(sessionId);
  if (!sheet) {
    return NextResponse.json({ error: "session_introuvable" }, { status: 404 });
  }

  const pdf = await generateAttendancePdf(sheet);

  await createAuditLog({
    actorId: session.userId,
    action: "attendance.export",
    targetType: "TrainingSession",
    targetId: sessionId,
    metadata: {
      stagiaires: sheet.lignes.length,
      sansActivite: sheet.lignes.filter((l) => l.sansActivite).length,
      totalSecondes: sheet.totalSecondes,
    },
  });

  const nom = [
    "emargement",
    (sheet.reference ?? sheet.programme)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40),
    sheet.debut.toISOString().slice(0, 10),
  ].join("-");

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nom}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
