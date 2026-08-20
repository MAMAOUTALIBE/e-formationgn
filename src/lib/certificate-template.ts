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

