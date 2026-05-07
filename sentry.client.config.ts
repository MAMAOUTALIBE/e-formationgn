// Sentry — config navigateur. Activé uniquement si NEXT_PUBLIC_SENTRY_DSN défini.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 0.5,
    environment: process.env.NODE_ENV,
  });
}
