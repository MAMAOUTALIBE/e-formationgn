// Configuration NextAuth.js partagée — version "edge-safe".
//
// Ce fichier ne doit PAS importer de modules Node-only (Prisma, bcrypt, fs).
// Il est consommé par `middleware.ts` qui tourne sur l'edge runtime.
// Le fichier `auth.ts` étend cette config avec l'adapter Prisma + Credentials.

import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

import { ADMIN_ROLES } from "@/lib/constants";
import type { Currency, UserRole } from "@/generated/prisma/enums";

// On étend les types NextAuth pour exposer le rôle dans la session/token.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: UserRole;
      emailVerified: Date | null;
      preferredCurrency: Currency;
      /** Compte créé par le centre avec un mot de passe provisoire. */
      mustChangePassword?: boolean;
    };
  }
  interface User {
    role?: UserRole;
    emailVerified?: Date | null;
    preferredCurrency?: Currency;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    emailVerified: Date | null;
    preferredCurrency: Currency;
    mustChangePassword?: boolean;
  }
}

// Routes publiques (jamais de redirection vers /connexion)
const PUBLIC_ROUTES = [
  "/",
  "/cours",
  "/categories",
  "/devenir-formateur",
  "/a-propos",
  "/contact",
  "/blog",
  "/cgv",
  "/mentions-legales",
  "/confidentialite",
  "/cookies",
  "/credits",
  "/aide",
];

// Routes d'authentification (un user déjà connecté est redirigé vers la home)
/** Écran de changement du mot de passe provisoire posé par le centre. */
const PASSWORD_CHANGE_ROUTE = "/changer-mot-de-passe";

const AUTH_ROUTES = [
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/reinitialiser-mot-de-passe",
];

const API_AUTH_PREFIX = "/api/auth";

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  // Sous-pages publiques (cours/[slug], categories/[slug], blog/[slug],
  // /formateurs/[code] = vitrine publique formateur, /newsletter/* =
  // pages unsubscribe accessibles sans session).
  return (
    pathname.startsWith("/cours/") ||
    pathname.startsWith("/categories/") ||
    pathname.startsWith("/blog/") ||
    pathname.startsWith("/verifier-email") ||
    pathname.startsWith("/formateurs/") ||
    pathname.startsWith("/newsletter/")
  );
}

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/connexion",
    error: "/connexion",
  },
  providers: [
    // Google OAuth — instancié uniquement si les clés sont fournies.
    // (Sinon NextAuth lève au runtime ; on évite ça en dev.)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    // Edge-safe : copie les champs métier du JWT vers la session.
    // Indispensable pour que `proxy.ts` (middleware) voie `auth.user.role` —
    // sans ça, toutes les checks de rôle en edge runtime tombent en STUDENT.
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token as { id?: string }).id ?? token.sub ?? session.user.id;
        const t = token as {
          role?: UserRole;
          emailVerified?: Date | null;
          preferredCurrency?: Currency;
          mustChangePassword?: boolean;
        };
        session.user.role = t.role ?? session.user.role ?? "STUDENT";
        session.user.emailVerified = t.emailVerified ?? null;
        session.user.preferredCurrency = t.preferredCurrency ?? "EUR";
        // Recopié ici aussi : sans ce callback, l'edge voit une session
        // incomplète et la garde de changement de mot de passe ne s'applique
        // jamais (même piège que pour `role`).
        session.user.mustChangePassword = t.mustChangePassword ?? false;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const { pathname } = nextUrl;
      const isLoggedIn = Boolean(auth?.user);
      const role = auth?.user?.role;

      if (pathname.startsWith(API_AUTH_PREFIX)) return true;

      // Webhooks Stripe / Mux / etc. ne doivent jamais être interceptés.
      if (pathname.startsWith("/api/webhooks/")) return true;

      // API publique (autocomplete recherche, etc.) — pas d'auth requise.
      if (pathname.startsWith("/api/recherche")) return true;

      // Healthcheck pour les sondes d'hébergeur — toujours public.
      if (pathname === "/api/health") return true;

      // Tracking page-view (analytics) — toujours accessible (auth optionnelle).
      if (pathname === "/api/track") return true;

      // OG image dynamique — appelée par les bots sociaux (Twitter, Facebook,
      // LinkedIn, …). Toujours publique.
      if (pathname === "/api/og") return true;

      // Vercel Cron — auth via Bearer token côté route.
      if (pathname.startsWith("/api/cron/")) return true;

      // Sitemap, robots, manifest PWA, service worker, certificats publics —
      // toujours accessibles (sinon la PWA et l'indexation cassent).
      if (
        pathname === "/sitemap.xml" ||
        pathname === "/robots.txt" ||
        pathname === "/manifest.webmanifest" ||
        pathname === "/sw.js" ||
        pathname === "/favicon.ico" ||
        pathname.startsWith("/certificat/") ||
        pathname.startsWith("/api/certificats/")
      ) {
        return true;
      }

      // API admin : la route handler fait sa propre vérification d'auth + rôle.
      // On laisse passer pour qu'elle puisse répondre 401/403/429 plutôt que 302.
      if (pathname.startsWith("/api/admin/")) return true;

      if (AUTH_ROUTES.includes(pathname)) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      // Mot de passe provisoire posé par le centre : tant qu'il n'est pas
      // remplacé, toute navigation est ramenée à l'écran de changement.
      // Placé APRÈS les routes d'API et d'authentification pour ne pas casser
      // la déconnexion ni les appels internes — sans quoi l'utilisateur serait
      // enfermé dans une boucle de redirection sans pouvoir se déconnecter.
      if (isLoggedIn && auth?.user?.mustChangePassword && pathname !== PASSWORD_CHANGE_ROUTE) {
        return Response.redirect(new URL(PASSWORD_CHANGE_ROUTE, nextUrl));
      }

      // Routes formateur : login + rôle INSTRUCTOR (ou ADMIN)
      // Note : on exclut explicitement /formateurs/* (vitrine publique).
      if (pathname === "/formateur" || pathname.startsWith("/formateur/")) {
        if (!isLoggedIn) {
          const callbackUrl = encodeURIComponent(pathname + nextUrl.search);
          return Response.redirect(
            new URL(`/connexion?callbackUrl=${callbackUrl}`, nextUrl),
          );
        }
        if (role !== "INSTRUCTOR" && role !== "ADMIN") {
          return Response.redirect(new URL("/devenir-formateur", nextUrl));
        }
        return true;
      }

      // Routes admin : login + rôle ADMIN ou sous-rôles administratifs
      if (pathname.startsWith("/admin")) {
        if (!isLoggedIn) {
          const callbackUrl = encodeURIComponent(pathname + nextUrl.search);
          return Response.redirect(
            new URL(`/connexion?callbackUrl=${callbackUrl}`, nextUrl),
          );
        }
        if (!role || !(ADMIN_ROLES as readonly string[]).includes(role)) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      if (isPublicRoute(pathname)) return true;

      // Toute autre route = privée
      if (!isLoggedIn) {
        const callbackUrl = encodeURIComponent(pathname + nextUrl.search);
        return Response.redirect(
          new URL(`/connexion?callbackUrl=${callbackUrl}`, nextUrl),
        );
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
