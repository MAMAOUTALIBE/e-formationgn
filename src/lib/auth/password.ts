// Hash et comparaison de mots de passe via bcrypt.
// Coût 12 = équilibre raisonnable (≈250 ms sur un serveur moyen en 2026).

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Hash bidon pré-calculé (cost 12, "decoy") utilisé pour comparer un mot
// de passe quand l'utilisateur n'existe pas ou n'a pas de hashedPassword.
// Évite le timing-leak : un attaquant ne peut plus distinguer email existant
// (~250 ms bcrypt) vs email inexistant (~1 ms). Le hash ne correspond à
// aucun mot de passe réel — il existe juste pour brûler du CPU.
const DUMMY_BCRYPT_HASH =
  "$2b$12$V3fpD4UeMqB5cLsxw7kP6Oa0v7c8QPxs1pYxJlGqDXjdrQXk0bS6e";

/**
 * Compare un mot de passe à un dummy hash. Toujours renvoie false. Utilisé
 * dans les chemins « utilisateur introuvable » pour égaliser le temps de
 * réponse avec les chemins valides.
 */
export async function fakeVerifyPassword(plain: string): Promise<false> {
  await bcrypt.compare(plain, DUMMY_BCRYPT_HASH);
  return false;
}
