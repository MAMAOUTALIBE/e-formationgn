-- =============================================================================
-- 7_payments_multicurrency_cinetpay — multi-devises pour CinetPay
-- - Étend l'enum Currency avec GNF (franc guinéen) et XOF (franc CFA O.)
-- - Ajoute Course.priceGNF / priceXOF (+ remises) — Decimal(12,0) car ces
--   devises n'ont pas de subdivision (pas de centimes).
-- =============================================================================

-- 1. Étendre l'enum Currency
ALTER TYPE "Currency" ADD VALUE IF NOT EXISTS 'GNF';
ALTER TYPE "Currency" ADD VALUE IF NOT EXISTS 'XOF';

-- 2. Nouvelles colonnes prix sur Course (par défaut 0 → cours non vendu en GNF/XOF)
ALTER TABLE "Course"
  ADD COLUMN "priceGNF"         DECIMAL(12, 0) NOT NULL DEFAULT 0,
  ADD COLUMN "priceXOF"         DECIMAL(12, 0) NOT NULL DEFAULT 0,
  ADD COLUMN "discountPriceGNF" DECIMAL(12, 0),
  ADD COLUMN "discountPriceXOF" DECIMAL(12, 0);
