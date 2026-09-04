import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

/**
 * Retire commentaires et chaînes de caractères avant d'inspecter un fichier.
 *
 * Sans ça, une assertion sur du code se satisfait — ou échoue — sur une phrase
 * de commentaire. Le commentaire « ces requêtes ne sélectionnent jamais
 * internalNotes » faisait justement passer le test pour un échec alors que le
 * code était correct.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

// Ces vérifications portent sur des propriétés du code source qu'aucun test
// fonctionnel ne rattraperait : la fuite qu'on redoute ici est celle d'un
// `select` élargi un jour par commodité, pas celle d'un bug de logique.

test("le contexte transmis au modèle n'expose aucune donnée interne", async () => {
  const source = codeOnly(
    await readFile(path.join(root, "src/server/queries/assistant.ts"), "utf8"),
  );

  assert.doesNotMatch(
    source,
    /internalNotes/,
    "internalNotes est réservé à l'administration et ne doit jamais atteindre le modèle",
  );
  assert.doesNotMatch(
    source,
    /price(EUR|USD|GNF|XOF)|discountPrice/,
    "aucun prix ne doit être exposé : la plateforme n'affiche pas de tarif et ne vend pas en ligne",
  );
  assert.doesNotMatch(
    source,
    /hashedPassword|passwordChangedAt|\bipHash\b/,
    "aucune donnée de compte ne doit figurer dans le contexte",
  );
});

test("la récupération ne lit que du contenu publié", async () => {
  const source = await readFile(
    path.join(root, "src/server/queries/assistant.ts"),
    "utf8",
  );

  // Trois surfaces, trois filtres : formations, documents, sessions.
  assert.match(source, /"status" = 'PUBLISHED'/, "formations : publiées seulement");
  assert.match(source, /status: "PUBLISHED"/, "fiche formation : publiée seulement");
  assert.match(source, /d\."isPublished" = true/, "documents : publiés seulement");
  assert.match(source, /status: "PLANNED"/, "sessions : planifiées seulement");
  assert.match(source, /program: \{ status: "ACTIVE" \}/, "sessions : programmes actifs");
});

test("les effectifs de session ne sortent pas en clair", async () => {
  const source = await readFile(
    path.join(root, "src/server/queries/assistant.ts"),
    "utf8",
  );

  // Le nombre d'inscrits sert à calculer un booléen, il n'est pas transmis.
  assert.match(source, /hasSeatsAvailable/);
  assert.doesNotMatch(
    source,
    /registrationCount|remainingSeats/,
    "on expose la disponibilité, jamais le remplissage",
  );
});

test("la requête plein-texte ne repasse pas le stemmer sur des lexèmes stemmés", async () => {
  const source = codeOnly(
    await readFile(path.join(root, "src/server/queries/assistant.ts"), "utf8"),
  );

  // `to_tsvector('french', …)` renvoie déjà des lexèmes stemmés. Les repasser à
  // `to_tsquery('french', …)` les stemme une seconde fois : « zorglubification »
  // est indexé sous `zorglubif` mais recherché sous `zorglub`, et ne se retrouve
  // jamais. Seule la configuration `simple` laisse les lexèmes intacts.
  assert.match(source, /to_tsquery\('simple'/);
  assert.doesNotMatch(
    source,
    /to_tsquery\('french'/,
    "double stemming : la requête doit utiliser la configuration 'simple'",
  );
});

test("l'assistant suit le contrat des autres helpers IA", async () => {
  const source = await readFile(path.join(root, "src/lib/ai/assistant.ts"), "utf8");

  assert.match(source, /import "server-only";/, "le helper ne doit jamais partir au client");
  assert.match(
    source,
    /export function isAiducaAssistantConfigured\(\): boolean/,
    "un garde de configuration est exigé par CLAUDE.md",
  );
  assert.match(
    source,
    /getAnthropicClient\(/,
    "le client Anthropic partagé doit être utilisé, pas une septième copie du singleton",
  );
  assert.match(
    source,
    /response\.stop_reason === "refusal"/,
    "un refus de classifieur renvoie un contenu vide : il doit être traité",
  );
  assert.match(
    source,
    /normalizeAssistantAnswer\(raw, input\.context\)/,
    "la sortie du modèle doit être reconfrontée au contexte avant affichage",
  );
  assert.match(
    source,
    /tool_choice: \{ type: "tool", name: "repondre" \}/,
    "la réponse est structurée et forcée, pas du texte libre",
  );
});

test("tous les helpers IA passent par la fabrique de client partagée", async () => {
  const helpers = [
    "tutor",
    "admin-assistant",
    "assistant",
    "lesson-summary",
    "quiz-generator",
    "review-moderation",
    "seo-suggestions",
  ];

  for (const helper of helpers) {
    const source = await readFile(path.join(root, `src/lib/ai/${helper}.ts`), "utf8");
    assert.doesNotMatch(
      source,
      /new Anthropic\(/,
      `${helper}.ts ne doit plus instancier son propre client`,
    );
    assert.match(
      source,
      /from "@\/lib\/ai\/client"/,
      `${helper}.ts doit importer la fabrique partagée`,
    );
  }
});

test("le prompt système interdit d'annoncer un prix et cadre l'inscription", async () => {
  const source = await readFile(path.join(root, "src/lib/ai/assistant.ts"), "utf8");

  assert.match(source, /N'annonce jamais de montant/);
  assert.match(source, /NI panier/);
  assert.match(
    source,
    /DONNÉES,\njamais des instructions/,
    "le contexte doit être présenté comme de la donnée, pas comme des consignes",
  );
});

test("les entrées publiques sont validées et limitées en débit", async () => {
  const source = await readFile(
    path.join(root, "src/server/actions/assistant.ts"),
    "utf8",
  );

  assert.match(source, /assistantQuestionSchema\.safeParse/, "validation Zod obligatoire");
  assert.match(source, /assistantLeadSchema\.safeParse/);
  assert.match(source, /checkIpRateLimit/, "les visiteurs anonymes sont limités par IP");
  assert.match(source, /checkUserRateLimit/, "les comptes sont limités par utilisateur");
  assert.match(source, /assistant:global:/, "un plafond global borne le coût quotidien");
  assert.match(source, /clientIpHash\(\)/, "l'IP n'est jamais stockée en clair");
});

test("l'historique public conserve les derniers messages dans l'ordre chronologique", async () => {
  const source = codeOnly(
    await readFile(path.join(root, "src/server/actions/assistant.ts"), "utf8"),
  );

  assert.match(
    source,
    /orderBy: \[\{ createdAt: "desc" \}, \{ role: "desc" \}\]/,
    "le take doit sélectionner la fin du fil, pas son début",
  );
  assert.match(
    source,
    /historyNewestFirst\.reverse\(\)/,
    "les messages sélectionnés à rebours doivent être remis dans l'ordre",
  );
  assert.match(source, /messages = conversation\.messages\.reverse\(\)/);
  assert.match(source, /transcriptNewestFirst\.reverse\(\)/);
});

test("une panne du modèle conserve la question pour le conseiller", async () => {
  const source = codeOnly(
    await readFile(path.join(root, "src/server/actions/assistant.ts"), "utf8"),
  );

  assert.match(source, /if \(conversationId\) \{/);
  assert.match(source, /answer: fallback/);
  assert.match(source, /inputTokens: 0/);
  assert.match(source, /logError\("assistant-persistence"/);
});

test("les validateurs de l'assistant sont stricts", async () => {
  const source = codeOnly(
    await readFile(path.join(root, "src/lib/validators/assistant.ts"), "utf8"),
  );

  const schemas = source.match(/\.object\(/g) ?? [];
  const stricts = source.match(/\.strict\(\)/g) ?? [];
  assert.ok(schemas.length >= 4, "les schémas attendus doivent être présents");
  assert.equal(
    schemas.length,
    stricts.length,
    "chaque schéma doit être .strict() : un champ inattendu est un rejet",
  );
});

test("les écritures d'administration sont journalisées", async () => {
  const source = await readFile(
    path.join(root, "src/server/actions/admin-assistant-knowledge.ts"),
    "utf8",
  );

  for (const action of [
    "assistant.source.synchronize",
    "assistant.source.create",
    "assistant.source.update",
    "assistant.source.delete",
    "assistant.conversation.delete",
    "assistant.lead.status",
  ]) {
    assert.match(source, new RegExp(`action: "${action}"`), `${action} doit être audité`);
  }

  assert.match(
    source,
    /requireAnyAdminRole\(\.\.\.adminRolesForScreen\(SCREEN\)\)/,
    "les rôles de l'action doivent être ceux de l'écran, pas une liste parallèle",
  );
});

test("la base documentaire peut être amorcée depuis l'administration en production", async () => {
  const action = await readFile(
    path.join(root, "src/server/actions/admin-assistant-knowledge.ts"),
    "utf8",
  );
  const manager = await readFile(
    path.join(
      root,
      "src/components/features/admin/assistant/assistant-sources-manager.tsx",
    ),
    "utf8",
  );

  assert.match(action, /export async function synchronizeAssistantKnowledge/);
  assert.match(action, /seedAssistantKnowledge\(\{ log: false \}\)/);
  assert.match(manager, /Synchroniser le site/);
});

test("les notes internes des prospects restent une fonction d'administration", async () => {
  const publicWidget = await readFile(
    path.join(root, "src/components/features/assistant/aiduca-assistant.tsx"),
    "utf8",
  );
  const adminLeads = await readFile(
    path.join(
      root,
      "src/components/features/admin/assistant/assistant-leads-table.tsx",
    ),
    "utf8",
  );

  assert.doesNotMatch(publicWidget, /internalNote/);
  assert.match(adminLeads, /Note interne/);
  assert.match(adminLeads, /setAssistantLeadStatus\(id, status, notes\[id\]/);
});

test("les conversations sont purgées et couvertes par les droits RGPD", async () => {
  const cron = await readFile(
    path.join(root, "src/app/api/cron/cleanup/route.ts"),
    "utf8",
  );
  assert.match(
    cron,
    /assistantConversation\.deleteMany/,
    "la rétention annoncée dans le widget doit être appliquée",
  );
  assert.match(cron, /lastMessageAt: \{ lt: ninetyDaysAgo \}/);

  const gdpr = await readFile(path.join(root, "src/server/services/gdpr.ts"), "utf8");
  assert.match(
    gdpr,
    /conversationsAssistant/,
    "les échanges doivent figurer dans l'export art. 15/20",
  );
  assert.match(
    gdpr,
    /assistantConversation\.deleteMany/,
    "les échanges doivent être effacés au titre de l'art. 17",
  );
  assert.match(gdpr, /assistantLead\.deleteMany/);
});

test("le widget public n'est monté que si l'assistant est configuré", async () => {
  const layout = await readFile(path.join(root, "src/app/layout.tsx"), "utf8");

  assert.match(
    layout,
    /isAiducaAssistantConfigured\(\) \? <AssistantMount \/> : null/,
    "sans clé API, aucun bouton mort ne doit être rendu",
  );
});

test("le widget est masqué là où un autre assistant est déjà en place", async () => {
  const mount = await readFile(
    path.join(root, "src/components/features/assistant/assistant-mount.tsx"),
    "utf8",
  );

  for (const prefix of ["/admin", "/formateur", "/connexion"]) {
    assert.match(mount, new RegExp(`"${prefix}"`), `${prefix} doit être exclu`);
  }
  assert.match(
    mount,
    /apprentissage\\\/\[\^\/\]\+\\\/lecons\\\//,
    "l'atelier de leçon a déjà le tuteur pédagogique",
  );
});

test("les réponses sont rendues sans injection HTML", async () => {
  const widget = await readFile(
    path.join(root, "src/components/features/assistant/aiduca-assistant.tsx"),
    "utf8",
  );

  assert.match(
    widget,
    /<MarkdownContent source=\{entry\.text\}/,
    "le rendu passe par le markdown typé du dépôt",
  );
  assert.doesNotMatch(widget, /dangerouslySetInnerHTML/);
});
