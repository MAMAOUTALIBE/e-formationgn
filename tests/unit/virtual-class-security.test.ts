import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("les secrets LiveKit restent exclusivement dans l’adaptateur serveur", () => {
  const roomClient = read("src/components/features/virtual-classes/virtual-class-room.tsx");
  const prejoinClient = read("src/components/features/virtual-classes/virtual-class-prejoin.tsx");
  for (const source of [roomClient, prejoinClient]) {
    assert.doesNotMatch(source, /LIVEKIT_API_(KEY|SECRET)|LIVEKIT_WEBHOOK_SECRET/);
  }
  assert.match(read("src/lib/livekit/server.ts"), /^import "server-only";/);
});

test("la génération de jeton est limitée et recalculée depuis l’accès serveur", () => {
  const route = read("src/app/api/classes-virtuelles/[id]/token/route.ts");
  assert.match(route, /requireVirtualClassAccess\(id\)/);
  assert.match(route, /checkRateLimit/);
  assert.match(route, /max: 12/);
  assert.doesNotMatch(route, /request\.json\(\)[\s\S]*role/);
});

test("le webhook LiveKit vérifie la signature et déduplique les événements", () => {
  const route = read("src/app/api/webhooks/livekit/route.ts");
  assert.match(route, /getLiveKitWebhookReceiver\(\)\.receive/);
  assert.match(route, /livekit:\$\{event\.id\}/);
  assert.match(route, /error\.code === "P2002"/);
});

test("les titres longs peuvent revenir à la ligne dans les vues de détail", () => {
  const admin = read("src/app/admin/classes-virtuelles/[id]/page.tsx");
  const student = read("src/app/classes-virtuelles/[id]/page.tsx");
  assert.match(admin, /break-words/);
  assert.match(student, /break-words/);
});

test("la création instantanée prépare LiveKit puis ouvre la salle côté serveur", () => {
  const form = read("src/components/features/virtual-classes/virtual-class-form.tsx");
  const actions = read("src/server/actions/virtual-classes.ts");
  const adminActions = read("src/components/features/virtual-classes/virtual-class-admin-actions.tsx");

  assert.match(form, /value="OPEN_NOW"/);
  assert.match(form, /Créer et ouvrir maintenant/);
  assert.match(actions, /formData\.get\("intent"\) === "OPEN_NOW"/);
  assert.match(actions, /openNow && !isLiveKitConfigured\(\)/);
  assert.match(actions, /await ensureLiveKitRoom\(/);
  assert.match(actions, /status: openNow \? "OPEN"/);
  assert.match(actions, /openedAt: openNow \? requestedAt/);
  assert.match(adminActions, /Rejoindre la salle/);
});

test("l’ouverture très anticipée reste réservée à l’action modérateur autorisée", () => {
  const actions = read("src/server/actions/virtual-classes.ts");
  assert.match(actions, /requireVirtualClassModerator\(virtualClassId\)/);
  assert.match(actions, /allowBeforeOpeningWindow: true/);
  assert.match(actions, /status: "OPEN", openedAt: new Date\(\)/);
});
