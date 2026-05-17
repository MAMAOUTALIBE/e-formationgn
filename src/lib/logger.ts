import "server-only";

// Logger applicatif minimal : console + Sentry.
// Sentry s'auto-active si SENTRY_DSN est défini (cf. instrumentation.ts).
// Si Sentry n'est pas chargé (dev sans DSN), on log uniquement en console.

import * as Sentry from "@sentry/nextjs";

type Context = Record<string, unknown>;

export function logError(scope: string, error: unknown, context?: Context): void {
  console.error(`[${scope}]`, error, context ?? "");
  try {
    Sentry.captureException(error, {
      tags: { scope },
      extra: context,
    });
  } catch {
    /* Sentry non configuré : on ignore silencieusement */
  }
}

export function logWarning(scope: string, message: string, context?: Context): void {
  console.warn(`[${scope}] ${message}`, context ?? "");
  try {
    Sentry.captureMessage(`[${scope}] ${message}`, {
      level: "warning",
      tags: { scope },
      extra: context,
    });
  } catch {
    /* idem */
  }
}

export function logInfo(scope: string, message: string, context?: Context): void {
  console.info(`[${scope}] ${message}`, context ?? "");
}
