import assert from "node:assert/strict";
import test from "node:test";

import {
  quizMetaSchema,
  quizQuestionSchema,
} from "../../src/lib/validators/learning";

const baseQuestion = {
  prompt: "Quelle réponse est correcte ?",
  explanation: "Une explication utile.",
  points: 1,
};

test("accepte les trois types de questions classiques avec leurs réponses valides", () => {
  assert.equal(
    quizQuestionSchema.safeParse({
      ...baseQuestion,
      kind: "SINGLE_CHOICE",
      options: [
        { label: "A", isCorrect: true },
        { label: "B", isCorrect: false },
      ],
    }).success,
    true,
  );
  assert.equal(
    quizQuestionSchema.safeParse({
      ...baseQuestion,
      kind: "MULTIPLE_CHOICE",
      options: [
        { label: "A", isCorrect: true },
        { label: "B", isCorrect: true },
      ],
    }).success,
    true,
  );
  assert.equal(
    quizQuestionSchema.safeParse({
      ...baseQuestion,
      kind: "TRUE_FALSE",
      options: [
        { label: "Vrai", isCorrect: false },
        { label: "Faux", isCorrect: true },
      ],
    }).success,
    true,
  );
});

test("valide les questions visuelles et leurs configurations", () => {
  assert.equal(quizQuestionSchema.safeParse({
    ...baseQuestion,
    kind: "IMAGE_CHOICE",
    imageUrl: "/uploads/question.webp",
    imageAlt: "Quatre détails constructifs",
    options: [
      { label: "Solution A", isCorrect: true, imageUrl: "/uploads/a.webp", imageAlt: "Solution A" },
      { label: "Solution B", isCorrect: false, imageUrl: "/uploads/b.webp", imageAlt: "Solution B" },
    ],
  }).success, true);

  assert.equal(quizQuestionSchema.safeParse({
    ...baseQuestion,
    kind: "DRAG_DROP",
    interactionConfig: { targets: [{ id: "rebond", label: "Effet rebond" }, { id: "chauffage", label: "Lot chauffage" }] },
    options: [
      { label: "Température augmentée", isCorrect: false, targetId: "rebond" },
      { label: "Régulation inchangée", isCorrect: false, targetId: "chauffage" },
    ],
  }).success, true);

  assert.equal(quizQuestionSchema.safeParse({
    ...baseQuestion,
    kind: "HOTSPOT",
    imageUrl: "/uploads/facade.webp",
    imageAlt: "Façade avec désordre",
    answerConfig: { x: 72, y: 34, radius: 9 },
    options: [],
  }).success, true);
});

test("refuse une question visuelle sans média, cible ou zone correcte", () => {
  assert.equal(quizQuestionSchema.safeParse({ ...baseQuestion, kind: "IMAGE_CHOICE", options: [
    { label: "A", isCorrect: true }, { label: "B", isCorrect: false },
  ] }).success, false);
  assert.equal(quizQuestionSchema.safeParse({ ...baseQuestion, kind: "DRAG_DROP", interactionConfig: { targets: [
    { id: "a", label: "A" }, { id: "b", label: "B" },
  ] }, options: [
    { label: "Carte A", isCorrect: false, targetId: "inconnue" },
    { label: "Carte B", isCorrect: false, targetId: "b" },
  ] }).success, false);
  assert.equal(quizQuestionSchema.safeParse({ ...baseQuestion, kind: "HOTSPOT", imageUrl: "/image.webp", options: [] }).success, false);
});

test("refuse plusieurs bonnes réponses pour choix unique et Vrai/Faux", () => {
  for (const kind of ["SINGLE_CHOICE", "TRUE_FALSE"] as const) {
    const labels = kind === "TRUE_FALSE" ? ["Vrai", "Faux"] : ["A", "B"];
    const result = quizQuestionSchema.safeParse({
      ...baseQuestion,
      kind,
      options: labels.map((label) => ({ label, isCorrect: true })),
    });
    assert.equal(result.success, false);
  }
});

test("impose exactement Vrai puis Faux pour une question booléenne", () => {
  const result = quizQuestionSchema.safeParse({
    ...baseQuestion,
    kind: "TRUE_FALSE",
    options: [
      { label: "Oui", isCorrect: true },
      { label: "Non", isCorrect: false },
    ],
  });
  assert.equal(result.success, false);
});

test("refuse la chaîne 'false' comme valeur booléenne ambiguë", () => {
  const result = quizQuestionSchema.safeParse({
    ...baseQuestion,
    kind: "SINGLE_CHOICE",
    options: [
      { label: "A", isCorrect: true },
      { label: "B", isCorrect: "false" },
    ],
  });
  assert.equal(result.success, false);

  const multipleChoiceResult = quizQuestionSchema.safeParse({
    ...baseQuestion,
    kind: "MULTIPLE_CHOICE",
    options: [
      { label: "A", isCorrect: true },
      { label: "B", isCorrect: "false" },
    ],
  });
  assert.equal(multipleChoiceResult.success, false);
});

test("valide les bornes des paramètres du quiz", () => {
  assert.equal(
    quizMetaSchema.safeParse({
      title: "Quiz final",
      description: "",
      passingScore: "70",
      maxAttempts: "3",
    }).success,
    true,
  );
  assert.equal(
    quizMetaSchema.safeParse({
      title: "Quiz final",
      description: "",
      passingScore: "101",
      maxAttempts: "0",
    }).success,
    false,
  );
});
