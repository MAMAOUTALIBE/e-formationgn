-- Existing attempts receive a stable sequence per learner and quiz. The snapshot
-- fallback is deliberately explicit: legacy attempts predate immutable snapshots.
ALTER TABLE "QuizAttempt" ADD COLUMN "attemptNumber" INTEGER;
ALTER TABLE "QuizAttempt" ADD COLUMN "snapshot" JSONB;

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "quizId", "userId" ORDER BY "startedAt", "id"
  ) AS number
  FROM "QuizAttempt"
)
UPDATE "QuizAttempt" AS attempt
SET "attemptNumber" = numbered.number
FROM numbered
WHERE attempt."id" = numbered."id";

UPDATE "QuizAttempt" AS attempt
SET "snapshot" = jsonb_build_object(
  'schemaVersion', 1,
  'legacy', true,
  'title', quiz."title",
  'passingScore', quiz."passingScore",
  'questions', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', question."id",
        'prompt', question."prompt",
        'explanation', question."explanation",
        'kind', question."kind",
        'points', question."points",
        'options', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', option."id",
              'label', option."label",
              'isCorrect', option."isCorrect"
            ) ORDER BY option."displayOrder", option."id"
          )
          FROM "QuizOption" AS option
          WHERE option."questionId" = question."id"
        ), '[]'::jsonb)
      ) ORDER BY question."displayOrder", question."id"
    )
    FROM "QuizQuestion" AS question
    WHERE question."quizId" = quiz."id"
  ), '[]'::jsonb)
)
FROM "Quiz" AS quiz
WHERE attempt."quizId" = quiz."id";

ALTER TABLE "QuizAttempt" ALTER COLUMN "attemptNumber" SET NOT NULL;
ALTER TABLE "QuizAttempt" ALTER COLUMN "snapshot" SET NOT NULL;

CREATE UNIQUE INDEX "QuizAttempt_quizId_userId_attemptNumber_key"
ON "QuizAttempt"("quizId", "userId", "attemptNumber");
