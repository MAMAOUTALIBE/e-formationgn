"use client";

// Error boundary GLOBAL : dernier filet si l'erreur survient dans le root
// layout lui-même (ThemeProvider, fonts…). À ce niveau le layout n'est PAS
// monté → ce composant doit rendre ses propres <html> et <body>. Style inline
// autonome volontaire : aucun import de composant ni de CSS qui pourrait
// dépendre du contexte cassé.

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#f5f5f5",
          color: "#1a1a1a",
        }}
      >
        <div style={{ maxWidth: 480, padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 32, fontWeight: 700, margin: 0, color: "#1E3A8A" }}>
            Aiduca
          </p>
          <h1 style={{ fontSize: 22, marginTop: 16 }}>
            Une erreur critique est survenue
          </h1>
          <p style={{ fontSize: 14, color: "#555", marginTop: 8 }}>
            La plateforme a rencontré un problème inattendu. Veuillez réessayer.
          </p>
          {error.digest ? (
            <p style={{ fontSize: 12, color: "#888", marginTop: 12 }}>
              Référence&nbsp;: {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              background: "#1E3A8A",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
