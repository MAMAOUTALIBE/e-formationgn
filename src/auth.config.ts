// Configuration NextAuth.js partagée — version "edge-safe".
//
// Ce fichier ne doit PAS importer de modules Node-only (Prisma, bcrypt, fs).
// Il est consommé par `middleware.ts` qui tourne sur l'edge runtime.
// Le fichier `auth.ts` étend cette config avec l'adapter Prisma + Credentials.

import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

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
];

// Routes d'authentification (un user déjà connecté est redirigé vers la home)
const AUTH_ROUTES = [
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/reinitialiser-mot-de-passe",
];

const API_AUTH_PREFIX = "/api/auth";

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  // Sous-pages publiques (cours/[slug], categories/[slug], blog/[slug], ...)
  return (
    pathname.startsWith("/cours/") ||
    pathname.startsWith("/categories/") ||
    pathname.startsWith("/blog/") ||
    pathname.startsWith("/verifier-email")
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
        };
        session.user.role = t.role ?? session.user.role ?? "STUDENT";
        session.user.emailVerified = t.emailVerified ?? null;
        session.user.preferredCurrency = t.preferredCurrency ?? "EUR";
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

      // Sitemap, robots et certificats publics — toujours accessibles.
      if (
        pathname === "/sitemap.xml" ||
        pathname === "/robots.txt" ||
        pathname.startsWith("/certificat/") ||
        pathname.startsWith("/api/certificats/")
      ) {
        return true;
      }

      if (AUTH_ROUTES.includes(pathname)) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      // Routes formateur : login + rôle INSTRUCTOR (ou ADMIN)
      if (pathname.startsWith("/formateur")) {
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
        const adminRoles = ["ADMIN", "MODERATOR", "SUPPORT", "FINANCE"];
        if (!role || !adminRoles.includes(role)) {
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
