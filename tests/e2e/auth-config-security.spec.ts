import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const repoRoot = process.cwd();

test.describe("Sécurité — configuration auth", () => {
  test("le callback JWT resynchronise les attributs d'autorisation à chaque passage", async () => {
    const source = await readFile(path.join(repoRoot, "src/auth.ts"), "utf8");

    const refreshStart = source.indexOf("token.id = dbUser.id;");
    const callbackEnd = source.indexOf("return token;", refreshStart);
    const refreshBlock = source.slice(refreshStart, callbackEnd);

    expect(refreshStart).toBeGreaterThan(-1);
    expect(callbackEnd).toBeGreaterThan(refreshStart);
    expect(refreshBlock).toContain("token.role = dbUser.role;");
    expect(refreshBlock).toContain("token.emailVerified = dbUser.emailVerified;");
    expect(refreshBlock).toContain("token.preferredCurrency = dbUser.preferredCurrency;");
    expect(refreshBlock).toContain("token.mustChangePassword = dbUser.mustChangePassword;");
    expect(refreshBlock).not.toMatch(/if\s*\(\s*trigger\s*===\s*["']update["']/);
  });

  test("Google OAuth n'autorise pas la liaison implicite par email", async () => {
    const source = await readFile(
      path.join(repoRoot, "src/auth.config.ts"),
      "utf8",
    );

    expect(source).not.toContain("allowDangerousEmailAccountLinking");
  });

  test("la déconnexion globale révoque les JWT sans manipuler les sessions Prisma", async () => {
    const source = await readFile(
      path.join(repoRoot, "src/server/actions/admin-security.ts"),
      "utf8",
    );
    const start = source.indexOf("export async function disconnectUserEverywhere");
    const end = source.indexOf("export async function banIp", start);
    const action = source.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(action).toContain("const admin = await requireAdmin()");
    expect(action).toContain("parsed.data === admin.userId");
    expect(action).toContain("passwordChangedAt: revokedAt");
    expect(action).toContain('action: "user.sessions.revoke_all"');
    expect(action).not.toContain("prisma.session");
  });

  test("l'écran sessions décrit honnêtement la révocation JWT", async () => {
    const source = await readFile(
      path.join(repoRoot, "src/app/admin/securite/sessions/page.tsx"),
      "utf8",
    );

    expect(source).toContain("await requireAdmin()");
    expect(source).toContain("lastLoginAt");
    expect(source).toContain("Déconnecter partout");
    expect(source).toMatch(/ne\s+peut pas afficher chaque appareil actif/);
    expect(source).not.toContain("prisma.session");
  });

  test("l'impersonation ne fait confiance qu'au registre serveur actif", async () => {
    const [cookieSource, authSource] = await Promise.all([
      readFile(path.join(repoRoot, "src/lib/admin/impersonation.ts"), "utf8"),
      readFile(path.join(repoRoot, "src/auth.ts"), "utf8"),
    ]);

    expect(cookieSource).not.toContain("targetUserId");
    expect(cookieSource).toContain("value.sessionId");
    expect(authSource).toContain("prisma.impersonationSession.findFirst");
    expect(authSource).toContain("adminId: token.id");
    expect(authSource).toContain("endedAt: null");
    expect(authSource).toContain("IMPERSONATION_MAX_AGE_MS");
    expect(authSource).toContain('target?.status === "ACTIVE"');
    expect(authSource).toContain("const target = impersonation?.targetUser");
  });

  test("l'arrêt d'impersonation utilise l'admin et la cible du registre", async () => {
    const source = await readFile(
      path.join(repoRoot, "src/server/actions/admin-impersonation.ts"),
      "utf8",
    );

    expect(source).toContain("currentSession?.impersonation");
    expect(source).toContain('target.status !== "ACTIVE"');
    expect(source).toContain("adminId: realAdminId");
    expect(source).toContain("endedAt: null");
    expect(source).toContain("startedAt: { gte:");
    expect(source).toContain("actorId: record.adminId");
    expect(source).toContain("targetId: record.targetUserId");
    expect(source).not.toContain("cookie.targetUserId");
  });
});
