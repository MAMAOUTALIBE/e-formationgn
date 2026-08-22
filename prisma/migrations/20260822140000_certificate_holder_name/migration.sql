-- Nom du titulaire figé sur l'attestation.
ALTER TABLE "Certificate" ADD COLUMN "holderName" TEXT;

-- Reprise : on fige le nom tel qu'il est AUJOURD'HUI pour les certificats déjà
-- délivrés. C'est la meilleure approximation disponible — l'identité au moment
-- de l'émission n'a jamais été enregistrée — et elle gèle au moins la valeur
-- courante avant la première correction d'état civil.
UPDATE "Certificate" c
SET "holderName" = NULLIF(
  TRIM(COALESCE(u."name", CONCAT_WS(' ', u."firstName", u."lastName"))),
  ''
)
FROM "User" u
WHERE u.id = c."userId" AND c."holderName" IS NULL;
