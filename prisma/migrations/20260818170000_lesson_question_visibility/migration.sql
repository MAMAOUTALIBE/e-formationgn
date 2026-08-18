-- Les questions historiques restent publiques et rattachées au cours.
CREATE TYPE "QuestionVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

ALTER TABLE "Question"
  ADD COLUMN "lessonId" TEXT,
  ADD COLUMN "visibility" "QuestionVisibility" NOT NULL DEFAULT 'PUBLIC';

CREATE INDEX "Question_courseId_visibility_createdAt_idx"
  ON "Question"("courseId", "visibility", "createdAt");
CREATE INDEX "Question_lessonId_createdAt_idx"
  ON "Question"("lessonId", "createdAt");

ALTER TABLE "Question"
  ADD CONSTRAINT "Question_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Question_courseId_idx";
