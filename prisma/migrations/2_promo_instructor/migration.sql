-- Permet aux formateurs de créer leurs propres codes promo, applicables
-- uniquement à leurs cours, avec remise imputée sur leur part de revenu.
ALTER TABLE "PromoCode"
  ADD COLUMN "instructorId" TEXT;

ALTER TABLE "PromoCode"
  ADD CONSTRAINT "PromoCode_instructorId_fkey"
  FOREIGN KEY ("instructorId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PromoCode_instructorId_idx" ON "PromoCode"("instructorId");
