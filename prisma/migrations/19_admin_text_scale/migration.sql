-- Taille du texte de la coquille CRM.
--
-- Colonne nullable sans valeur par défaut : `null` signifie « aucun choix
-- exprimé », que la couche de lecture traduit en DEFAULT_ADMIN_TEXT_SCALE.
-- Encoder ce défaut ici le figerait en base et le rendrait impossible à faire
-- évoluer côté application.
ALTER TABLE "AdminUiTheme" ADD COLUMN IF NOT EXISTS "textScale" TEXT;
