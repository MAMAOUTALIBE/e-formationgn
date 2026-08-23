import {
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";

import { BRAND } from "@/lib/brand";
import {
  type CertificateTemplateData,
  formatCertificateDate,
} from "@/lib/certificate-template";

const GREEN = rgb(11 / 255, 74 / 255, 45 / 255);
const GOLD = rgb(184 / 255, 134 / 255, 27 / 255);
const TEXT = rgb(21 / 255, 21 / 255, 21 / 255);
const WHITE = rgb(1, 254 / 255, 251 / 255);

export async function generateCertificatePdf(
  params: CertificateTemplateData,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Attestation Aiduca — ${params.courseTitle}`);
  pdf.setAuthor(BRAND.legalName);
  pdf.setProducer(BRAND.legalName);
  pdf.setCreator(BRAND.legalName);
  pdf.setSubject(
    `Attestation de fin de formation · Qualiopi ${BRAND.qualiopiCertificate} · NDA ${BRAND.activityDeclaration}`,
  );

  // A4 paysage. La mention « MODÈLE » n'est volontairement jamais dessinée
  // dans ce document définitif.
  const page = pdf.addPage([841.89, 595.28]);
  const { width, height } = page.getSize();
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const logo = await loadLogo(pdf);

  page.drawRectangle({ x: 0, y: 0, width, height, color: WHITE });
  drawFrames(page, width, height);
  drawCorners(page, serif, width, height);

  if (logo) {
    page.drawImage(logo, { x: width / 2 - 48, y: height - 101, width: 96, height: 68 });
    page.drawImage(logo, {
      x: width / 2 - 195,
      y: 155,
      width: 390,
      height: 277,
      opacity: 0.035,
    });
  } else {
    drawCentered(page, BRAND.name, bold, 25, height - 66, width, GREEN);
  }

  drawCentered(page, "ATTESTATION DE FIN DE FORMATION", serif, 29, height - 132, width, GREEN);
  drawTitleOrnament(page, width, height - 151);

  let y = height - 178;
  drawCentered(page, "L'Institut AIDUCA atteste que", sans, 13, y, width, TEXT);
  y -= 24;
  drawMixedCentered(page, "M./Mme : ", params.recipientName, sans, bold, 13, y, width);
  y -= 28;
  drawCentered(page, "a suivi avec assiduité la formation :", sans, 13, y, width, TEXT);
  y -= 26;
  y = drawWrappedCentered(
    page,
    `« ${params.courseTitle.toLocaleUpperCase("fr-FR")} »`,
    serifBold,
    16,
    y,
    width,
    650,
    GREEN,
    20,
  );
  y -= 4;
  drawCentered(
    page,
    params.realisedLabel
      ? `Durée : ${params.durationLabel} — temps de connexion effectif : ${params.realisedLabel}`
      : `Durée : ${params.durationLabel}`,
    sans,
    12,
    y,
    width,
    TEXT,
  );
  y -= 20;
  drawCentered(
    page,
    `Du : ${formatCertificateDate(params.startDate)} au : ${formatCertificateDate(params.endDate)}`,
    sans,
    12,
    y,
    width,
    TEXT,
  );
  y -= 19;
  drawCentered(page, `Lieu : ${params.trainingLocation}`, sans, 12, y, width, TEXT);

  // Mentions imposées par l'article L.6353-1 du Code du travail : objectifs de
  // l'action et résultats de l'évaluation des acquis. Corps réduit, texte
  // replié — ce sont des mentions de conformité, pas le cœur visuel du
  // document. Absentes sur les attestations émises avant leur ajout : le
  // gabarit les saute alors sans laisser de blanc.
  if (params.objectives && params.objectives.length > 0) {
    y -= 22;
    drawCentered(page, "Objectifs de la formation", sans, 10, y, width, TEXT);
    y -= 15;
    for (const objectif of params.objectives.slice(0, 6)) {
      y = drawWrappedCentered(page, `• ${objectif}`, sans, 10, y, width, 620, TEXT, 13);
      y -= 2;
    }
  }
  if (params.assessmentSummary) {
    y -= 18;
    drawCentered(page, "Résultats de l'évaluation des acquis", sans, 10, y, width, TEXT);
    y -= 15;
    y = drawWrappedCentered(page, params.assessmentSummary, sans, 10, y, width, 620, TEXT, 13);
  }

  y -= 28;
  drawCentered(
    page,
    `Fait à Montrouge, le ${formatCertificateDate(params.issuedAt)}`,
    sans,
    12,
    y,
    width,
    TEXT,
  );

  drawSignatures(page, sans, serif, width);
  drawFooter(page, sans, bold, width);

  if (params.serialNumber) {
    page.drawText(`Réf. ${params.serialNumber}`, {
      x: width - 140,
      y: 27,
      size: 6,
      font: sans,
      color: rgb(75 / 255, 85 / 255, 99 / 255),
    });
  }

  return pdf.save();
}

async function loadLogo(pdf: PDFDocument): Promise<PDFImage | null> {
  try {
    const response = await fetch(BRAND.logoUrl, { cache: "force-cache" });
    if (!response.ok) return null;
    return await pdf.embedPng(await response.arrayBuffer());
  } catch {
    return null;
  }
}

function drawFrames(page: PDFPage, width: number, height: number) {
  page.drawRectangle({ x: 10, y: 10, width: width - 20, height: height - 20, borderColor: GREEN, borderWidth: 2 });
  page.drawRectangle({ x: 16, y: 16, width: width - 32, height: height - 32, borderColor: GOLD, borderWidth: 0.8 });
  page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: GREEN, borderWidth: 0.55 });
}

function drawCorners(page: PDFPage, font: PDFFont, width: number, height: number) {
  for (const position of [
    { x: 24, y: height - 54 },
    { x: width - 50, y: height - 54 },
    { x: 24, y: 28 },
    { x: width - 50, y: 28 },
  ]) {
    page.drawText("*", { ...position, size: 28, font, color: GREEN });
  }
}

function drawTitleOrnament(page: PDFPage, width: number, y: number) {
  page.drawLine({ start: { x: 125, y }, end: { x: width / 2 - 26, y }, thickness: 0.6, color: GOLD });
  page.drawCircle({ x: width / 2, y, size: 2.5, color: GOLD });
  page.drawLine({ start: { x: width / 2 + 26, y }, end: { x: width - 125, y }, thickness: 0.6, color: GOLD });
}

function drawSignatures(page: PDFPage, sans: PDFFont, serif: PDFFont, width: number) {
  page.drawText("Le responsable de formation", { x: 110, y: 103, size: 10, font: sans, color: TEXT });
  page.drawLine({ start: { x: 95, y: 72 }, end: { x: 285, y: 72 }, thickness: 0.65, color: GOLD });
  drawCentered(page, "*", serif, 43, 65, width, GOLD);
  page.drawText("Signature du stagiaire", { x: width - 260, y: 103, size: 10, font: sans, color: TEXT });
  page.drawLine({ start: { x: width - 285, y: 72 }, end: { x: width - 95, y: 72 }, thickness: 0.65, color: GOLD });
}

function drawFooter(page: PDFPage, sans: PDFFont, bold: PDFFont, width: number) {
  page.drawLine({ start: { x: 84, y: 47 }, end: { x: width - 84, y: 47 }, thickness: 0.65, color: GREEN });
  drawCentered(page, `Institut AIDUCA — ${BRAND.address}`, sans, 7.5, 35, width, TEXT);
  drawCentered(
    page,
    `${BRAND.phone} • ${BRAND.mobile} • ${BRAND.email} • www.aiduca.fr`,
    bold,
    7.5,
    24,
    width,
    GREEN,
  );
}

function drawMixedCentered(
  page: PDFPage,
  prefix: string,
  emphasized: string,
  regular: PDFFont,
  bold: PDFFont,
  size: number,
  y: number,
  pageWidth: number,
) {
  const totalWidth = regular.widthOfTextAtSize(prefix, size) + bold.widthOfTextAtSize(emphasized, size);
  const x = (pageWidth - totalWidth) / 2;
  page.drawText(prefix, { x, y, size, font: regular, color: TEXT });
  page.drawText(emphasized, {
    x: x + regular.widthOfTextAtSize(prefix, size), y, size, font: bold, color: GREEN,
  });
}

function drawWrappedCentered(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  y: number,
  pageWidth: number,
  maxWidth: number,
  color: ReturnType<typeof rgb>,
  lineHeight: number,
): number {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  for (const line of lines.slice(0, 2)) {
    drawCentered(page, line, font, size, y, pageWidth, color);
    y -= lineHeight;
  }
  return y;
}

function drawCentered(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  y: number,
  pageWidth: number,
  color: ReturnType<typeof rgb>,
) {
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (pageWidth - textWidth) / 2, y, size, font, color });
}
