import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUnavailableAnswer,
  isSafeAssistantLink,
  normalizeAssistantAnswer,
  stripUnsafeLinks,
  type AssistantContext,
  type RawAssistantAnswer,
} from "../../src/lib/assistant/contract";
import { assistantDocumentSchema } from "../../src/lib/validators/assistant";

// Ces tests portent sur la promesse centrale d'Aiduca-IA : ne rien affirmer
// qui ne soit appuyé sur les données réelles du centre. Ils s'exécutent sans
// base, sans clé API et sans appel facturé — c'est justement ce qui permet de
// les faire tourner à chaque commit.

function makeContext(): AssistantContext {
  return {
    courses: [
      {
        sourceId: "formation:bureautique-excel",
        slug: "bureautique-excel",
        title: "Excel pour le bureau",
        subtitle: null,
        categoryName: "Bureautique",
        levelLabel: "Tous niveaux",
        durationLabel: "12 h",
        lessonCount: 24,
        sectionCount: 4,
        requirements: ["Savoir utiliser un ordinateur"],
        objectives: ["Construire un tableau croisé dynamique"],
        audience: ["Assistants administratifs"],
        description: "Formation Excel.",
        url: "/cours/bureautique-excel",
      },
    ],
    documents: [
      {
        sourceId: "doc:auto-inscription#0",
        documentSlug: "auto-inscription",
        title: "Comment s'inscrire",
        heading: "Modalités",
        content: "L'inscription est ouverte par le centre.",
        sourceLabel: "Fonctionnement du centre",
        sourceUrl: "/contact",
      },
    ],
    sessions: [],
  };
}

function makeRaw(overrides: Partial<RawAssistantAnswer> = {}): RawAssistantAnswer {
  return {
    reponse: "Voici la réponse.",
    certitude: "CERTAINE",
    sourcesUtilisees: ["formation:bureautique-excel"],
    formationsCitees: ["bureautique-excel"],
    proposerConseiller: false,
    questionsSuggerees: ["Quels sont les prérequis ?"],
    ...overrides,
  };
}

test("une formation citée mais absente du contexte est supprimée", () => {
  const answer = normalizeAssistantAnswer(
    makeRaw({ formationsCitees: ["formation-qui-nexiste-pas", "bureautique-excel"] }),
    makeContext(),
  );

  assert.deepEqual(
    answer.courses.map((c) => c.slug),
    ["bureautique-excel"],
    "seul le slug présent dans le contexte doit produire un bouton",
  );
});

test("un bouton de formation pointe toujours vers l'URL construite côté serveur", () => {
  const answer = normalizeAssistantAnswer(makeRaw(), makeContext());

  assert.equal(answer.courses[0].url, "/cours/bureautique-excel");
  assert.equal(answer.courses[0].title, "Excel pour le bureau");
});

test("une même formation citée deux fois ne produit qu'un bouton", () => {
  const answer = normalizeAssistantAnswer(
    makeRaw({ formationsCitees: ["bureautique-excel", "bureautique-excel"] }),
    makeContext(),
  );

  assert.equal(answer.courses.length, 1);
});

test("une certitude partielle force la proposition de conseiller", () => {
  const answer = normalizeAssistantAnswer(
    makeRaw({ certitude: "PARTIELLE", proposerConseiller: false }),
    makeContext(),
  );

  assert.equal(answer.offerAdvisor, true, "l'utilisateur doit pouvoir joindre un humain");
  assert.equal(answer.answered, false, "la question doit remonter dans l'admin");
});

test("une certitude inconnue marque la question comme sans réponse", () => {
  const answer = normalizeAssistantAnswer(
    makeRaw({ certitude: "INCONNUE", proposerConseiller: false }),
    makeContext(),
  );

  assert.equal(answer.answered, false);
  assert.equal(answer.offerAdvisor, true);
});

test("une certitude non reconnue est traitée comme inconnue", () => {
  const answer = normalizeAssistantAnswer(
    // Le modèle renvoie du JSON : une valeur hors énumération reste possible.
    makeRaw({ certitude: "TRÈS SÛR" as never }),
    makeContext(),
  );

  assert.equal(answer.certainty, "INCONNUE");
  assert.equal(answer.answered, false);
});

test("une réponse certaine ne force pas l'escalade", () => {
  const answer = normalizeAssistantAnswer(makeRaw(), makeContext());

  assert.equal(answer.answered, true);
  assert.equal(answer.offerAdvisor, false);
});

test("une source inventée est écartée du journal des sources", () => {
  const answer = normalizeAssistantAnswer(
    makeRaw({ sourcesUtilisees: ["doc:inexistant#9", "doc:auto-inscription#0"] }),
    makeContext(),
  );

  assert.deepEqual(answer.sourceIds, ["doc:auto-inscription#0"]);
});

test("les routes neutralisées par le proxy ne sont jamais des liens valides", () => {
  // src/proxy.ts renvoie 404 sur ces chemins : un lien vers eux serait mort.
  for (const dead of [
    "/panier",
    "/commande",
    "/commande/123/confirmation",
    "/admin/finances",
    "/admin/commissions",
    "/formateur/paiements",
  ]) {
    assert.equal(isSafeAssistantLink(dead), false, `${dead} doit être refusé`);
  }
});

test("les routes publiques vivantes sont acceptées", () => {
  for (const alive of [
    "/",
    "/cours",
    "/cours/bureautique-excel",
    "/categories/bureautique",
    "/aide",
    "/contact",
    "/confidentialite",
    "/certificat/EFGN-2026-0001",
    "mailto:info@aiduca.fr",
    "tel:0158423830",
  ]) {
    assert.equal(isSafeAssistantLink(alive), true, `${alive} doit être accepté`);
  }
});

test("un lien externe est refusé, même vers un domaine plausible", () => {
  for (const external of [
    "https://exemple.test/phishing",
    "//exemple.test",
    "javascript:alert(1)",
    "",
  ]) {
    assert.equal(isSafeAssistantLink(external), false, `${external} doit être refusé`);
  }
});

test("un lien interdit est retiré du texte mais son libellé est conservé", () => {
  const cleaned = stripUnsafeLinks(
    "Ajoutez la formation à votre [panier](/panier) puis consultez la [fiche](/cours/excel).",
  );

  assert.match(cleaned, /votre panier puis/, "le libellé doit survivre au lien");
  assert.doesNotMatch(cleaned, /\(\/panier\)/, "le lien mort doit disparaître");
  assert.match(cleaned, /\[fiche\]\(\/cours\/excel\)/, "le lien valide reste intact");
});

test("une réponse vide retombe sur un texte utile plutôt que sur du blanc", () => {
  const answer = normalizeAssistantAnswer(makeRaw({ reponse: "   " }), makeContext());

  assert.ok(answer.text.length > 0);
  assert.match(answer.text, /conseiller/i);
});

test("les suggestions sont bornées à trois et débarrassées du vide", () => {
  const answer = normalizeAssistantAnswer(
    makeRaw({ questionsSuggerees: ["a", "", "   ", "b", "c", "d"] }),
    makeContext(),
  );

  assert.equal(answer.suggestions.length, 3);
  assert.deepEqual(answer.suggestions, ["a", "b", "c"]);
});

test("la réponse de repli propose systématiquement un conseiller", () => {
  const answer = buildUnavailableAnswer("Indisponible.");

  assert.equal(answer.offerAdvisor, true);
  assert.equal(answer.answered, false);
  assert.deepEqual(answer.courses, []);
});

test("une source documentaire ne peut pas pointer vers une route interne d'administration", () => {
  const base = {
    slug: "document-test",
    title: "Document de test",
    category: "Essentiels",
    body: "Ce document contient suffisamment de texte pour être valide.",
    sourceLabel: "Source",
    isPublished: true,
    position: 0,
  };

  assert.equal(
    assistantDocumentSchema.safeParse({ ...base, sourceUrl: "/aide" }).success,
    true,
  );
  assert.equal(
    assistantDocumentSchema.safeParse({ ...base, sourceUrl: "/admin/users" }).success,
    false,
  );
});
