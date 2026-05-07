// Wrapper Stripe — instancie un client paresseusement.
//
// Pattern marketplace : *separate charges and transfers*. La plateforme
// encaisse via Stripe Checkout, puis pousse un Transfer par formateur sur
// son compte connecté Express. Cela simplifie les paniers multi-formateurs
// et les remboursements.

import Stripe from "stripe";

let cachedClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (cachedClient) return cachedClient;

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "Stripe non configuré. Renseignez STRIPE_SECRET_KEY dans .env, puis redémarrez le serveur.",
    );
  }
  cachedClient = new Stripe(secret, {
    // On laisse Stripe utiliser sa version d'API par défaut compatible avec
    // la version du SDK installée (typage automatique).
    typescript: true,
  });
  return cachedClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
