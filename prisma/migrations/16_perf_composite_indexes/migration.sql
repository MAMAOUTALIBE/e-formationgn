-- Index composites pour les chemins chauds (analytics, finances, progression).
-- Migration manuelle (pas `migrate dev`) car le schéma omet volontairement la
-- colonne tsvector `Course.searchVector` gérée en SQL brut (cf. 1_course_search) ;
-- `migrate dev` tenterait de la supprimer. On n'ajoute ici que des index.
-- CONCURRENTLY impossible dans une migration transactionnelle Prisma — ces
-- CREATE INDEX prennent un verrou bref, acceptable (tables encore modestes ;
-- à passer en CONCURRENTLY hors-transaction si volumineux en prod).

-- Order : analytics & finances filtrent status='PAID' + paidAt sur une plage.
CREATE INDEX IF NOT EXISTS "Order_status_paidAt_idx" ON "Order"("status", "paidAt");

-- Refund : reporting financier par plage de dates.
CREATE INDEX IF NOT EXISTS "Refund_createdAt_idx" ON "Refund"("createdAt");

-- LessonProgress : recompte des leçons complétées d'un apprenant (chemin chaud
-- du lecteur — appelé à chaque complétion).
CREATE INDEX IF NOT EXISTS "LessonProgress_userId_isCompleted_idx" ON "LessonProgress"("userId", "isCompleted");
