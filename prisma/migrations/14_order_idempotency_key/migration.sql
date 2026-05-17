-- Idempotency client sur Order : UUID v4 par submit panier. Le UNIQUE
-- (userId, idempotencyKey) protège des double-clics qui créeraient sinon
-- 2 commandes distinctes (et potentiellement 2 paiements).

ALTER TABLE "Order"
  ADD COLUMN "idempotencyKey" TEXT;

-- NULL est distinct en Postgres → les Orders sans clé (legacy, internes)
-- ne se collisionnent pas. Pas besoin de WHERE clause.
CREATE UNIQUE INDEX "Order_userId_idempotencyKey_key"
  ON "Order"("userId", "idempotencyKey");
