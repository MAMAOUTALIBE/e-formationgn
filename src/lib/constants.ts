// Constantes & enums centralisés du domaine.
//
// Source de vérité côté code pour les rôles, statuts, devises. Évite la
// dispersion de magic strings dans tout le projet. Les enums Prisma restent
// la source de vérité côté DB ; ces constants doivent rester en cohérence.

import type { Currency, UserRole } from "@/generated/prisma/enums";

// ===========================================================================
// Rôles utilisateurs
// ===========================================================================

/** Tous les rôles existants (incluant les sous-rôles administratifs). */
export const ALL_ROLES = [
  "STUDENT",
  "INSTRUCTOR",
  "ADMIN",
  "MODERATOR",
  "SUPPORT",
  "FINANCE",
] as const satisfies readonly UserRole[];

/** Rôles avec accès admin (full ou sous-rôle CRM). */
// Rôles ayant accès au CRM. MANAGER (gestionnaire de formation) en fait
// partie : il travaille dans le back-office. Ce qu'il y voit est décidé
// section par section dans le registre de navigation, qui sert aussi de garde
// de route — cf. src/lib/workspace/admin-nav.ts.
export const ADMIN_ROLES = [
  "ADMIN",
  "MODERATOR",
  "SUPPORT",
  "FINANCE",
  "MANAGER",
] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Rôles autorisés sur l'espace formateur (CRUD cours, lessons). */
export const INSTRUCTOR_OR_ADMIN_ROLES = ["INSTRUCTOR", "ADMIN"] as const;
export type InstructorOrAdminRole = (typeof INSTRUCTOR_OR_ADMIN_ROLES)[number];

export function isAdminRole(role: UserRole | string | null | undefined): boolean {
  return typeof role === "string" && (ADMIN_ROLES as readonly string[]).includes(role);
}

export function isInstructorOrAdmin(
  role: UserRole | string | null | undefined,
): boolean {
  return (
    typeof role === "string" &&
    (INSTRUCTOR_OR_ADMIN_ROLES as readonly string[]).includes(role)
  );
}

// ===========================================================================
// Devises
// ===========================================================================

export const SUPPORTED_CURRENCIES = ["EUR", "USD"] as const satisfies readonly Currency[];
export const DEFAULT_CURRENCY: Currency = "EUR";

// ===========================================================================
// Statuts cours
// ===========================================================================

export const COURSE_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
  "ARCHIVED",
] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

// ===========================================================================
// Statuts compte
// ===========================================================================

export const ACCOUNT_STATUSES = [
  "ACTIVE",
  "SUSPENDED",
  "PENDING_VERIFICATION",
  "DELETED",
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

// ===========================================================================
// Statuts commande
// ===========================================================================

export const ORDER_STATUSES = [
  "PENDING",
  "PROCESSING",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
