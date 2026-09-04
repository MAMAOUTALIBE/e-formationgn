import assert from "node:assert/strict";
import test from "node:test";

import { chunkDocument } from "../../src/lib/assistant/chunking";

// Le découpage conditionne la qualité de la recherche : un document mal
// fragmenté remonte sur tout, ou sur rien.

const CMS_LIKE = `Modalités d'inscription :
Aiduca est un centre de formation. Il n'y a pas de vente en ligne.

Qui ouvre l'accès :
L'inscription est enregistrée par l'équipe Aiduca.

Tarifs :
Les tarifs ne sont pas affichés sur le site.`;

test("le document est découpé sur ses titres de section", () => {
  const chunks = chunkDocument(CMS_LIKE, "Comment s'inscrire");

  assert.equal(chunks.length, 3);
  assert.deepEqual(
    chunks.map((c) => c.heading),
    ["Modalités d'inscription", "Qui ouvre l'accès", "Tarifs"],
  );
});

test("les positions sont contiguës et commencent à zéro", () => {
  const chunks = chunkDocument(CMS_LIKE, "Comment s'inscrire");

  assert.deepEqual(
    chunks.map((c) => c.position),
    [0, 1, 2],
  );
});

test("les titres markdown sont reconnus au même titre", () => {
  const chunks = chunkDocument(
    "## Prise en charge\nLe financement passe par un OPCO.\n\n## Qualiopi\nLe centre est certifié.",
    "Financement",
  );

  assert.deepEqual(
    chunks.map((c) => c.heading),
    ["Prise en charge", "Qualiopi"],
  );
});

test("un document sans titre de section hérite du titre du document", () => {
  const chunks = chunkDocument(
    "Un paragraphe simple, sans aucun titre de section.",
    "Politique cookies",
  );

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].heading, "Politique cookies");
});

test("une phrase terminée par « : » au milieu d'un texte n'est pas prise pour un titre", () => {
  // Sans ce garde-fou, chaque énumération en cours de phrase créerait un
  // fragment d'une ligne, inexploitable en recherche.
  const chunks = chunkDocument(
    "Le centre accompagne les apprenants. Voici les modalités : inscription, suivi, attestation.",
    "Modalités",
  );

  assert.equal(chunks.length, 1);
});

test("le découpage est déterministe", () => {
  const first = chunkDocument(CMS_LIKE, "Comment s'inscrire");
  const second = chunkDocument(CMS_LIKE, "Comment s'inscrire");

  assert.deepEqual(first, second, "la réindexation doit être idempotente");
});

test("une section très longue est coupée sans dépasser la taille visée", () => {
  const paragraph = "Une phrase de contenu pédagogique assez longue. ".repeat(80);
  const chunks = chunkDocument(`Section longue :\n${paragraph}`, "Document");

  assert.ok(chunks.length > 1, "une section de plusieurs milliers de caractères doit être coupée");
  for (const chunk of chunks) {
    assert.ok(
      chunk.content.length <= 1200,
      `un fragment dépasse la taille visée (${chunk.content.length})`,
    );
  }
});

test("aucun fragment vide n'est produit", () => {
  const chunks = chunkDocument(
    "Titre :\n\n\n\nContenu utile.\n\n\n\nAutre titre :\n\nSuite.",
    "Document",
  );

  for (const chunk of chunks) {
    assert.ok(chunk.content.trim().length > 0, "un fragment vide polluerait l'index");
  }
});

test("un corps vide ne produit aucun fragment", () => {
  assert.deepEqual(chunkDocument("   \n\n  ", "Document"), []);
});

test("le contenu du document se retrouve intégralement dans les fragments", () => {
  const chunks = chunkDocument(CMS_LIKE, "Comment s'inscrire");
  const recomposed = chunks.map((c) => c.content).join("\n");

  for (const phrase of [
    "pas de vente en ligne",
    "enregistrée par l'équipe Aiduca",
    "ne sont pas affichés",
  ]) {
    assert.match(recomposed, new RegExp(phrase), `« ${phrase} » ne doit pas être perdu`);
  }
});

test("une phrase de plus de 1 200 caractères n'est jamais tronquée", () => {
  const body = Array.from({ length: 400 }, (_, index) => `mot${index}`).join(" ");
  const chunks = chunkDocument(body, "Très longue phrase");
  const recomposed = chunks.map((chunk) => chunk.content).join(" ");

  assert.ok(chunks.length > 1);
  assert.equal(recomposed, body, "la fin du texte doit rester indexée");
  assert.ok(chunks.every((chunk) => chunk.content.length <= 1200));
});
