-- =============================================================================
-- 4_lesson_ai_summary — résumé pédagogique IA d'une leçon
-- Ajoute deux champs nullables sur Lesson :
--   * aiSummary           : texte généré par Claude (régénérable)
--   * aiSummaryUpdatedAt  : timestamp de la dernière régénération
-- =============================================================================

ALTER TABLE "Lesson"
  ADD COLUMN "aiSummary" TEXT,
  ADD COLUMN "aiSummaryUpdatedAt" TIMESTAMP(3);
