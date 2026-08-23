// Verrous sur la traçabilité réglementaire d'un organisme de formation.
//
// Chaque test correspond à une exigence nommée. Ils sont écrits pour échouer si
// le chaînage entre la couche « organisme » et la couche « e-learning » venait
// à se rompre — c'est de lui que dépend toute la valeur probante.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { formatDuree } from "@/lib/duration";

const source = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

test("le chaînon session existe dans le modèle, pas seulement dans le code", () => {
  const schema = source("prisma/schema.prisma");

  // Sans ces deux colonnes, aucune feuille d'émargement n'est calculable :
  // le temps mesuré pendait à l'accès au cours, qui ignorait la session.
  assert.match(
    schema,
    /model Enrollment[\s\S]*?registrationId String\?/,
    "Enrollment doit porter le rattachement à l'inscription",
  );
  assert.match(
    schema,
    /model LearningSession[\s\S]*?registrationId String\?/,
    "LearningSession doit figer le rattachement au moment de la mesure",
  );
  assert.match(schema, /model Registration[\s\S]*?enrollments\s+Enrollment\[\]/);
  assert.match(schema, /model Registration[\s\S]*?learningSessions LearningSession\[\]/);
});

test("le rattachement est écrit à l'octroi de l'accès et à la mesure du temps", () => {
  const octroi = source("src/server/services/registration-access.ts");
  assert.match(octroi, /registrationId: registration\.id/);

  const mesure = source("src/server/actions/learning.ts");
  // Figé à la création de la session de suivi : deux sessions d'un même
  // programme restent ainsi distinctes malgré l'unicité (utilisateur, cours).
  assert.match(mesure, /registrationId: enrollment\.registrationId/);
  assert.match(mesure, /select: \{ id: true, registrationId: true \}/);
});

test("la migration reprend l'historique sans jamais deviner", () => {
  const migration = source(
    "prisma/migrations/20260823101941_registration_traceability/migration.sql",
  );
  assert.match(migration, /UPDATE "Enrollment"/);
  // Le garde-fou : on ne rattache que lorsqu'une seule inscription peut
  // justifier l'accès. Une feuille d'émargement fausse est pire qu'incomplète.
  assert.match(migration, /concurrentes = 1/);
  assert.match(migration, /status <> 'CANCELLED'/);
});

test("l'émargement agrège par journée civile côté base, pas en JavaScript", () => {
  const requete = source("src/server/queries/attendance.ts");
  // Le regroupement doit connaître le fuseau du centre : fait en JavaScript,
  // une séance du soir basculerait au lendemain sur la feuille.
  assert.match(requete, /AT TIME ZONE 'Europe\/Paris'/);
  assert.match(requete, /date_trunc\('day'/);
  // Les inscrits qui ne se sont jamais connectés doivent figurer : une feuille
  // qui n'énumère que les présents ne prouve rien.
  assert.match(requete, /sansActivite/);
  assert.match(requete, /status: \{ not: "CANCELLED" \}/);
});

test("la feuille d'émargement est réservée et journalisée", () => {
  const route = source("src/app/api/admin/sessions/[sessionId]/emargement/route.ts");
  assert.match(route, /requireAnyAdminRole\("ADMIN", "MANAGER", "SUPPORT"\)/);
  // Le document sort de l'organisme et porte des données nominatives : savoir
  // qui l'a édité fait partie de la traçabilité.
  assert.match(route, /action: "attendance\.export"/);
  assert.match(route, /Content-Disposition/);
});

test("l'attestation porte les mentions de l'article L.6353-1", () => {
  const schema = source("prisma/schema.prisma");
  assert.match(schema, /model Certificate[\s\S]*?objectives\s+String\[\]/);
  assert.match(schema, /model Certificate[\s\S]*?assessmentSummary String\?/);
  assert.match(schema, /model Certificate[\s\S]*?completedSeconds Int\?/);

  const emission = source("src/server/actions/certificates.ts");
  // Toutes figées à l'émission : remanier une formation ne doit pas réécrire un
  // document déjà remis à un stagiaire et vérifiable par son employeur.
  assert.match(emission, /completedSeconds:/);
  assert.match(emission, /registrationId: suivi\?\.registrationId/);
});

test("l'attestation cite les dates et le lieu de la session, pas ceux de l'accès", () => {
  const route = source("src/app/api/certificats/[serial]/route.ts");
  assert.match(route, /sessionFormation\?\.startDate/);
  assert.match(route, /sessionFormation\?\.endDate/);
  assert.match(route, /sessionFormation\?\.location/);

  const ecran = source("src/app/apprentissage/[slug]/page.tsx");
  assert.match(ecran, /certificate\?\.registration\?\.session\.startDate/);

  const requete = source("src/server/queries/learning.ts");
  assert.match(requete, /registration: \{[\s\S]*?session: \{ select:/);
});

test("formatDuree produit un libellé lisible sur un document officiel", () => {
  assert.equal(formatDuree(0), "—");
  assert.equal(formatDuree(-10), "—");
  assert.equal(formatDuree(3300), "55 min");
  assert.equal(formatDuree(7200), "2 h");
  assert.equal(formatDuree(5400), "1 h 30");
  assert.equal(formatDuree(15900), "4 h 25");
  // Les minutes sont sur deux chiffres : « 4 h 05 » et non « 4 h 5 ».
  assert.equal(formatDuree(3600 + 300), "1 h 05");
});
