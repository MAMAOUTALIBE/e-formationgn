import "server-only";

import { randomInt } from "node:crypto";

/**
 * Alphabet sans caractères ambigus (0/O, 1/l/I) : ces mots de passe sont
 * recopiés à la main ou lus au téléphone, une confusion coûte un appel au
 * secrétariat.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/**
 * Mot de passe attribué par le centre à la création d'un compte.
 *
 * Extrait ici pour être partagé entre la création à l'unité et l'import en
 * masse : deux générateurs distincts finiraient par diverger, et c'est un
 * secret d'accès — le tirage passe par un CSPRNG, jamais par Math.random.
 */
export function generateTemporaryPassword(): string {
  let out = "";
  for (let i = 0; i < 14; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  // Chiffre et caractère spécial garantis : la politique de mot de passe les
  // exige, et un mot de passe refusé au changement serait absurde.
  return `${out}7!`;
}
