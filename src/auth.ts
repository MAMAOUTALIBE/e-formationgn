// NextAuth.js v5 — configuration runtime Node.js complète.
//
// Cette config étend `auth.config.ts` (edge-safe) avec :
//   - PrismaAdapter (création/liaison automatiques des comptes OAuth)
//   - Provider Credentials (email + mot de passe via bcrypt)
//   - Stratégie JWT (requise par Credentials, fonctionne aussi avec OAuth)
//   - Synchronisation du rôle/emailVerified dans le token et la session
//
// Le client Prisma (généré dans @/generated/prisma) n'a pas la même type
// signature que celle attendue par @auth/prisma-adapter (qui importe depuis
// @prisma/client). On effectue donc un cast contrôlé : la forme runtime est
// 100% compatible.

import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { authConfig } from "@/auth.config";
import { readImpersonation } from "@/lib/admin/impersonation";
import { isAutoVerifyEmailEnabled } from "@/lib/auth/auto-verify";
import { recordLoginAttempt } from "@/lib/auth/login-attempts";
import { fakeVerifyPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators/auth";

// Le PrismaAdapter type-checke contre `@prisma/client` (legacy). On lui
// passe notre client Prisma 7 via un cast — l'API runtime est identique.
type AdapterPrismaClient = Parameters<typeof PrismaAdapter>[0];

export const {
  handlers,
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma as unknown as AdapterPrismaClient),
  session: { strategy: "jwt" },
  events: {
    async linkAccount({ user }) {
      // Quand un compte OAuth (Google) est lié : Google a déjà vérifié
      // l'email, on marque le compte comme vérifié et actif.
      if (!user.id) return;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: new Date(),
          status: "ACTIVE",
        },
      });
    },
  },
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "Identifiants",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse({
          email: credentials?.email,
          password: credentials?.password,
        });
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user || !user.hashedPassword) {
          // Burn CPU pour égaliser le timing avec un email valide. Empêche
          // l'énumération d'emails par mesure de latence.
          await fakeVerifyPassword(parsed.data.password);
          await recordLoginAttempt({
            email: parsed.data.email,
            userId: null,
            success: false,
          });
          return null;
        }

        const isValid = await verifyPassword(parsed.data.password, user.hashedPassword);
        if (!isValid) {
          await recordLoginAttempt({
            email: parsed.data.email,
            userId: user.id,
            success: false,
          });
          return null;
        }

        if (user.status === "SUSPENDED" || user.status === "DELETED") {
          await recordLoginAttempt({
            email: parsed.data.email,
            userId: user.id,
            success: false,
          });
          return null;
        }

        // Si l'email n'est pas vérifié, on bloque la connexion — SAUF quand le
        // contournement temporaire AUTH_AUTO_VERIFY_EMAIL est actif (Resend pas
        // encore configuré). Le formulaire affiche un message dédié via le throw.
        if (!user.emailVerified && !isAutoVerifyEmailEnabled()) {
          await recordLoginAttempt({
            email: parsed.data.email,
            userId: user.id,
            success: false,
          });
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        await recordLoginAttempt({
          email: parsed.data.email,
          userId: user.id,
          success: true,
        });

        return {
          id: user.id,
          email: user.email,
          name:
            user.name ?? (`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || null),
          image: user.image,
          role: user.role,
          emailVerified: user.emailVerified,
          preferredCurrency: user.preferredCurrency,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      // Au login : on injecte les infos métier dans le JWT
      if (user) {
        token.id = user.id ?? token.sub ?? "";
        token.role = (user as { role?: typeof token.role }).role ?? "STUDENT";
        token.emailVerified = (user as { emailVerified?: Date | null }).emailVerified ?? null;
        token.preferredCurrency =
          (user as { preferredCurrency?: typeof token.preferredCurrency })
            .preferredCurrency ?? "EUR";
      }

      // Sécurité + sync : un seul SELECT par appel JWT couvre :
      //   - révocation du token si le mot de passe a été changé après son
      //     émission (passwordChangedAt > token.iat)
      //   - révocation si le compte est SUSPENDED ou DELETED
      //   - rafraîchissement des champs métier (rôle, emailVerified, devise)
      //     après un trigger "update" client ou si manquants dans le token
      if (token.sub) {
        const dbUser = (await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            id: true,
            role: true,
            emailVerified: true,
            preferredCurrency: true,
            status: true,
            passwordChangedAt: true,
            mustChangePassword: true,
          },
        })) as {
          id: string;
          role: import("@/generated/prisma/enums").UserRole;
          emailVerified: Date | null;
          preferredCurrency: import("@/generated/prisma/enums").Currency;
          status: import("@/generated/prisma/enums").AccountStatus;
          passwordChangedAt: Date | null;
          mustChangePassword: boolean;
        } | null;

        if (!dbUser) return null;
        if (dbUser.status === "DELETED" || dbUser.status === "SUSPENDED") {
          return null;
        }
        if (
          dbUser.passwordChangedAt &&
          typeof token.iat === "number" &&
          dbUser.passwordChangedAt.getTime() > token.iat * 1000
        ) {
          return null;
        }

        // Rafraîchi à CHAQUE passage, hors de la condition `trigger` : la
        // garde de navigation s'appuie dessus, elle doit refléter la base sans
        // attendre une reconnexion.
        token.mustChangePassword = dbUser.mustChangePassword;

        if (trigger === "update" || !token.role) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.emailVerified = dbUser.emailVerified;
          token.preferredCurrency = dbUser.preferredCurrency;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.emailVerified = token.emailVerified;
        session.user.preferredCurrency = token.preferredCurrency ?? "EUR";
        session.user.mustChangePassword = token.mustChangePassword ?? false;
      }

      // Impersonation : si l'admin a un cookie actif, on swap la session vers
      // l'utilisateur ciblé. La session conserve une trace de l'admin réel
      // dans `session.impersonation` pour que l'UI puisse afficher la bannière.
      if (session.user && token.role === "ADMIN") {
        const cookie = await readImpersonation().catch(() => null);
        if (cookie && cookie.targetUserId !== token.id) {
          const target = await prisma.user.findUnique({
            where: { id: cookie.targetUserId },
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              role: true,
              emailVerified: true,
              preferredCurrency: true,
              status: true,
            },
          });
          if (target && target.status !== "DELETED") {
            const realAdminId = session.user.id;
            const realAdminEmail = session.user.email;
            session.user.id = target.id;
            session.user.email = target.email;
            session.user.name = target.name;
            session.user.image = target.image;
            session.user.role = target.role;
            session.user.emailVerified = target.emailVerified;
            session.user.preferredCurrency = target.preferredCurrency;
            (session as { impersonation?: unknown }).impersonation = {
              adminId: realAdminId,
              adminEmail: realAdminEmail,
              sessionRecordId: cookie.sessionId,
            };
          }
        }
      }

      return session as typeof session & { user: DefaultSession["user"] };
    },
  },
});
