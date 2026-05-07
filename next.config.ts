import type { NextConfig } from "next";

// En-têtes de sécurité appliqués à toutes les réponses HTML.
// CSP volontairement omis : Next.js injecte des scripts inline pour l'hydratation
// et un CSP strict sans nonce pré-calculé bloque le rendu. À ajouter plus tard
// (mode report-only) si besoin de durcir.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()",
  },
  // HSTS — n'a d'effet qu'en HTTPS. Inoffensif en dev (HTTP) mais essentiel en prod.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Les vignettes peuvent venir de n'importe quelle URL fournie par les
  // formateurs (Mux, Cloudinary, R2, Supabase, etc.). On désactive
  // l'optimisation Next/Image plutôt que de maintenir une whitelist
  // fragile. Les images locales SVG du dossier /public restent servies
  // normalement.
  images: {
    unoptimized: true,
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
