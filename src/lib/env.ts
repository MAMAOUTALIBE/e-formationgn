// Validation des variables d'environnement au démarrage.
// Toute variable manquante en production fait échouer le boot, ce qui
// évite de découvrir les oublis en runtime utilisateur.

import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";

const noLocalhost = (url: string) =>
  !/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(url);
const httpsOnly = (url: string) => /^https:\/\//i.test(url);

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Base de données
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // NextAuth
  NEXTAUTH_URL: z
    .string()
    .url()
    .refine(
      (url) => !isProduction || (noLocalhost(url) && httpsOnly(url)),
      "NEXTAUTH_URL doit être une URL HTTPS publique en production",
    ),
  NEXTAUTH_SECRET: z.string().min(32),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CONNECT_CLIENT_ID: z.string().optional(),

  // Mux
  MUX_TOKEN_ID: z.string().optional(),
  MUX_TOKEN_SECRET: z.string().optional(),
  MUX_WEBHOOK_SECRET: z.string().optional(),

  // Resend
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),

  // Stockage
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),

  // Plateforme
  PLATFORM_DEFAULT_CURRENCY: z.enum(["EUR", "USD"]).default("EUR"),
  PLATFORM_COMMISSION_INSTRUCTOR_BPS: z.coerce.number().default(1500),
  PLATFORM_COMMISSION_PLATFORM_BPS: z.coerce.number().default(3000),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000")
    .refine(
      (url) => !isProduction || (noLocalhost(url) && httpsOnly(url)),
      "NEXT_PUBLIC_APP_URL doit être une URL HTTPS publique en production",
    ),
  NEXT_PUBLIC_APP_NAME: z.string().default("E-FormationGN"),
});

function parseEnv() {
  const server = serverSchema.safeParse(process.env);
  const client = clientSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  });

  if (!server.success || !client.success) {
    const errors = [
      ...(server.success ? [] : Object.entries(server.error.flatten().fieldErrors)),
      ...(client.success ? [] : Object.entries(client.error.flatten().fieldErrors)),
    ];
    const message = errors
      .map(([key, msgs]) => `  - ${key}: ${(msgs ?? []).join(", ")}`)
      .join("\n");

    if (isProduction) {
      throw new Error(`Variables d'environnement invalides :\n${message}`);
    }
    // En dev/test on log seulement (pour permettre le boot avec un .env partiel)
    console.warn(`[env] Variables manquantes ou invalides :\n${message}`);
  }

  return {
    ...(server.success ? server.data : (process.env as never)),
    ...(client.success ? client.data : ({} as never)),
  };
}

export const env = parseEnv();
