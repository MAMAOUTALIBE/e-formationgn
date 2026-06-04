// Contournement TEMPORAIRE de la vérification d'email.
//
// Tant que Resend (envoi d'emails) n'est pas configuré, les emails de
// confirmation ne partent pas — bloquer la connexion sur `emailVerified`
// empêcherait toute inscription utilisable. Quand `AUTH_AUTO_VERIFY_EMAIL`
// vaut "true", l'inscription crée des comptes déjà vérifiés (ACTIVE) et la
// connexion n'exige plus la vérification.
//
// ➜ Repasser ce flag à "false" (ou le retirer) une fois RESEND_API_KEY
//   configuré, pour réactiver la confirmation par email.
export function isAutoVerifyEmailEnabled(): boolean {
  return process.env.AUTH_AUTO_VERIFY_EMAIL === "true";
}
