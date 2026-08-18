export type QuizSubmissionQuestion = {
  id: string;
  kind: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  options: Array<{ id: string }>;
};

export type QuizSubmissionAnswer = {
  questionId: string;
  optionIds: string[];
};

export function validateQuizSubmission(
  questions: QuizSubmissionQuestion[],
  answers: QuizSubmissionAnswer[],
): { valid: true } | { valid: false; message: string } {
  if (answers.length !== questions.length) {
    return { valid: false, message: "Toutes les questions doivent recevoir une réponse." };
  }

  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const submittedQuestionIds = new Set<string>();

  for (const answer of answers) {
    if (submittedQuestionIds.has(answer.questionId)) {
      return { valid: false, message: "Une question ne peut être envoyée qu’une seule fois." };
    }
    submittedQuestionIds.add(answer.questionId);

    const question = questionsById.get(answer.questionId);
    if (!question) {
      return { valid: false, message: "La soumission contient une question inconnue." };
    }

    const uniqueOptionIds = new Set(answer.optionIds);
    if (uniqueOptionIds.size !== answer.optionIds.length) {
      return { valid: false, message: "Une même réponse ne peut pas être sélectionnée deux fois." };
    }

    const allowedOptionIds = new Set(question.options.map((option) => option.id));
    if (answer.optionIds.some((optionId) => !allowedOptionIds.has(optionId))) {
      return { valid: false, message: "Une réponse ne correspond pas à sa question." };
    }

    if (question.kind === "MULTIPLE_CHOICE") {
      if (answer.optionIds.length < 1) {
        return { valid: false, message: "Sélectionnez au moins une réponse." };
      }
    } else if (answer.optionIds.length !== 1) {
      return { valid: false, message: "Sélectionnez exactement une réponse." };
    }
  }

  if (questions.some((question) => !submittedQuestionIds.has(question.id))) {
    return { valid: false, message: "Toutes les questions doivent recevoir une réponse." };
  }
  return { valid: true };
}
