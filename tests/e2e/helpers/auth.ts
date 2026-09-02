// Helpers de connexion pour les tests de recette par rôle.
//
// Les comptes proviennent de `scripts/seed-qa-accounts.ts`, qui refuse de
// s'exécuter ailleurs qu'en local.

import { expect, type Page } from "@playwright/test";

export const QA_PASSWORD = "AuditQA2026!";

export const QA_ACCOUNTS = {
  student: "qa.eleve@audit.local",
  instructor: "qa.formateur@audit.local",
  /** Second formateur : sert à vérifier qu'un formateur reste dans ses cours. */
  instructor2: "qa.formateur2@audit.local",
  admin: "qa.admin@audit.local",
} as const;

/** Formations de recette, une par formateur. */
export const QA_COURSES = {
  instructor: "qa-formation-formateur-un",
  instructor2: "qa-formation-formateur-deux",
} as const;

export type QaRole = keyof typeof QA_ACCOUNTS;

/**
 * Connecte `page` avec le compte de recette du rôle demandé.
 * Renvoie `false` si la connexion échoue (seed de recette absent).
 */
export async function login(page: Page, role: QaRole): Promise<boolean> {
  await page.goto("/connexion");
  await page.fill("#email", QA_ACCOUNTS[role]);
  await page.fill("#password", QA_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
  // La connexion réussie quitte /connexion ; un échec y reste avec un message.
  return !new URL(page.url()).pathname.startsWith("/connexion");
}

/** Connecte et échoue explicitement si le compte de recette manque. */
export async function loginOrSkip(page: Page, role: QaRole): Promise<void> {
  const ok = await login(page, role);
  expect(
    ok,
    `Connexion ${role} impossible — lancez « npx tsx scripts/seed-qa-accounts.ts »`,
  ).toBe(true);
}
