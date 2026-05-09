-- =============================================================================
-- 6_user_password_changed_at — révocation des sessions après reset password
-- Ajoute User.passwordChangedAt : timestamp utilisé par le callback JWT pour
-- invalider les tokens émis AVANT cette date. Force la déconnexion globale
-- après un reset, ce qui ferme les sessions actives volées éventuelles.
-- =============================================================================

ALTER TABLE "User"
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
