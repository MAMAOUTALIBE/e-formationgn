import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("un fournisseur absent échoue sans journaliser le destinataire ni le contenu", async () => {
  const source = await readFile("src/lib/email/client.ts", "utf8");
  const missingProviderBranch = source.match(/if \(!client\) \{([\s\S]*?)\n  \}/)?.[1];

  assert.ok(missingProviderBranch, "la branche sans fournisseur doit rester explicite");
  assert.match(missingProviderBranch, /ok: false/);
  assert.doesNotMatch(missingProviderBranch, /params\.(to|subject|html|text)/);
});

test("les erreurs email ne transmettent que la corrélation au logger", async () => {
  const source = await readFile("src/lib/email/client.ts", "utf8");
  const logCalls = [...source.matchAll(/logError\("email",([\s\S]*?)\);/g)];

  assert.equal(logCalls.length, 2);
  for (const call of logCalls) {
    assert.match(call[1], /correlationId/);
    assert.doesNotMatch(call[1], /params\.(to|subject|html|text)/);
    assert.doesNotMatch(call[1], /result\.error|, error,/);
  }
});

test("la récupération ne prétend pas envoyer un email après un échec", async () => {
  const source = await readFile("src/server/actions/auth.ts", "utf8");
  const resetAction = source.slice(
    source.indexOf("export async function requestPasswordReset"),
    source.indexOf("export async function resetPassword"),
  );

  assert.match(resetAction, /if \(!delivery\.ok\)/);
  assert.match(resetAction, /passwordResetToken\.delete/);
  assert.match(resetAction, /temporairement indisponible/);
  assert.doesNotMatch(resetAction, /vient d'être envoyé/);
  assert.ok(
    resetAction.indexOf("if (!isTransactionalEmailConfigured())") <
      resetAction.indexOf("prisma.user.findUnique"),
    "l'indisponibilité globale doit être traitée avant toute recherche utilisateur",
  );
  assert.doesNotMatch(
    resetAction.slice(resetAction.indexOf("if (!delivery.ok)")),
    /success: false/,
    "un échec propre à un destinataire ne doit pas révéler l'existence du compte",
  );
});

test("les cron financiers ne sont planifiés qu'en mode marketplace", async () => {
  const compose = await readFile("docker-compose.yml", "utf8");
  const marketplaceGuard = compose.indexOf(
    `if [ \\"$$PLATFORM_MODE\\" = 'marketplace' ]; then`,
  );
  const webhooksCron = compose.indexOf("api/cron/process-webhooks", marketplaceGuard);
  const reconciliationCron = compose.indexOf("api/cron/reconcile-orders", webhooksCron);
  const guardEnd = compose.indexOf("fi;", reconciliationCron);
  const cleanupCron = compose.indexOf("api/cron/cleanup", guardEnd);

  assert.match(compose, /PLATFORM_MODE: \$\{PLATFORM_MODE\}/);
  assert.ok(marketplaceGuard >= 0);
  assert.ok(webhooksCron > marketplaceGuard);
  assert.ok(reconciliationCron > webhooksCron);
  assert.ok(guardEnd > reconciliationCron);
  assert.ok(cleanupCron > guardEnd);
});
