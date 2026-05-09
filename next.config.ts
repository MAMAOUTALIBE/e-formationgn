import type { NextConfig } from "next";

// En-têtes de sécurité appliqués à toutes les réponses HTML.
// CSP en mode `report-only` : les violations sont signalées (console navigateur)
// mais rien n'est bloqué. Permet de durcir progressivement sans casser le rendu.
const cspReportOnly = [
  "default-src 'self'",
  // 'unsafe-inline' nécessaire pour Next.js (hydration scripts) — à durcir avec
  // un nonce dans une étape ultérieure (cf. Next.js 16 + nonce headers).
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.stripe.com https://*.mux.com https://*.sentry.io",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Mux + Stripe + Sentry + R2/S3 : sources externes attendues
  "connect-src 'self' https://*.stripe.com https://*.mux.com https://*.sentry.io https://*.r2.cloudflarestorage.com",
  "frame-src 'self' https://*.stripe.com https://*.mux.com",
  "media-src 'self' https://*.mux.com blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

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
  // CSP en report-only. Bascule en `Content-Security-Policy` (sans -Report-Only)
  // une fois validé en prod (zéro violation pendant 24-48h).
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Build standalone : produit /.next/standalone avec un mini server.js
  // autonome, indispensable pour l'image Docker minimale.
  output: "standalone",

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
