// Génère une attestation PDF brandée Aiduca avec pdf-lib.
// Format A4 paysage, palette corporate. Pas d'image hébergée externe pour
// éviter les dépendances réseau au moment de la génération.

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { BRAND } from "@/lib/brand";

const BRAND_PRIMARY = rgb(30 / 255, 58 / 255, 138 / 255);
const BRAND_SECONDARY = rgb(37 / 255, 99 / 255, 235 / 255);
const BRAND_ACCENT = rgb(14 / 255, 165 / 255, 233 / 255);
const TEXT = rgb(15 / 255, 23 / 255, 42 / 255);
const MUTED = rgb(71 / 255, 85 / 255, 105 / 255);

interface CertificateParams {
  recipientName: string;
  courseTitle: string;
  instructorName: string;
  serialNumber: string;
  issuedAt: Date;
  durationLabel?: string;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export async function generateCertificatePdf(
  params: CertificateParams,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Attestation Aiduca — ${params.courseTitle}`);
  pdf.setAuthor("AIDUCA");
  pdf.setProducer("AIDUCA");
  pdf.setCreator("AIDUCA");

  // A4 paysage : 842 × 595 pt
  const page = pdf.addPage([842, 595]);
  const { width, height } = page.getSize();

  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdf.embedFont(StandardFonts.HelveticaOblique);

  // Cadre extérieur
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: BRAND_PRIMARY,
    borderWidth: 2,
  });
  page.drawRectangle({
    x: 32,
    y: 32,
    width: width - 64,
    height: height - 64,
    borderColor: BRAND_ACCENT,
    borderWidth: 0.6,
  });

  // Bandeau supérieur
  page.drawRectangle({
    x: 32,
    y: height - 100,
    width: width - 64,
    height: 60,
    color: BRAND_PRIMARY,
  });

  page.drawText("AIDUCA", {
    x: 56,
    y: height - 80,
    size: 22,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Attestation de fin de formation", {
    x: 56,
    y: height - 96,
    size: 11,
    font: helvetica,
    color: rgb(0.85, 0.92, 1),
  });

  // Numéro de série (haut droit)
  page.drawText(`Référence : ${params.serialNumber}`, {
    x: width - 220,
    y: height - 76,
    size: 9,
    font: helvetica,
    color: rgb(0.85, 0.92, 1),
  });
  page.drawText(`Émis le ${dateFormatter.format(params.issuedAt)}`, {
    x: width - 220,
    y: height - 92,
    size: 9,
    font: helvetica,
    color: rgb(0.85, 0.92, 1),
  });

  // Titre principal
  drawCenteredText(
    page,
    "Attestation délivrée à",
    helvetica,
    14,
    height - 160,
    width,
    MUTED,
  );

  drawCenteredText(
    page,
    params.recipientName,
    helveticaBold,
    36,
    height - 220,
    width,
    TEXT,
  );

  // Sous-ligne
  page.drawLine({
    start: { x: width / 2 - 200, y: height - 235 },
    end: { x: width / 2 + 200, y: height - 235 },
    thickness: 1,
    color: BRAND_SECONDARY,
  });

  drawCenteredText(
    page,
    "pour avoir suivi avec succès la formation",
    helvetica,
    14,
    height - 270,
    width,
    MUTED,
  );

  drawCenteredText(
    page,
    `« ${params.courseTitle} »`,
    helveticaBold,
    22,
    height - 320,
    width,
    BRAND_PRIMARY,
  );

  if (params.durationLabel) {
    drawCenteredText(
      page,
      `Durée totale : ${params.durationLabel}`,
      helvetica,
      11,
      height - 350,
      width,
      MUTED,
    );
  }

  drawCenteredText(
    page,
    "dispensé par",
    helvetica,
    11,
    height - 380,
    width,
    MUTED,
  );

  drawCenteredText(
    page,
    params.instructorName,
    helveticaOblique,
    16,
    height - 405,
    width,
    TEXT,
  );

  // Pied : signature & vérification
  page.drawLine({
    start: { x: 80, y: 130 },
    end: { x: 280, y: 130 },
    thickness: 0.7,
    color: MUTED,
  });
  page.drawText("Signature de l'équipe AIDUCA", {
    x: 80,
    y: 115,
    size: 9,
    font: helvetica,
    color: MUTED,
  });
  page.drawText("AIDUCA — Organisme de formation certifié Qualiopi", {
    x: 80,
    y: 100,
    size: 9,
    font: helvetica,
    color: MUTED,
  });

  page.drawText("NDA 11922091192 · SIREN 523 611 523 · Qualiopi FP 2020/0005-6", {
    x: 80,
    y: 84,
    size: 8,
    font: helvetica,
    color: MUTED,
  });

  page.drawText(
    `Vérifiez l'authenticité : ${process.env.NEXT_PUBLIC_APP_URL ?? BRAND.website}/certificat/${params.serialNumber}`,
    {
      x: width - 460,
      y: 100,
      size: 9,
      font: helvetica,
      color: MUTED,
    },
  );

  page.drawText(`91 avenue Aristide Briand, 92120 Montrouge · info@aiduca.fr · valide Qualiopi jusqu'au 20/10/2027`, {
    x: 80,
    y: 68,
    size: 7.5,
    font: helvetica,
    color: MUTED,
  });

  return pdf.save();
}

function drawCenteredText(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  font: ReturnType<PDFDocument["embedFont"]> extends Promise<infer F> ? F : never,
  size: number,
  y: number,
  pageWidth: number,
  color: ReturnType<typeof rgb>,
) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: (pageWidth - width) / 2,
    y,
    size,
    font,
    color,
  });
}
