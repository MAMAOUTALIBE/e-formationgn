-- Verrou d'identité des comptes gérés par le centre.
ALTER TABLE "User" ADD COLUMN "identityLockedAt" TIMESTAMP(3);

-- Reprise de l'existant. La plateforme tourne en mode centre de formation
-- (`getPlatformMode()`), l'inscription publique est fermée : tout compte
-- apprenant présent a donc reçu son identité de l'administration, de même que
-- tout compte rattaché à une société cliente quel que soit son rôle.
UPDATE "User"
SET "identityLockedAt" = "createdAt"
WHERE "identityLockedAt" IS NULL
  AND ("role" = 'STUDENT' OR "companyId" IS NOT NULL);
