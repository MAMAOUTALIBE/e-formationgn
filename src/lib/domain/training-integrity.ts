export const ACTIVE_PROGRAM_REQUIRES_COURSE =
  "Un programme actif doit contenir au moins un cours.";

export function canActivateProgram(courseCount: number): boolean {
  return Number.isInteger(courseCount) && courseCount > 0;
}

export const CERTIFICATE_REQUIRES_COMPLETION =
  "Terminez l'ensemble des leçons avant de générer votre attestation.";

export function canIssueCertificate(enrollment: {
  progressPercent: number;
  completedAt: Date | null;
}): boolean {
  return enrollment.progressPercent === 100 && enrollment.completedAt !== null;
}
