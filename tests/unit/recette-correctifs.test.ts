// Verrous de non-régression sur les correctifs issus de la recette du
// 23 août 2026. Chacun de ces tests correspond à un défaut réellement observé
// en production ; ils sont écrits pour échouer si le défaut revient.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (chemin: string) =>
  readFileSync(join(process.cwd(), chemin), "utf8");

/**
 * Même source, commentaires retirés.
 *
 * Plusieurs correctifs sont documentés par un commentaire qui cite le motif
 * fautif — « ce module est en "use client" », « role="dialog" trompait les
 * lecteurs d'écran ». Une assertion de type `doesNotMatch` lancée sur le
 * fichier brut se déclencherait sur ces explications. Elle doit porter sur ce
 * que le code fait, pas sur ce qu'il raconte.
 */
const codeSeul = (chemin: string) =>
  source(chemin)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");

test("A-01 — aucune barre de filtres ne lit la globale DOM `status`", () => {
  // `status` résout silencieusement vers `Window.status` : le typage passe, le
  // rendu serveur lève un ReferenceError. Deux écrans du CRM ont été livrés
  // cassés de cette façon.
  for (const page of [
    "src/app/admin/utilisateurs/page.tsx",
    "src/app/admin/cours/page.tsx",
  ]) {
    const contenu = source(page);
    assert.doesNotMatch(
      contenu,
      /defaultValue=\{status\s*\?\?/,
      `${page} référence la globale DOM \`status\` au lieu de \`params.status\``,
    );
  }
});

test("A-01 — la règle ESLint qui attrape ces globales est bien active", () => {
  const config = source("eslint.config.mjs");
  assert.match(config, /no-restricted-globals/);
  for (const nom of ["status", "name", "length", "origin", "event"]) {
    assert.match(
      config,
      new RegExp(`name: "${nom}"`),
      `la globale \`${nom}\` n'est pas surveillée`,
    );
  }
});

test("A-02 — la fiche apprenant n'importe rien depuis un module « use client »", () => {
  const fiche = source("src/app/admin/utilisateurs/[id]/page.tsx");
  // Appeler une fonction exportée par un module client depuis un composant
  // serveur lève au rendu : « Attempted to call … from the server ».
  assert.doesNotMatch(
    fiche,
    /import \{[^}]*toDateInputValue[^}]*\} from "@\/components\//,
    "toDateInputValue doit venir d'un module neutre, pas du composant client",
  );
  assert.match(fiche, /from "@\/lib\/date-input"/);

  const helper = codeSeul("src/lib/date-input.ts");
  assert.doesNotMatch(helper, /"use client"/);
});

test("A-25 — l'export CSV des apprenants applique les filtres de l'écran", () => {
  const action = source("src/server/actions/admin-users.ts");

  // Sans filtre, l'export sortait les apprenants de TOUTES les entreprises
  // clientes : le fichier destiné à l'une contenait l'état civil et l'adresse
  // du domicile des salariés des autres.
  assert.match(
    action,
    /export async function exportUsersCsv\(\s*\n?\s*filters: AdminUsersFilters/,
    "exportUsersCsv doit recevoir les filtres",
  );
  assert.match(action, /buildAdminUsersWhere\(filters\)/);
  assert.doesNotMatch(
    action,
    /findMany\(\{\s*where: \{ role: "STUDENT" \},\s*orderBy: \{ createdAt: "desc" \},\s*take: 5000/,
    "l'export ne doit plus reconstruire une clause sans filtre",
  );
  // Le rattachement doit figurer sur chaque ligne et dans le nom du fichier.
  assert.match(action, /societe: u\.company\?\.name/);
  assert.match(action, /apprenants-\$\{perimetre\}/);

  // La liste et l'export doivent partager la même construction de périmètre.
  const requete = source("src/server/queries/admin-users.ts");
  assert.match(requete, /export function buildAdminUsersWhere/);
});

test("A-04 — la limitation de connexion s'indexe sur le couple IP + compte", () => {
  const limiteur = source("src/lib/auth/rate-limit-ip.ts");
  assert.match(limiteur, /scope\?: string/);
  assert.match(limiteur, /hashIp\(opts\.scope/);

  const action = source("src/server/actions/auth.ts");
  // Une salle de formation partage une seule IP publique : compter sur l'IP
  // seule y mutualise le quota et bloque tout le groupe.
  assert.match(action, /prefix: "auth:login",\s*\n\s*scope: parsed\.data\.email/);
});

test("A-04 — le verrouillage de compte n'annonce plus l'existence du compte", () => {
  const verrou = source("src/lib/auth/login-attempts.ts");
  // Un verrou ne se déclenche que sur une adresse inscrite : l'annoncer
  // permettait d'énumérer les comptes en six tentatives.
  assert.doesNotMatch(verrou, /return `Compte verrouillé/);
  assert.doesNotMatch(verrou, /Compte temporairement verrouillé après plusieurs échecs/);
  assert.match(verrou, /const base = "Email ou mot de passe incorrect\."/);
});

test("A-03 — le lien de réinitialisation disparaît quand l'e-mail n'est pas configuré", () => {
  const formulaire = source("src/components/features/auth/login-form.tsx");
  assert.match(formulaire, /passwordResetAvailable/);
  assert.match(formulaire, /Contactez le centre/);

  const page = source("src/app/(auth)/connexion/page.tsx");
  assert.match(page, /isTransactionalEmailConfigured\(\)/);
});

test("A-07 — l'attestation porte les mentions de l'article L.6353-1", () => {
  const schema = source("prisma/schema.prisma");
  // Figées à l'émission, comme le nom du titulaire : remanier un programme ne
  // doit pas réécrire une attestation déjà remise.
  assert.match(schema, /objectives\s+String\[\]/);
  assert.match(schema, /assessmentSummary String\?/);

  const emission = source("src/server/actions/certificates.ts");
  assert.match(emission, /objectives: course\?\.whatYouWillLearn/);
  assert.match(emission, /assessmentSummary: summarizeAssessment\(attempts\)/);

  const gabarit = source("src/components/features/learning/certificate-preview.tsx");
  assert.match(gabarit, /Objectifs de la formation/);
  assert.match(gabarit, /Résultats de l’évaluation des acquis/);

  const pdf = source("src/lib/pdf-certificate.ts");
  assert.match(pdf, /Objectifs de la formation/);
  assert.match(pdf, /Résultats de l'évaluation des acquis/);
});

test("A-08 — les demandes RGPD exécutent réellement l'opération", () => {
  const service = source("src/server/services/gdpr.ts");
  assert.match(service, /export async function buildUserDataExport/);
  assert.match(service, /export async function eraseUserData/);
  // L'anonymisation doit vider les champs d'identité, pas seulement changer le
  // statut du compte.
  for (const champ of ["firstName", "lastName", "birthDate", "phone", "address", "hashedPassword"]) {
    assert.match(service, new RegExp(`${champ}: null`), `${champ} n'est pas effacé`);
  }

  const action = source("src/server/actions/admin-users.ts");
  assert.match(action, /await eraseUserData\(userId\)/);
  assert.match(action, /await buildUserDataExport\(userId\)/);
  // L'ancienne version se contentait de poser le statut DELETED.
  assert.doesNotMatch(action, /On ne supprime PAS immédiatement/);

  // La clôture manuelle exige désormais de dire comment la demande a été
  // honorée hors plateforme.
  const securite = source("src/server/actions/admin-security.ts");
  assert.match(securite, /justification\?: string/);
  assert.match(securite, /gdpr\.complete-manual/);
});

test("A-11 — le badge « Bestseller » ne s'obtient plus par simple épinglage", () => {
  const badges = source("src/lib/courses/badges.ts");
  assert.doesNotMatch(
    badges,
    /course\.isFeatured \|\|\s*\n?\s*course\.totalEnrollments >= BESTSELLER_MIN_ENROLLMENTS/,
    "une formation épinglée ne doit pas être déclarée Bestseller",
  );
  assert.match(badges, /if \(course\.totalEnrollments >= BESTSELLER_MIN_ENROLLMENTS\)/);
  assert.match(badges, /label: "Sélection du centre"/);
});

test("A-12 — le jeu de démonstration ne fabrique plus de notes ni d'avis", () => {
  const seed = source("prisma/seed.ts");
  assert.doesNotMatch(seed, /averageRating: [1-9]/, "note fabriquée dans le seed");
  assert.doesNotMatch(seed, /totalRatings: [1-9]/, "nombre d'avis fabriqué dans le seed");
  assert.doesNotMatch(seed, /totalEnrollments: [1-9]/, "nombre d'inscrits fabriqué dans le seed");
  // Et le script refuse de s'exécuter ailleurs qu'en local.
  assert.match(seed, /function refuseProduction/);
  assert.match(seed, /SEED_ALLOW_REMOTE/);
});

test("A-10 — la bannière cookies n'est plus un dialogue et réserve sa place", () => {
  const banniere = codeSeul("src/components/features/cookie-consent/cookie-banner.tsx");
  assert.doesNotMatch(banniere, /role="dialog"/);
  assert.match(banniere, /role="region"/);
  // `scroll-padding-bottom` empêche un élément amené à l'écran de s'arrêter
  // sous la bannière, où ses clics étaient absorbés.
  assert.match(banniere, /scrollPaddingBottom/);
});

test("A-09 — le champ de recherche déclare le rôle qui admet aria-expanded", () => {
  const recherche = source("src/components/features/courses/header-search.tsx");
  assert.match(recherche, /role="combobox"/);
  assert.match(recherche, /aria-expanded=\{showPopover\}/);
});

test("A-13 — le déploiement exécute la suite end-to-end et le test de fumée admin", () => {
  const deploy = source("scripts/deploy.sh");
  assert.match(deploy, /playwright test/);
  assert.match(deploy, /admin-smoke\.spec\.ts/);
  assert.match(deploy, /E2E_ADMIN_EMAIL/);
  // Et les pages publiques sont contrôlées après redéploiement : une page qui
  // plante au rendu répond 200 avec sa frontière d'erreur.
  assert.match(deploy, /Impossible de charger\|Une erreur est survenue/);
});
