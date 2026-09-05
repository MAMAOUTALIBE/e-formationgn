export type QuizSubmissionQuestion = {
  id: string;
  kind:
    | "SINGLE_CHOICE"
    | "MULTIPLE_CHOICE"
    | "TRUE_FALSE"
    | "IMAGE_CHOICE"
    | "DRAG_DROP"
    | "HOTSPOT";
  options: Array<{ id: string }>;
  interactionConfig?: unknown;
};

export type QuizSubmissionAnswer = {
  questionId: string;
  optionIds: string[];
  placements?: Array<{ optionId: string; targetId: string }>;
  point?: { x: number; y: number };
};

function publicTargetIds(config: unknown): Set<string> {
  if (!config || typeof config !== "object" || !("targets" in config)) return new Set();
  const targets = (config as { targets?: unknown }).targets;
  if (!Array.isArray(targets)) return new Set();
  return new Set(
    targets.flatMap((target) =>
      target && typeof target === "object" && "id" in target && typeof target.id === "string"
        ? [target.id]
        : [],
    ),
  );
}

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

    if (question.kind === "DRAG_DROP") {
      if (answer.optionIds.length !== 0 || answer.point) {
        return { valid: false, message: "Le classement contient des données incompatibles." };
      }
      const placements = answer.placements ?? [];
      const placedOptionIds = new Set(placements.map((placement) => placement.optionId));
      const targetIds = publicTargetIds(question.interactionConfig);
      if (
        placements.length !== question.options.length ||
        placedOptionIds.size !== placements.length ||
        placements.some(
          (placement) =>
            !allowedOptionIds.has(placement.optionId) || !targetIds.has(placement.targetId),
        )
      ) {
        return { valid: false, message: "Placez chaque carte dans une catégorie." };
      }
    } else if (question.kind === "HOTSPOT") {
      if (answer.optionIds.length !== 0 || answer.placements?.length || !answer.point) {
        return { valid: false, message: "Cliquez sur une zone de l’image." };
      }
    } else if (answer.placements?.length || answer.point) {
      return { valid: false, message: "La réponse contient des données incompatibles." };
    } else if (question.kind === "MULTIPLE_CHOICE") {
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
