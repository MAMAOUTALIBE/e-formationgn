import type { UserRole } from "@/generated/prisma/enums";

/**
 * Frontière métier entre les comptes qui apprennent et ceux qui exploitent
 * la plateforme. Un compte interne ne doit jamais tomber implicitement dans
 * les listes ou actions destinées aux apprenants.
 */
export const LEARNER_ROLE = "STUDENT" as const satisfies UserRole;

export const STAFF_ROLES = [
  "INSTRUCTOR",
  "MANAGER",
  "MODERATOR",
  "SUPPORT",
  "FINANCE",
  "ADMIN",
] as const satisfies readonly UserRole[];

export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  INSTRUCTOR: "Formateur",
  MANAGER: "Gestionnaire",
  MODERATOR: "Modérateur",
  SUPPORT: "Support",
  FINANCE: "Accès historique",
  ADMIN: "Administrateur",
};

export function isStaffRole(role: UserRole): role is StaffRole {
  return (STAFF_ROLES as readonly UserRole[]).includes(role);
}
