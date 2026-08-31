// Régression E2E de la section « classes virtuelles ».
//
// Ces cas ne dépendent PAS de la base : ils s'arrêtent tous à la couche
// d'authentification, avant le moindre accès Prisma. Ils restent donc jouables
// sur un environnement sans données, ce qui est précisément l'intérêt — c'est
// la frontière d'accès que l'on veut garder verrouillée.
//
// Un identifiant inventé suffit : aucune de ces réponses ne doit dépendre de
// l'existence de la séance, sans quoi l'API deviendrait un oracle permettant
// d'énumérer les classes.

import { expect, test } from "@playwright/test";

const CLASS_ID = "abcdefghijklmnopqrstuvwx";
const RECORDING_ID = "rec-inexistant";

const PRIVATE_PAGES = [
  `/classes-virtuelles`,
  `/classes-virtuelles/${CLASS_ID}`,
  `/classes-virtuelles/${CLASS_ID}/salle`,
  `/classes-virtuelles/${CLASS_ID}/verification`,
  `/admin/classes-virtuelles`,
  `/admin/classes-virtuelles/nouvelle`,
  `/admin/classes-virtuelles/${CLASS_ID}`,
  `/admin/classes-virtuelles/${CLASS_ID}/modifier`,
  `/formateur/classes-virtuelles`,
  `/formateur/classes-virtuelles/${CLASS_ID}`,
];

test.describe("Classes virtuelles — cloisonnement des pages", () => {
  for (const path of PRIVATE_PAGES) {
    test(`${path} renvoie un visiteur anonyme vers la connexion`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(302);
      expect(response.headers()["location"]).toContain("/connexion");
      // Le retour doit ramener à l'écran demandé, sinon la personne se perd
      // après authentification.
      expect(response.headers()["location"]).toContain("callbackUrl");
    });
  }
});

test.describe("Classes virtuelles — les API répondent en JSON, jamais par une redirection", () => {
  // Sans entrée dédiée dans `authConfig.callbacks.authorized`, le proxy
  // renverrait une redirection HTML vers /connexion : ni `fetch()` ni la balise
  // média du navigateur ne savent l'interpréter, et l'échec serait muet.
  const ENDPOINTS = [
    { method: "post" as const, path: `/api/classes-virtuelles/${CLASS_ID}/token` },
    { method: "get" as const, path: `/api/classes-virtuelles/${CLASS_ID}/messages` },
    { method: "get" as const, path: `/api/classes-virtuelles/${CLASS_ID}/presence` },
    { method: "get" as const, path: `/api/classes-virtuelles/${CLASS_ID}/replay/${RECORDING_ID}` },
    { method: "get" as const, path: `/api/classes-virtuelles/${CLASS_ID}/ressources/${RECORDING_ID}` },
  ];

  for (const endpoint of ENDPOINTS) {
    test(`${endpoint.method.toUpperCase()} ${endpoint.path} → 401 JSON`, async ({ request }) => {
      const response = await request[endpoint.method](endpoint.path, { maxRedirects: 0 });
      expect(response.status()).toBe(401);
      expect(response.headers()["content-type"]).toContain("json");
      expect(await response.json()).toHaveProperty("error");
    });
  }
});

test.describe("Classes virtuelles — tâches planifiées et webhook", () => {
  test("le cron de rappels exige son jeton", async ({ request }) => {
    for (const headers of [undefined, { Authorization: "Bearer mauvais-jeton" }]) {
      const response = await request.get("/api/cron/virtual-class-reminders", { headers });
      expect(response.status()).toBe(401);
    }
  });

  test("le webhook LiveKit refuse un appel non signé", async ({ request }) => {
    const response = await request.post("/api/webhooks/livekit", {
      data: { event: "room_finished", room: { name: "aiduca-quelconque" } },
    });
    // 401 quand les clés sont posées (signature invalide), 503 sinon — dans les
    // deux cas l'évènement n'est jamais traité.
    expect([401, 503]).toContain(response.status());
  });

  test("un JWT signé avec une autre clé est rejeté", async ({ request }) => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ iss: "cle-inconnue", exp: Math.floor(Date.now() / 1000) + 300 }),
    ).toString("base64url");
    const response = await request.post("/api/webhooks/livekit", {
      headers: { Authorization: `${header}.${payload}.signature-forgee` },
      data: { event: "room_finished" },
    });
    expect([401, 503]).toContain(response.status());
  });
});

test.describe("Classes virtuelles — en-têtes exigés par la salle", () => {
  test("caméra et micro autorisés pour l’origine, géolocalisation refusée", async ({ request }) => {
    const response = await request.get("/classes-virtuelles", { maxRedirects: 0 });
    const policy = response.headers()["permissions-policy"] ?? "";
    expect(policy).toContain("camera=(self)");
    expect(policy).toContain("microphone=(self)");
    expect(policy).toContain("geolocation=()");
  });

  test("la CSP autorise le websocket ET l’origine HTTP de LiveKit", async ({ request }) => {
    // `livekit-client` appelle `https://<projet>.livekit.cloud/settings/regions`
    // avant d'ouvrir la session : `wss:` seul ne suffit pas, et la politique
    // étant APPLIQUÉE en production, l'appel échouait silencieusement.
    const response = await request.get("/classes-virtuelles", { maxRedirects: 0 });
    const csp = response.headers()["content-security-policy"] ?? "";
    const connect = csp.split(";").find((directive) => directive.includes("connect-src")) ?? "";
    expect(connect).toContain("wss://*.livekit.cloud");
    expect(connect).toContain("https://*.livekit.cloud");
    // Et plus de `wss:` nu : il autorisait un websocket vers n'importe quel
    // hôte, soit un canal d'exfiltration pour un script injecté.
    expect(connect).not.toMatch(/\swss:\s/);
  });
});
