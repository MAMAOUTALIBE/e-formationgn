// Hook Next.js qui charge la bonne config Sentry selon le runtime.
// Voir https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Capture les erreurs de rendu côté serveur. Sentry expose
// `captureRequestError` (renommé) — on le réexporte sous le nom attendu.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
