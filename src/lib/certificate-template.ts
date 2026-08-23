import { BRAND } from "@/lib/brand";

export interface CertificateTemplateData {
  recipientName: string;
  courseTitle: string;
  durationLabel: string;
  startDate: Date;
  endDate: Date;
  issuedAt: Date;
  trainingLocation: string;
  serialNumber?: string;
  /**
   * Objectifs de la formation et résultats de l'évaluation des acquis.
   *
   * L'article L.6353-1 du Code du travail impose que l'attestation mentionne
   * « les objectifs, la nature et la durée de l'action et les résultats de
   * l'évaluation des acquis ». Les deux manquaient au document.
   *
   * Optionnels : les attestations émises avant l'ajout de ces colonnes n'en
   * portent pas, et le gabarit ne doit pas casser à leur affichage.
   */
  objectives?: string[];
  assessmentSummary?: string | null;
}

const longDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatCertificateDate(date: Date): string {
  return longDateFormatter.format(date);
}

export function getAiducaTrainingLocation(): string {
  return BRAND.address.split(",").at(-1)?.trim() || "Montrouge";
}

