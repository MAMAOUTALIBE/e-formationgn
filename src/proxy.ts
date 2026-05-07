// Proxy Next.js 16 (anciennement « middleware ») — protection des routes via
// le callback `authorized` défini dans `auth.config.ts`.
//
// On utilise la version edge-safe (NextAuth(authConfig)) — pas de Prisma ici,
// le runtime est l'edge.

import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

export const { auth: proxy } = NextAuth(authConfig);

// Matcher Next.js : on évite les assets statiques et les routes API d'auth
// (gérées par le route handler dédié).
export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

export default proxy;
