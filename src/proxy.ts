// Proxy Next.js 16 (anciennement « middleware ») — protection des routes via
// le callback `authorized` défini dans `auth.config.ts`.
//
// On utilise la version edge-safe (NextAuth(authConfig)) — pas de Prisma ici,
// le runtime est l'edge.

import NextAuth from "next-auth";
import { NextResponse, type NextFetchEvent, type NextMiddleware, type NextRequest } from "next/server";

import { authConfig } from "@/auth.config";

const REMOVED_PAGES = [
  "/panier", "/commande", "/admin/finances", "/admin/commissions",
  "/admin/codes-promo", "/admin/analytics/revenus", "/admin/analytics/funnel",
  "/admin/analytics/clients", "/admin/marketing/promotions",
  "/admin/marketing/codes-promo", "/admin/marketing/affiliation",
  "/admin/parametres/commerce", "/admin/parametres/paiements",
  "/formateur/paiements", "/formateur/codes-promo", "/formateur/affiliation",
  "/admin/support/litiges",
] as const;

const REMOVED_APIS = [
  "/api/webhooks/stripe", "/api/webhooks/cinetpay",
  "/api/cron/process-webhooks", "/api/cron/reconcile-orders",
  "/api/formateur/ventes", "/api/admin/transactions-csv",
] as const;

function matchesPrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const authMiddleware = NextAuth(authConfig).auth as NextMiddleware;

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  if (matchesPrefix(pathname, REMOVED_APIS)) {
    return NextResponse.json(
      { error: "feature_removed", message: "Les fonctions financières sont désactivées." },
      { status: 410 },
    );
  }
  if (
    matchesPrefix(pathname, REMOVED_PAGES) ||
    (pathname.startsWith("/formateur/cours/") &&
      (pathname.endsWith("/tarification") || pathname.endsWith("/insights")))
  ) {
    return new NextResponse("Page introuvable", { status: 404 });
  }
  return authMiddleware(request, event);
}

// Matcher Next.js : on évite les assets statiques, les routes API d'auth,
// le manifest PWA et le service worker (servis statiquement depuis /public).
export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|mov|m4v)$).*)",
  ],
};
