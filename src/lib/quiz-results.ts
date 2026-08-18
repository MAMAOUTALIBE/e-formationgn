export interface AttemptMetric {
  userId: string;
  score: number;
  passed: boolean;
}

export interface QuizMetricInput {
  id: string;
  attempts: AttemptMetric[];
}

export function computeQuizResultMetrics(
  enrollmentCount: number,
  quizzes: QuizMetricInput[],
) {
  const attempts = quizzes.flatMap((quiz) => quiz.attempts);
  const learnersStarted = new Set(attempts.map((attempt) => attempt.userId)).size;
  let startedLearnerQuizzes = 0;
  let passedLearnerQuizzes = 0;
  for (const quiz of quizzes) {
    const byLearner = new Map<string, boolean>();
    for (const attempt of quiz.attempts) {
      byLearner.set(attempt.userId, (byLearner.get(attempt.userId) ?? false) || attempt.passed);
    }
    startedLearnerQuizzes += byLearner.size;
    passedLearnerQuizzes += [...byLearner.values()].filter(Boolean).length;
  }

  return {
    enrollmentCount,
    attemptCount: attempts.length,
    learnersStarted,
    passRate:
      startedLearnerQuizzes === 0
        ? 0
        : Math.round((passedLearnerQuizzes / startedLearnerQuizzes) * 100),
    averageScore:
      attempts.length === 0
        ? 0
        : Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length),
    notStartedCount: quizzes.reduce((total, quiz) => {
      const started = new Set(quiz.attempts.map((attempt) => attempt.userId)).size;
      return total + Math.max(0, enrollmentCount - started);
    }, 0),
  };
}
