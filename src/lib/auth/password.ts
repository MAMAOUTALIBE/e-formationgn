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
