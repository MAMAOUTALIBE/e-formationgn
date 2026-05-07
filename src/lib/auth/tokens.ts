// Helpers de gestion des jetons d'usage unique (vérification email, reset).
// Utilise crypto.randomUUID + nanoid pour des tokens URL-safe difficiles à deviner.

import { randomBytes } from "crypto";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const RESET_TTL_MS = 60 * 60 * 1000; // 1 h

export function generateToken(byteLength = 32): string {
  // Base64url, sans padding — ~43 caractères pour 32 octets, sans risque
  // d'encodage URL.
  return randomBytes(byteLength).toString("base64url");
}

export function emailVerificationExpiry(): Date {
  return new Date(Date.now() + VERIFY_TTL_MS);
}

export function passwordResetExpiry(): Date {
  return new Date(Date.now() + RESET_TTL_MS);
}
