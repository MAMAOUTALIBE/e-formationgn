-- L'audit préalable a vérifié l'absence de doublon (userId, courseId).
-- Cette contrainte rend l'émission d'attestation idempotente jusque dans la DB.
CREATE UNIQUE INDEX "Certificate_userId_courseId_key"
ON "Certificate"("userId", "courseId");
