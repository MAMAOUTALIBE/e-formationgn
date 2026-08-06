-- Comptes créés par le centre de formation avec un mot de passe provisoire.
-- Tant que le drapeau est vrai, la navigation est redirigée vers l'écran de
-- changement de mot de passe (le mot de passe initial transite par email en
-- clair : le laisser en place reviendrait à publier l'accès).
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
