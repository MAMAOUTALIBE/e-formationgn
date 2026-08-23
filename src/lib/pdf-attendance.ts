// Feuille d'émargement PDF — pièce justificative de réalisation d'une action
// de formation à distance.
//
// Format A4 paysage : une colonne par journée où au moins un stagiaire a été
// actif, une ligne par personne inscrite. Les absents y figurent avec un total
// à zéro — une feuille qui n'énumère que les présents ne prouve rien.
//
// Le document porte la mention de la source de la mesure. Un auditeur qui
// demande « d'où sortent ces heures ? » doit trouver la réponse sur la feuille
// elle-même, pas dans une documentation technique.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { BRAND } from "@/lib/brand";
import { formatDuree } from "@/lib/duration";
import type { AttendanceSheet } from "@/server/queries/attendance";

const ENCRE = rgb(16 / 255, 24 / 255, 38 / 255);
const GRIS = rgb(100 / 255, 116 / 255, 139 / 255);
const MARINE = rgb(30 / 255, 58 / 255, 138 / 255);
const FILET = rgb(203 / 255, 213 / 255, 225 / 255);
const ABSENT = rgb(159 / 255, 18 / 255, 57 / 255);

const A4_PAYSAGE: [number, number] = [841.89, 595.28];
const MARGE = 36;

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });
const dateLongue = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** Tronque un texte pour qu'il tienne dans une largeur donnée. */
function ajuster(texte: string, police: PDFFont, taille: number, largeur: number): string {
  if (police.widthOfTextAtSize(texte, taille) <= largeur) return texte;
  let coupe = texte;
  while (coupe.length > 1 && police.widthOfTextAtSize(`${coupe}…`, taille) > largeur) {
    coupe = coupe.slice(0, -1);
  }
  return `${coupe}…`;
}

function ecrire(
  page: PDFPage,
  texte: string,
  x: number,
  y: number,
  police: PDFFont,
  taille: number,
  couleur = ENCRE,
) {
  page.drawText(texte, { x, y, size: taille, font: police, color: couleur });
}

export async function generateAttendancePdf(sheet: AttendanceSheet): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const gras = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Au-delà de huit journées la grille devient illisible en paysage : on ne
  // détaille alors plus que le total, et le détail journalier reste consultable
  // à l'écran. Mieux vaut un document lisible qu'un document exhaustif et
  // impraticable.
  const colonnes = sheet.colonnes.slice(0, 8);
  const detailTronque = sheet.colonnes.length > colonnes.length;

  const [largeur, hauteur] = A4_PAYSAGE;
  let page = pdf.addPage(A4_PAYSAGE);
  let y = hauteur - MARGE;

  // --- En-tête -------------------------------------------------------------
  ecrire(page, "FEUILLE D'ÉMARGEMENT", MARGE, y - 14, gras, 16, MARINE);
  ecrire(
    page,
    `Éditée le ${dateLongue.format(sheet.genereLe)}`,
    largeur - MARGE - sans.widthOfTextAtSize(`Éditée le ${dateLongue.format(sheet.genereLe)}`, 9),
    y - 12,
    sans,
    9,
    GRIS,
  );
  y -= 34;

  ecrire(page, sheet.programme, MARGE, y, gras, 12);
  y -= 15;
  const details = [
    sheet.reference ? `Session ${sheet.reference}` : null,
    `du ${dateLongue.format(sheet.debut)} au ${dateLongue.format(sheet.fin)}`,
    sheet.lieu ? `Lieu : ${sheet.lieu}` : "Formation à distance",
  ]
    .filter(Boolean)
    .join("  ·  ");
  ecrire(page, details, MARGE, y, sans, 9.5, GRIS);
  y -= 12;
  ecrire(page, `${BRAND.name} — ${BRAND.address} — SIREN ${BRAND.siren}`, MARGE, y, sans, 8.5, GRIS);
  y -= 20;

  // --- Grille --------------------------------------------------------------
  const colTotal = 62;
  const colJour = colonnes.length > 0 ? 44 : 0;
  const largeurNom = largeur - 2 * MARGE - colTotal - colJour * colonnes.length;

  function enTeteGrille() {
    page.drawLine({
      start: { x: MARGE, y: y + 12 },
      end: { x: largeur - MARGE, y: y + 12 },
      thickness: 1,
      color: MARINE,
    });
    ecrire(page, "STAGIAIRE", MARGE, y, gras, 8, GRIS);
    colonnes.forEach((jour, i) => {
      const libelle = dateCourte.format(jour);
      const x = MARGE + largeurNom + i * colJour;
      ecrire(page, libelle, x + colJour - 6 - sans.widthOfTextAtSize(libelle, 8), y, gras, 8, GRIS);
    });
    const xTotal = MARGE + largeurNom + colJour * colonnes.length;
    ecrire(page, "TOTAL", xTotal + colTotal - sans.widthOfTextAtSize("TOTAL", 8), y, gras, 8, GRIS);
    y -= 6;
    page.drawLine({
      start: { x: MARGE, y },
      end: { x: largeur - MARGE, y },
      thickness: 0.5,
      color: FILET,
    });
    y -= 13;
  }

  enTeteGrille();

  for (const ligne of sheet.lignes) {
    if (y < MARGE + 80) {
      page = pdf.addPage(A4_PAYSAGE);
      y = hauteur - MARGE - 20;
      enTeteGrille();
    }

    const couleur = ligne.sansActivite ? ABSENT : ENCRE;
    ecrire(page, ajuster(ligne.stagiaire, sans, 9.5, largeurNom - 8), MARGE, y, sans, 9.5, couleur);

    colonnes.forEach((jour, i) => {
      const trouve = ligne.journees.find((j) => j.jour.getTime() === jour.getTime());
      const valeur = trouve ? formatDuree(trouve.secondes) : "—";
      const x = MARGE + largeurNom + i * colJour;
      ecrire(
        page,
        valeur,
        x + colJour - 6 - sans.widthOfTextAtSize(valeur, 8.5),
        y,
        sans,
        8.5,
        trouve ? ENCRE : GRIS,
      );
    });

    const total = ligne.sansActivite ? "Aucune activité" : formatDuree(ligne.totalSecondes);
    const taille = ligne.sansActivite ? 7.5 : 9.5;
    const xTotal = MARGE + largeurNom + colJour * colonnes.length;
    ecrire(
      page,
      total,
      xTotal + colTotal - sans.widthOfTextAtSize(total, taille),
      y,
      ligne.sansActivite ? sans : gras,
      taille,
      couleur,
    );

    y -= 8;
    page.drawLine({
      start: { x: MARGE, y },
      end: { x: largeur - MARGE, y },
      thickness: 0.4,
      color: FILET,
    });
    y -= 13;
  }

  // --- Total et mentions ---------------------------------------------------
  y -= 4;
  const totalGeneral = `Total cumulé : ${formatDuree(sheet.totalSecondes)}`;
  ecrire(page, totalGeneral, largeur - MARGE - gras.widthOfTextAtSize(totalGeneral, 10), y, gras, 10, MARINE);
  y -= 26;

  const mentions = [
    "Durées mesurées automatiquement par la plateforme : relevé d'activité échantillonné toutes les 20 secondes,",
    "comptabilisé uniquement lorsque le contenu est affiché à l'écran et effectivement consulté.",
    detailTronque
      ? `Détail journalier limité aux ${colonnes.length} premières journées ; le total cumulé porte sur l'intégralité de la session.`
      : null,
    "Les stagiaires signalés « Aucune activité » sont inscrits mais ne se sont pas connectés sur la période.",
  ].filter((l): l is string => Boolean(l));

  for (const ligne of mentions) {
    ecrire(page, ligne, MARGE, y, sans, 7.5, GRIS);
    y -= 10;
  }

  // --- Signatures ----------------------------------------------------------
  y -= 18;
  const largeurSignature = 200;
  ecrire(page, "Le responsable de formation", MARGE, y, sans, 8.5, GRIS);
  page.drawLine({
    start: { x: MARGE, y: y - 26 },
    end: { x: MARGE + largeurSignature, y: y - 26 },
    thickness: 0.6,
    color: FILET,
  });
  const xCachet = largeur - MARGE - largeurSignature;
  ecrire(page, "Cachet de l'organisme", xCachet, y, sans, 8.5, GRIS);
  page.drawLine({
    start: { x: xCachet, y: y - 26 },
    end: { x: xCachet + largeurSignature, y: y - 26 },
    thickness: 0.6,
    color: FILET,
  });

  return pdf.save();
}
