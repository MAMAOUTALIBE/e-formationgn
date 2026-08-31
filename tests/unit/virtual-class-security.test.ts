import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isAllowedResourceFile, resourceUploadContentType } from "../../src/lib/resource-file";

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

test("le lien de classe est envoyé uniquement aux apprenants actifs par un modérateur", () => {
  const actions = read("src/server/actions/virtual-classes.ts");
  const notifications = read("src/server/services/virtual-class-notifications.ts");
  const adminActions = read("src/components/features/virtual-classes/virtual-class-admin-actions.tsx");
  const instructorActions = read("src/components/features/virtual-classes/virtual-class-instructor-actions.tsx");

  const sendAction = actions.slice(
    actions.indexOf("export async function sendVirtualClassLinkToLearners"),
    actions.indexOf("export async function cancelVirtualClass"),
  );
  assert.match(sendAction, /requireVirtualClassModerator\(virtualClassId\)/);
  assert.match(sendAction, /audience: "LEARNERS"/);
  assert.match(sendAction, /checkRateLimit\(/);
  assert.match(notifications, /where: \{ status: "ACTIVE" \}/);
  assert.match(notifications, /`\/classes-virtuelles\/\$\{virtualClass\.id\}`/);
  assert.match(adminActions, /Envoyer le lien aux apprenants/);
  assert.match(instructorActions, /Envoyer le lien aux apprenants/);
  assert.match(adminActions, /className="w-full sm:w-auto"/);
  assert.match(instructorActions, /className="w-full sm:w-auto"/);
});

test("le type d’un document est déduit du fichier déposé, jamais de la requête", () => {
  // Le champ `contentType` transitait du client jusqu'à l'en-tête de réponse
  // sans revalidation : un `text/html` déclaré sur un dépôt accepté était
  // servi tel quel depuis l'origine de la plateforme, donc exécuté comme du
  // code de la page. La règle appliquée aux ressources de leçon — déduire le
  // type du fichier — vaut désormais aussi pour les classes virtuelles.
  const key = "resources/virtual-classes/usr_1/1759000000000-a1b2c3d4-support.pdf";
  assert.equal(resourceUploadContentType(key, "text/html"), "application/pdf");
  assert.equal(resourceUploadContentType(key, ""), "application/pdf");

  // Les formats qui s'exécuteraient dans la page restent refusés à l'écriture.
  assert.equal(isAllowedResourceFile("piege.html", "text/html"), false);
  assert.equal(isAllowedResourceFile("piege.svg", "image/svg+xml"), false);
  assert.equal(isAllowedResourceFile("support.pdf", "application/pdf"), true);
  // Un PDF légitime déclaré `text/html` par le client : le nom fait foi pour
  // l'acceptation, et le type servi est recalculé.
  assert.equal(isAllowedResourceFile("support.pdf", "text/html"), false);
});

test("la route de document ne relaie plus la colonne contentType", () => {
  const route = read("src/app/api/classes-virtuelles/[id]/ressources/[resourceId]/route.ts");
  assert.match(route, /resourceUploadContentType\(resource\.storageUrl, ""\)/);
  assert.doesNotMatch(route, /"content-type": resource\.contentType/);
  assert.doesNotMatch(route, /contentType: resource\.contentType/);
});

test("la discussion renvoie les messages les plus récents", () => {
  // Un tri ascendant borné à 250 renvoyait les 250 PREMIERS messages : passé
  // ce seuil la discussion se figeait définitivement.
  const route = read("src/app/api/classes-virtuelles/[id]/messages/route.ts");
  assert.match(route, /orderBy: \[\{ createdAt: "desc" \}, \{ id: "desc" \}\]/);
  assert.match(route, /messages\.reverse\(\)/);
});

test("la présence est clôturée aussi hors webhook LiveKit", () => {
  const actions = read("src/server/actions/virtual-classes.ts");
  const webhook = read("src/app/api/webhooks/livekit/route.ts");
  // Les deux chemins convergent sur le même service : sinon une feuille de
  // présence dépendait entièrement de la livraison du webhook.
  assert.match(webhook, /closeOpenAttendancePeriods\(tx, \{/);
  assert.match(actions, /reason: "session_ended"/);
  assert.match(actions, /reason: "session_cancelled"/);
});

test("le fuseau de la séance fait autorité sur celui du serveur", () => {
  const validators = read("src/lib/validators/virtual-class.ts");
  const display = read("src/lib/virtual-class-display.ts");
  assert.match(validators, /zonedDateTimeToUtc\(value\.startsAt, value\.timezone\)/);
  assert.match(validators, /refine\(isSupportedTimeZone/);
  // Plus aucune interprétation implicite de l'heure saisie.
  assert.doesNotMatch(validators, /new Date\(value\.startsAt\)/);
  // Les listes ne doivent pas pouvoir lever sur une ligne déjà en base.
  assert.match(display, /timeZone: safeTimeZone\(timezone\)/);
  assert.doesNotMatch(display, /timeZone: timezone,/);
});

test("la rétention des replays est posée, appliquée et purgée", () => {
  const actions = read("src/server/actions/virtual-classes.ts");
  const route = read("src/app/api/classes-virtuelles/[id]/replay/[recordingId]/route.ts");
  const cleanup = read("src/app/api/cron/cleanup/route.ts");
  const queries = read("src/server/queries/virtual-classes.ts");

  // Posée à la publication…
  assert.match(actions, /virtualClassReplayExpiry\(publishedAt\)/);
  // …refusée à la lecture une fois échue…
  assert.match(route, /isReplayWithinRetention\(recording\.expiresAt\)/);
  assert.match(route, /status: 410/);
  // …le fichier retiré du stockage avant la ligne, pour ne pas laisser
  // d'objet orphelin si la suppression distante échoue…
  assert.match(cleanup, /deleteR2Object\(recording\.storageKey\)/);
  assert.match(cleanup, /purgeExpiredReplays/);
  // …et jamais proposée dans les listes.
  assert.match(queries, /isReplayWithinRetention\(recording\.expiresAt\)/);
});

test("la discussion est modérable et cloisonnée après la séance", () => {
  const actions = read("src/server/actions/virtual-classes.ts");
  const route = read("src/app/api/classes-virtuelles/[id]/messages/route.ts");
  const room = read("src/components/features/virtual-classes/virtual-class-room.tsx");

  // Le retrait passe par le garde modérateur, pas par le seul auteur.
  const deleteAction = actions.slice(
    actions.indexOf("export async function deleteVirtualClassMessage"),
    actions.indexOf("export async function addVirtualClassResource"),
  );
  assert.match(deleteAction, /requireVirtualClassModerator\(message\.virtualClassId\)/);
  assert.match(deleteAction, /deletedAt: now, moderatedAt: now/);
  assert.match(deleteAction, /createAuditLog/);

  // L'apprenant ne reçoit plus les messages éphémères après la fin.
  assert.match(route, /viewer\.viewerRole === "STUDENT" && viewer\.status === "ENDED"/);
  assert.match(route, /visibleAfterClass: true/);
  // Le bouton n'est rendu que si le serveur a reconnu un modérateur.
  assert.match(route, /canModerate: viewer\.viewerRole !== "STUDENT"/);
  assert.match(room, /canModerate \? <button/);
});

test("aucune boîte native ne subsiste dans les écrans de classe virtuelle", () => {
  // `window.alert`/`confirm`/`prompt` bloquent le fil, ignorent la charte et
  // sont supprimés par certains navigateurs mobiles. Le dépôt utilise partout
  // ailleurs `ConfirmDialog` + `sonner`.
  for (const file of [
    "src/components/features/virtual-classes/virtual-class-room.tsx",
    "src/components/features/virtual-classes/virtual-class-admin-actions.tsx",
    "src/components/features/virtual-classes/virtual-class-instructor-actions.tsx",
    "src/components/features/virtual-classes/virtual-class-replay-manager.tsx",
    "src/components/features/virtual-classes/virtual-class-resource-manager.tsx",
  ]) {
    const source = read(file);
    // Les commentaires citent ces noms : on ne cible que les appels réels.
    assert.doesNotMatch(source, /window\.(alert|confirm|prompt)\(/, `${file} utilise encore une boîte native`);
  }
});

test("la salle occupe tout l’écran, les écrans de consultation gardent le menu", () => {
  const layout = read("src/app/classes-virtuelles/layout.tsx");
  const room = read("src/app/classes-virtuelles/[id]/salle/page.tsx");
  const detail = read("src/app/classes-virtuelles/[id]/page.tsx");

  // Le layout de segment ne monte plus la coque : sinon la salle ne pouvait
  // pas s'y soustraire, un layout imbriqué se composant avec son parent.
  // On cible le montage réel (`<AccountShell`), pas la simple mention du nom :
  // les commentaires d'explication le citent légitimement.
  assert.doesNotMatch(layout, /<AccountShell/);
  assert.doesNotMatch(room, /<AccountShell/);
  assert.match(detail, /<AccountShell/);
  // Et la salle ne s'ouvre plus sur une séance close.
  assert.match(room, /\["ENDED", "CANCELLED"\]\.includes\(item\.status\)/);
});

test("la CSP autorise le websocket ET l’origine HTTP de LiveKit", () => {
  // `livekit-client` interroge `https://<projet>.livekit.cloud/settings/regions`
  // AVANT d'ouvrir la session : `getCloudConfigUrl` remplace `ws` par `http`
  // dans l'URL du serveur. La seule autorisation `wss:` bloquait cet appel — en
  // production uniquement, la politique n'y étant pas en report-only.
  const config = readFileSync("next.config.ts", "utf8");
  const origins = config.match(/function livekitCspOrigins[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(origins, /https:\/\/\*\.livekit\.cloud/);
  assert.match(origins, /https:\/\/\*\.livekit\.run/);
  // Le websocket reste ouvert, mais borné aux domaines LiveKit — cf. le test
  // dédié plus bas, qui interdit le retour d'un `wss:` nu.
  assert.match(origins, /wss:\/\/\*\.livekit\.cloud/);
  // Injecté dans `connect-src`, et pas ailleurs.
  assert.match(config, /`connect-src 'self' \$\{livekitOrigins\}/);

  // Les domaines publics restent inclus quoi qu'il arrive : les en-têtes sont
  // figés dans routes-manifest.json AU BUILD, or l'image est construite sur un
  // poste où LIVEKIT_URL n'est pas posée (elle n'arrive qu'au runtime).
  assert.match(origins, /const origins = new Set\(\[/);
});

test("la salle peut demander caméra et micro, la géolocalisation reste refusée", () => {
  const config = readFileSync("next.config.ts", "utf8");
  const policy = config.match(/"camera=[^"]+"/)?.[0] ?? "";
  assert.match(policy, /camera=\(self\)/);
  assert.match(policy, /microphone=\(self\)/);
  assert.match(policy, /geolocation=\(\)/);
});

test("le plafond de places ne compte que les apprenants", () => {
  const livekit = read("src/lib/livekit/server.ts");
  const route = read("src/app/api/classes-virtuelles/[id]/token/route.ts");

  // Le rôle vient des métadonnées que le serveur a signées dans le jeton :
  // un participant ne peut pas se déclarer modérateur pour sortir du décompte.
  assert.match(livekit, /export async function countLiveKitLearners/);
  assert.match(livekit, /metadata\.role !== "ADMIN" && metadata\.role !== "INSTRUCTOR"/);
  // Une métadonnée illisible compte comme un apprenant (lecture stricte).
  assert.match(livekit, /\} catch \{\s*return true;/);
  // La salle LiveKit réserve des places aux modérateurs, sinon sa propre
  // limite excluait le formateur arrivé en dernier.
  assert.match(livekit, /input\.maxParticipants \+ LIVEKIT_MODERATOR_HEADROOM/);
  // Et le plafond ne s'applique qu'aux apprenants.
  assert.match(route, /access\.roomRole === "STUDENT"/);
  assert.doesNotMatch(route, /countLiveKitParticipants/);
});

test("l’environnement du participant est relevé côté serveur uniquement", () => {
  const route = read("src/app/api/classes-virtuelles/[id]/token/route.ts");
  assert.match(route, /summarizeUserAgent\(requestHeaders\.get\("user-agent"\)\)/);
  assert.match(route, /deviceInfo/);
  // La route ne lit toujours aucun corps de requête : rien de ce qu'elle
  // enregistre ne peut être choisi par l'appelant.
  assert.doesNotMatch(route, /request\.json\(\)/);
});

test("l’en-tête de salle n’annonce un direct que lorsqu’il a lieu", () => {
  const room = read("src/components/features/virtual-classes/virtual-class-room.tsx");
  // Le badge s'affichait dès l'ouverture, donc avant l'arrivée du formateur.
  assert.match(room, /status === "LIVE"\s*\n?\s*\? <span[^>]*>[\s\S]{0,120}EN DIRECT/);
  assert.match(room, /SALLE OUVERTE/);
  // Le chronomètre est ancré sur l'ouverture réelle, et recalculé à chaque tic
  // plutôt qu'incrémenté — un onglet en arrière-plan voit ses timers ralentis.
  assert.match(room, /openedAtMs \? Math\.max\(0, Math\.floor\(\(Date\.now\(\) - openedAtMs\) \/ 1000\)\)/);
  assert.doesNotMatch(room, /setInterval\(\(\) => setSeconds\(\(value\) => value \+ 1\), 1000\)/);
});

test("la CSP n’autorise plus un websocket vers n’importe quel hôte", () => {
  const config = readFileSync("next.config.ts", "utf8");
  const origins = config.match(/function livekitCspOrigins[\s\S]*?\n\}/)?.[0] ?? "";
  // `wss:` nu était un canal d'exfiltration ouvert pour un script injecté,
  // alors que LiveKit est le seul consommateur de websocket de l'application.
  assert.doesNotMatch(origins, /"wss:"/);
  assert.match(origins, /"wss:\/\/\*\.livekit\.cloud"/);
  assert.match(origins, /"https:\/\/\*\.livekit\.cloud"/);
  const connect = config.match(/`connect-src[^`]+`/)?.[0] ?? "";
  assert.doesNotMatch(connect, /\swss:\s/);
});

test("une panne LiveKit n’empêche pas de terminer une séance", () => {
  const actions = read("src/server/actions/virtual-classes.ts");
  const endAction = actions.slice(
    actions.indexOf("export async function endVirtualClass"),
    actions.indexOf("export async function moderateVirtualClassParticipant"),
  );
  // Sans rattrapage, l'exception remontait : la séance restait indéfiniment
  // LIVE, les périodes de présence ouvertes, et le formateur n'avait plus
  // aucun moyen de clore sa séance.
  assert.match(endAction, /roomClosed = await closeLiveKitRoom\(/);
  assert.match(endAction, /\(error\) => \{/);
  // La clôture en base a lieu quoi qu'il arrive…
  assert.match(endAction, /status: "ENDED", endedAt/);
  assert.match(endAction, /reason: "session_ended"/);
  // …et le message ne prétend pas que la salle a répondu si ce n'est pas le cas.
  assert.match(endAction, /roomClosed\s*\n?\s*\? "Séance terminée pour tous\."/);
  assert.match(endAction, /La salle n’a pas répondu/);
});

test("une configuration absente est nommée, pas noyée dans un message générique", () => {
  const actions = read("src/server/actions/virtual-classes.ts");
  const livekit = read("src/lib/livekit/server.ts");
  // Le stockage des replays lève une erreur typée plutôt qu'un Error nu.
  assert.match(livekit, /class ReplayStorageConfigurationError extends Error/);
  assert.match(livekit, /throw new ReplayStorageConfigurationError\(\)/);
  assert.doesNotMatch(livekit, /throw new Error\("Le stockage privé des replays/);
  // Et l'action les relaie telles quelles : la cause appelle une intervention
  // d'administration, pas un nouvel essai.
  assert.match(actions, /error instanceof LiveKitConfigurationError \|\| error instanceof ReplayStorageConfigurationError/);
  assert.match(actions, /Le service de visioconférence n’a pas répondu/);
});

test("la capacité d’une salle vide est resynchronisée, jamais en plein cours", () => {
  const livekit = read("src/lib/livekit/server.ts");
  // LiveKit n'expose pas de mise à jour : recréer est la seule voie, et elle
  // déconnecterait tout le monde si la salle était occupée.
  assert.match(livekit, /current\.numParticipants === 0 && current\.maxParticipants !== desired/);
  assert.match(livekit, /await client\.deleteRoom\(input\.name\)/);
  // Salle occupée : on sort sans rien toucher.
  assert.match(livekit, /\} else \{\s*\n\s*return;/);
});

test("le cron de rappels survit à une fenêtre illisible et le signale", () => {
  const route = read("src/app/api/cron/virtual-class-reminders/route.ts");
  // Deux niveaux d'isolement : la requête de fenêtre, puis chaque séance.
  assert.match(route, /fenêtre de rappel \$\{window\.kind\} illisible/);
  assert.match(route, /rappel de classe virtuelle \$\{item\.id\} en échec/);
  // Un passage partiel ne doit pas être vu comme réussi par la supervision.
  assert.match(route, /ok: failed === 0/);
  assert.match(route, /status: failed \? 207 : 200/);
});
