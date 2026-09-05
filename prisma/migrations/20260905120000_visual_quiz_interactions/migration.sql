-- Questions visuelles : choix d'image, classement et zone cliquable.
ALTER TYPE "QuestionKind" ADD VALUE IF NOT EXISTS 'IMAGE_CHOICE';
ALTER TYPE "QuestionKind" ADD VALUE IF NOT EXISTS 'DRAG_DROP';
ALTER TYPE "QuestionKind" ADD VALUE IF NOT EXISTS 'HOTSPOT';

ALTER TABLE "QuizQuestion"
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "imageAlt" TEXT,
  ADD COLUMN "interactionConfig" JSONB,
  ADD COLUMN "answerConfig" JSONB;

ALTER TABLE "QuizOption"
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "imageAlt" TEXT,
  ADD COLUMN "targetId" TEXT;
