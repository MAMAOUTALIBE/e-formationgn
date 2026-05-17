-- Ajoute un token d'unsubscribe unique par inscription. Le token est
-- généré à la création (randomBytes 32 octets base64url) et inclus dans
-- chaque email. La page /newsletter/desinscription?token=… le marque
-- unsubscribed sans révéler l'email — anti-énumération.
ALTER TABLE "NewsletterSubscription" ADD COLUMN "unsubscribeToken" TEXT;

-- Rétro-remplit les tokens existants avec un id cuid-like via gen_random_uuid
-- (nécessite l'extension pgcrypto, déjà active sur Postgres récents).
UPDATE "NewsletterSubscription"
SET "unsubscribeToken" = REPLACE(gen_random_uuid()::text, '-', '')
WHERE "unsubscribeToken" IS NULL;

-- Désormais NOT NULL + unique.
ALTER TABLE "NewsletterSubscription" ALTER COLUMN "unsubscribeToken" SET NOT NULL;
CREATE UNIQUE INDEX "NewsletterSubscription_unsubscribeToken_key"
  ON "NewsletterSubscription"("unsubscribeToken");
