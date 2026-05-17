// Proxy Next.js 16 (anciennement « middleware ») — protection des routes via
// le callback `authorized` défini dans `auth.config.ts`.
//
// On utilise la version edge-safe (NextAuth(authConfig)) — pas de Prisma ici,
// le runtime est l'edge.

import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

export const { auth: proxy } = NextAuth(authConfig);

// Matcher Next.js : on évite les assets statiques, les routes API d'auth,
// le manifest PWA et le service worker (servis statiquement depuis /public).
export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|mov|m4v)$).*)",
  ],
};

export default proxy;
