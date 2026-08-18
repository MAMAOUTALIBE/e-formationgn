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

test("accepte les trois types de questions avec leurs réponses valides", () => {
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
