-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "registrationId" TEXT;

-- AlterTable
ALTER TABLE "LearningSession" ADD COLUMN     "registrationId" TEXT;

-- CreateIndex
CREATE INDEX "Enrollment_registrationId_idx" ON "Enrollment"("registrationId");

-- CreateIndex
CREATE INDEX "LearningSession_registrationId_startedAt_idx" ON "LearningSession"("registrationId", "startedAt");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningSession" ADD CONSTRAINT "LearningSession_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Reprise des données existantes
-- ---------------------------------------------------------------------------
--
-- Les accès déjà en base ont été ouverts par `syncRegistrationAccess`, qui ne
-- conservait aucune trace de l'inscription à l'origine. On la reconstitue par
-- déduction, et UNIQUEMENT lorsqu'elle est certaine : l'élève doit avoir
-- exactement UNE inscription dont le programme contient ce cours. Dès qu'il y
-- a ambiguïté — deux sessions du même programme, deux programmes partageant le
-- cours — on laisse NULL plutôt que de rattacher au hasard. Une feuille
-- d'émargement fausse est pire qu'une feuille incomplète.

UPDATE "Enrollment" e
SET    "registrationId" = candidat.id
FROM  (
  SELECT r.id,
         r."studentId",
         pc."courseId",
         COUNT(*) OVER (PARTITION BY r."studentId", pc."courseId") AS concurrentes
  FROM   "Registration" r
  JOIN   "TrainingSession" ts ON ts.id = r."sessionId"
  JOIN   "ProgramCourse"  pc ON pc."programId" = ts."programId"
  WHERE  r.status <> 'CANCELLED'
) AS candidat
WHERE  e."registrationId" IS NULL
  AND  e."userId"   = candidat."studentId"
  AND  e."courseId" = candidat."courseId"
  AND  candidat.concurrentes = 1;

-- Le temps déjà mesuré hérite du rattachement de son accès. C'est la meilleure
-- attribution disponible pour l'historique ; à partir de maintenant, la colonne
-- est renseignée à la création de chaque session de suivi.
UPDATE "LearningSession" ls
SET    "registrationId" = e."registrationId"
FROM   "Enrollment" e
WHERE  ls."enrollmentId" = e.id
  AND  ls."registrationId" IS NULL
  AND  e."registrationId" IS NOT NULL;
