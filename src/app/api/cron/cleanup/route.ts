// Job de cron quotidien — appelé par Vercel Cron (cf. vercel.json).
// Sécurisé via header `Authorization: Bearer ${CRON_SECRET}` côté Vercel.
//
// Nettoyages :
//   1) Sessions NextAuth expirées
//   2) Tokens de vérification email expirés
//   3) Tokens de reset password expirés
//   4) Logs LoginAttempt > 90 jours
//   5) PageView > 180 jours (rétention RGPD raisonnable)

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // refuse si pas configuré
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${expected}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 3600 * 1000);

  const [
    sessions,
    emailTokens,
    resetTokens,
    loginAttempts,
    pageViews,
    assistantConversations,
  ] = await Promise.all([
    prisma.session.deleteMany({ where: { expires: { lt: now } } }),
    prisma.emailVerificationToken.deleteMany({
      where: { expires: { lt: now } },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { expires: { lt: now } },
    }),
    prisma.loginAttempt.deleteMany({
      where: { createdAt: { lt: ninetyDaysAgo } },
    }),
    prisma.pageView.deleteMany({
      where: { createdAt: { lt: sixMonthsAgo } },
    }),
    // Conversations Aiduca-IA : 90 jours, comme annoncé aux visiteurs dans le
    // widget. Les messages partent en cascade ; les prospects survivent
    // (conversationId passe à NULL), car une demande de rappel a une valeur
    // commerciale propre et un fondement de conservation distinct.
    prisma.assistantConversation.deleteMany({
      where: { lastMessageAt: { lt: ninetyDaysAgo } },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    cleaned: {
      sessions: sessions.count,
      emailTokens: emailTokens.count,
      resetTokens: resetTokens.count,
      loginAttempts: loginAttempts.count,
      pageViews: pageViews.count,
      assistantConversations: assistantConversations.count,
    },
  });
}
