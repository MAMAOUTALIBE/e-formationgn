-- Lease de conversion : le token empêche un worker expiré de publier après
-- qu'un autre worker a repris le même diaporama.
ALTER TABLE "Presentation"
  ADD COLUMN "processingToken" TEXT,
  ADD COLUMN "processingStartedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Presentation_processingToken_key"
  ON "Presentation"("processingToken");
