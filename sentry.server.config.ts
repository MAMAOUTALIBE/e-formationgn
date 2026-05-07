// Sentry — config serveur. Activé uniquement si SENTRY_DSN est défini.
// Sample rate prudent par défaut : 10 % des erreurs en prod.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    environment: process.env.NODE_ENV,
    debug: false,
  });
}
