import type { NextConfig } from "next";

// En-têtes de sécurité appliqués à toutes les réponses HTML.
// Mode CSP contrôlé par l'env `CSP_MODE` :
//   - "enforce" → `Content-Security-Policy` (XSS bloqué activement)
//   - "report-only" (défaut) → `Content-Security-Policy-Report-Only` (signale
//     les violations dans la console sans bloquer, pour validation progressive)
//
// Procédure de durcissement recommandée :
//   1. Laisser `report-only` 7 jours en prod, surveiller la console.
//   2. Quand zéro violation pendant 48 h → CSP_MODE=enforce.
// Par défaut on APPLIQUE la politique. Elle est restée en `report-only`
// plusieurs mois : le site n'avait donc aucune protection effective, seulement
// des rapports que personne ne lisait. `CSP_MODE=report-only` reste possible
// pour revalider après un changement de politique.
const cspMode = (process.env.CSP_MODE ?? "enforce").toLowerCase();

// `unsafe-eval` n'est nécessaire QU'EN DÉVELOPPEMENT : React s'en sert pour
// reconstruire les piles d'appels serveur dans le navigateur. Ni React ni
// Next.js n'y recourent en production (doc Next.js, guide CSP).
const isDev = process.env.NODE_ENV !== "production";
const cspPolicy = [
  "default-src 'self'",
  // 'unsafe-inline' nécessaire pour Next.js (hydration scripts) — à durcir avec
  // un nonce dans une étape ultérieure (cf. Next.js 16 + nonce headers).
  // `unsafe-inline` demeure : le retirer suppose de passer par un nonce généré
  // par requête, ce qui force le rendu dynamique de TOUTES les pages et
  // supprimerait la génération statique du catalogue. C'est un chantier à part
  // entière — voir SECURITY.md. La politique ci-dessous bloque déjà le
  // chargement de scripts hébergés ailleurs, l'exfiltration par formulaire
  // (`form-action`), la réécriture de base (`base-uri`) et les objets.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://*.stripe.com https://*.mux.com https://*.sentry.io`,
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
const cspHeaderKey =
  cspMode === "enforce"
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";

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
  // CSP — header key et politique pilotés par CSP_MODE (cf. plus haut).
  { key: cspHeaderKey, value: cspPolicy },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Typage et lint : vérifiés AVANT le build, pas pendant.
  //
  // L'image de production est construite en `linux/amd64` sur un Mac ARM, donc
  // sous émulation QEMU. Dans ce contexte la passe « Running TypeScript » de
  // `next build` dépassait l'heure, alors que le même `tsc --noEmit` prend
  // quelques secondes en natif. On la sort donc du build Docker.
  //
  // Ce n'est PAS un relâchement du contrôle : scripts/deploy.sh exécute
  // `npm run typecheck` et `npm run lint` nativement et refuse de construire
  // l'image si l'un des deux échoue. Le contrôle est le même, joué à l'endroit
  // rapide. Ne jamais construire l'image en contournant ce script.
  //
  // Pas de clé `eslint` ici : Next.js 16 l'a retirée de NextConfig en même
  // temps que `next lint`, et `next build` n'exécute plus ESLint du tout.
  typescript: { ignoreBuildErrors: true },

  // Nombre de processus de génération statique.
  //
  // Par défaut Next en lance un par cœur — 7 sur cette machine. Chaque worker
  // porte son propre tas Node, et l'image de production se construit dans une
  // VM Docker limitée à 3,8 Go sur un Mac qui n'a que 8 Go : le build s'est
  // fait tuer (SIGKILL, « cannot allocate memory »). Un seul worker évite que
  // deux tas Node plafonnés à 1,5 Go se cumulent pendant la collecte des pages.
  //
  // À relever si le build migre un jour sur une machine plus dotée : c'est un
  // compromis mémoire/vitesse, pas une correction de bug.
  experimental: { cpus: 1 },

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

  // Aliases conviviaux : /admin/dashboard et /formateur/dashboard sont des
  // raccourcis fréquents (habitude Wordpress/Discord) — on redirige vers
  // les vraies pages racines plutôt que de servir un 404.
  async redirects() {
    return [
      // www → apex. Les cookies de session portent le préfixe `__Host-`, donc
      // ils sont liés à un hôte unique : un visiteur arrivé par www.gandal.org
      // ne pouvait pas rester connecté. La redirection supprime aussi le
      // contenu dupliqué vu par les moteurs.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.gandal.org" }],
        destination: "https://gandal.org/:path*",
        permanent: true,
      },
      { source: "/admin/dashboard", destination: "/admin", permanent: false },
      {
        source: "/formateur/dashboard",
        destination: "/formateur",
        permanent: false,
      },
      // Tolérance aux fautes d'orthographe fréquentes
      { source: "/conexion", destination: "/connexion", permanent: false },
      { source: "/connection", destination: "/connexion", permanent: false },
      { source: "/login", destination: "/connexion", permanent: false },
      { source: "/signin", destination: "/connexion", permanent: false },
    ];
  },
};

export default nextConfig;
